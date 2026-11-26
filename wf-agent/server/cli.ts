import open from "open";
import { startServer } from "./server.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: wf-agent [--no-open]\nOpen the workflow board and local Codex chats for the current repository.");
    return;
  }
  if (args.some(arg => arg !== "--no-open")) throw new Error("Unknown option. Run wf-agent --help for usage.");
  const server = await startServer(process.cwd());
  process.once("SIGINT", () => void server.close());
  process.once("SIGTERM", () => void server.close());
  console.log("Workflow board: " + server.url + "\nPress Ctrl+C to stop.");
  if (!args.includes("--no-open")) {
    const report = (message: string) => console.error("Could not open your browser (" + message + "). Open " + server.url);
    try {
      const launcher = await open(server.url, { wait: false });
      launcher.once("error", error => report(error.message));
      launcher.once("exit", code => { if (code) report("launcher exited with code " + code); });
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  }
}

main().catch(error => {
  console.error("wf-agent: " + (error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
