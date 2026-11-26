import { watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { once } from "node:events";
import { watch as watchPaths } from "chokidar";
import { checkWorkflow, readBoard } from "./repository.js";
import { BoardChats } from "./chat.js";
import { chatProvider, ChatError, displayText, message, object } from "./chat-model.js";
import { projectState } from "./project-state.js";

const web = new URL("../web/", import.meta.url);
const types: Record<string, string> = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript" };

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 96_000) throw new ChatError(413, "Request is too large.");
    chunks.push(chunk);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return object(value);
  }
  catch { throw new ChatError(400, "Expected a JSON object."); }
}

async function watchWorkflow(root: string, onChange: () => void) {
  if (process.platform === "win32") {
    // A single root watch lets Windows rename workflow directories with watched descendants.
    const watcher = watch(root, { recursive: true }, onChange);
    return () => watcher.close();
  }

  const watcher = watchPaths(root, { ignoreInitial: true, followSymlinks: false });
  try {
    await once(watcher, "ready");
  } catch (error) {
    await watcher.close();
    throw error;
  }
  watcher.on("all", onChange);
  return () => watcher.close();
}

export async function startServer(repository: string) {
  repository = await realpath(repository);
  const root = await checkWorkflow(repository);
  const clients = new Set<ServerResponse>();
  let chatTimer: ReturnType<typeof setTimeout> | undefined;
  const storage = await projectState(repository);
  const chats = new BoardChats(repository, storage, () => {
    if (chatTimer) return;
    chatTimer = setTimeout(() => {
      chatTimer = undefined;
      for (const client of clients) client.write("event: chat\ndata: changed\n\n");
    }, 60);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopWatching = await watchWorkflow(root, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const client of clients) client.write("event: update\ndata: changed\n\n");
    }, 80);
  });

  const server = createServer(async (request, response) => {
    const address = server.address();
    if (!address || typeof address === "string" || request.headers.host !== "127.0.0.1:" + address.port) {
      response.writeHead(403).end();
      return;
    }
    const origin = "http://127.0.0.1:" + address.port;
    let url: URL;
    try { url = new URL(request.url ?? "/", origin); }
    catch { response.writeHead(400).end("Invalid request URL."); return; }
    if (url.origin !== origin) { response.writeHead(403).end(); return; }
    const path = url.pathname;
    const chatRoute = /^\/api\/chats\/([a-f0-9-]{36})(?:\/(messages|decision|permission|stop))?$/.exec(path);
    const writable = path === "/api/chats" || path === "/api/settings" || Boolean(chatRoute?.[2]);
    const write = request.method === "POST" && writable;
    if (request.method !== "GET" && !write) {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    if (write && (request.headers.origin !== origin || request.headers["content-type"]?.split(";")[0] !== "application/json")) {
      response.writeHead(403).end("A same-origin JSON request is required.");
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      const json = (value: unknown, code = 200) => response.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(value));
      if (write) {
        const body = await readJson(request);
        if (path === "/api/settings") {
          const provider = chatProvider(body.provider);
          const expected = body.expectedProvider === null ? null : chatProvider(body.expectedProvider);
          chats.store.setProvider(provider, expected);
          for (const client of clients) client.write("event: settings\ndata: changed\n\n");
          json({ provider });
        } else if (path === "/api/chats") {
          if (Object.hasOwn(body, "provider")) throw new ChatError(400, "Choose the project provider in Settings.");
          const expected = body.expectedProvider === undefined ? undefined : chatProvider(body.expectedProvider);
          json({ id: chats.store.create(expected) }, 201);
        } else if (chatRoute) {
          const [, id, operation] = chatRoute;
          if (operation === "messages") await chats.send(id, body);
          if (operation === "decision") await chats.decide(id, body);
          if (operation === "permission") chats.respond(id, body);
          if (operation === "stop") chats.stop(id);
          json({ id }, 202);
        }
      } else if (path === "/api/settings") {
        json({ provider: chats.store.provider() });
      } else if (path === "/api/chats") {
        json(chats.store.list());
      } else if (chatRoute && !chatRoute[2]) {
        json(chats.store.view(chatRoute[1]));
      } else if (path === "/api/files") {
        json(await chats.files.search(url.searchParams.get("q") ?? "", url.searchParams.get("selected") ?? ""));
      } else if (path === "/api/board") {
        const board = await readBoard(repository);
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(board));
      } else if (path === "/api/events") {
        response.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive" });
        response.write("event: update\ndata: connected\n\n");
        clients.add(response);
        response.on("close", () => clients.delete(response));
      } else if (path === "/" || /^\/assets\/[\w.-]+\.(js|css)$/.test(path)) {
        const file = path === "/" ? "index.html" : path.slice(1);
        const body = await readFile(new URL(file, web));
        response.writeHead(200, { "Content-Type": types[file.split(".").pop()!] }).end(body);
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(error instanceof ChatError ? error.status : 500, { "Content-Type": "text/plain; charset=utf-8" }).end(displayText(message(error)));
    }
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
  } catch (error) {
    clearTimeout(timer);
    await stopWatching();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine the board URL.");
  return {
    url: "http://127.0.0.1:" + address.port,
    async close() {
      clearTimeout(timer);
      for (const client of clients) client.end();
      server.closeAllConnections();
      await Promise.all([chats.close(), stopWatching(), new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))]);
      clearTimeout(chatTimer);
    }
  };
}
