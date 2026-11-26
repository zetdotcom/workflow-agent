import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { boardScenario, changeName } from "./provider-tools-scenario.mjs";

const args = process.argv.slice(2);
const argument = name => args[args.indexOf(name) + 1];
const session = argument(args.includes("--resume") ? "--resume" : "--session-id");
const workflow = args.includes("--permission-prompt-tool");
const boardNames = ["find_files", "read_file", "wf_status", "wf_to_pr"];
const tools = workflow ? argument("--tools").split(",").map(name => name === "Agent" ? "Task" : name) : boardNames.map(name => "mcp__wfboard__" + name);
const pending = new Map();
const send = event => process.stdout.write(JSON.stringify(event) + "\n");
function request(fields) {
  const id = randomUUID();
  const reply = Promise.withResolvers();
  pending.set(id, reply);
  send({ type: "control_request", request_id: id, request: fields });
  return reply.promise;
}
function mcp(method, params) {
  return request({ subtype: "mcp_message", server_name: "wfboard", message: { jsonrpc: "2.0", id: randomUUID(), method, params } })
    .then(value => value.mcp_response);
}
async function tool(name, args) {
  const data = await mcp("tools/call", { name, arguments: args });
  if (data.error) throw new Error(data.error.message);
  if (data.result.isError) throw new Error(data.result.content[0].text);
  return JSON.parse(data.result.content[0].text);
}
async function nativePermission(name, input) {
  const id = randomUUID();
  send({ type: "assistant", session_id: session, message: { content: [{ type: "tool_use", id, name, input }] } });
  const reply = await request({ subtype: "can_use_tool", tool_name: name, input, tool_use_id: id });
  send({ type: "user", session_id: session, message: { content: [{ type: "tool_result", tool_use_id: id, is_error: reply.behavior !== "allow", content: "Private native diagnostic." }] } });
  return reply;
}
const permission = (path, content) => nativePermission("Write", { file_path: path, content }).then(reply => reply.behavior === "allow");

async function handle(event) {
  if (event.type === "control_response") {
    const response = event.response;
    const waiting = pending.get(response.request_id);
    pending.delete(response.request_id);
    if (response.subtype === "success") waiting.resolve(response.response);
    else waiting.reject(new Error(response.error));
  } else if (event.type === "control_request" && event.request.subtype === "initialize") {
    if (!workflow) {
      await mcp("initialize", { protocolVersion: "2025-03-26" });
      const list = await mcp("tools/list", {});
      assert.deepEqual(list.result.tools.map(tool => tool.name), boardNames);
    }
    send({ type: "control_response", response: { subtype: "success", request_id: event.request_id, response: {} } });
  } else if (event.type === "user") {
    assert.equal(event.client_composed, true);
    const input = event.message.content;
    let inventory = tools;
    if (input === "extra native tool") inventory = [...tools, "Bash"];
    if (input === "missing native Agent") inventory = tools.filter(name => name !== "Task");
    if (input === "missing native shell") inventory = tools.filter(name => name !== "Bash");
    send({ type: "system", subtype: "init", session_id: session, tools: inventory });
    if (input === "wait for stop") {
      process.on("SIGTERM", () => setTimeout(() => process.exit(143), 30));
      const command = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setTimeout(() => {}, 10000)"], { stdio: ["ignore", "pipe", "ignore"] });
      command.stdout.once("data", () => process.stderr.write(String(command.pid) + "\n"));
      return;
    }
    if (input === "missing session") {
      process.stderr.write("No conversation found with session ID. Private test diagnostic.\n", () => process.exit(1));
      return;
    }
    const result = { type: "result", subtype: "success", is_error: false, session_id: session, result: input };
    if (input === "needs sign-in") {
      Object.assign(result, { is_error: true, api_error_status: 401, result: "Not logged in. Private test diagnostic." });
      process.exitCode = 1;
    } else if (input === "different session") result.session_id = randomUUID();
    else if (input === "empty answer") result.result = "  ";
    else if (input.startsWith("Fixture tool ")) {
      const { name, args } = JSON.parse(input.slice("Fixture tool ".length));
      const reply = await mcp("tools/call", { name, arguments: args });
      result.result = JSON.stringify(reply);
    } else if (input.startsWith("Fixture permission ")) {
      const { name, args } = JSON.parse(input.slice("Fixture permission ".length));
      result.result = JSON.stringify(await nativePermission(name, args));
    } else if (input.includes("Board parity:") || (workflow && input.includes(changeName))) {
      result.result = await boardScenario({ input, cwd: process.cwd(), tool, permission, provider: "claude" });
    }
    send(result);
  }
}
createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", line => {
  void handle(JSON.parse(line)).catch(() => {
    send({ type: "result", subtype: "error", is_error: true, session_id: session, result: "Claude fixture protocol failed." });
    process.exitCode = 1;
  });
});
