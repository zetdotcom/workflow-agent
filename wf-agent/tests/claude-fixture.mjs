import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const sessionFlag = args.includes("--resume") ? "--resume" : "--session-id";
const session = args[args.indexOf(sessionFlag) + 1];
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks).toString("utf8");
const result = { type: "result", subtype: "success", is_error: false, session_id: session, result: input };

if (input === "wait for stop") {
  process.on("SIGTERM", () => setTimeout(() => process.exit(143), 30));
  process.stderr.write("fixture ready\n");
  setInterval(() => {}, 1000);
} else if (input === "missing session") {
  process.stderr.write("No conversation found with session ID. Private test diagnostic.\n");
  process.exitCode = 1;
} else {
  if (input === "needs sign-in") {
    Object.assign(result, { is_error: true, api_error_status: 401, result: "Not logged in. Private test diagnostic." });
    process.exitCode = 1;
  }
  if (input === "different session") result.session_id = randomUUID();
  if (input === "empty answer") result.result = "  ";
  process.stdout.write(JSON.stringify(result));
}
