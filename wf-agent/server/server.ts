import { watch } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { watch as watchPaths } from "chokidar";
import { checkWorkflow, readBoard } from "./repository.js";

const web = new URL("../web/", import.meta.url);
const types: Record<string, string> = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript" };

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
  const root = await checkWorkflow(repository);
  const clients = new Set<ServerResponse>();
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
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const path = request.url ?? "/";
    try {
      if (path === "/api/board") {
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
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(error instanceof Error ? error.message : "Could not read the repository.");
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
      await Promise.all([stopWatching(), new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))]);
    }
  };
}
