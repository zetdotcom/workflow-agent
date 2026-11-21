import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { watch } from "chokidar";
import { checkWorkflow, readBoard } from "./repository.js";

const web = new URL("../web/", import.meta.url);
const types: Record<string, string> = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript" };

export async function startServer(repository: string) {
  const root = await checkWorkflow(repository);
  const clients = new Set<ServerResponse>();
  const watcher = watch(root, { ignoreInitial: true, followSymlinks: false });
  try {
    await once(watcher, "ready");
  } catch (error) {
    await watcher.close();
    throw error;
  }

  let timer: ReturnType<typeof setTimeout>;
  watcher.on("all", () => {
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
    await watcher.close();
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
      await Promise.all([watcher.close(), new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))]);
    }
  };
}
