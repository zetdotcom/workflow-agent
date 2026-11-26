// A subprocess peer for deterministic app-server contract tests. It never contacts a model or a remote.
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

const send = packet => process.stdout.write(JSON.stringify(packet) + "\n");
const pending = new Map();
const cwd = process.cwd();
let threadId, workflow;
const record = value => appendFile(process.env.WF_TEST_CALLS, JSON.stringify(value) + "\n");
const notify = (method, params) => send({ method, params });
function request(method, params) {
  const id = randomUUID();
  const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  send({ method, id, params });
  return promise;
}

async function turn(params, turnId) {
  const base = { threadId, turnId };
  const input = params.input[0].text;
  let text = "The plan explains the ticket approach.";
  let failure;
  if (input.startsWith("Wait for stop")) {
    notify("item/completed", { ...base, item: { id: "waiting", type: "agentMessage", text: "Waiting for interruption." } });
    return;
  }
  if (workflow) {
    const action = JSON.parse(input.split("\n")[1]);
    await record({ event: "execute", action, skill: params.input[1]?.name, authorizedPublication: input.includes("PR publication after all required checks pass") });
    if (action.command === "to-pr") {
      const refused = action.ticket === "002-fails";
      notify("item/completed", { ...base, item: { type: "commandExecution", id: "check", command: "npm test", status: refused ? "failed" : "completed", aggregatedOutput: refused ? "Check failed" : "Checks passed", exitCode: refused ? 1 : 0 } });
      if (refused) failure = "Required checks failed.";
      else if (action.ticket === "003-unverified") text = "The PR was created.";
      else {
        const root = join(cwd, ".workflow", "changes", action.change);
        const dir = join(root, "2.todo", action.ticket);
        await writeFile(join(dir, "TO-PR.md"), ["---", "state: delivered-to-review", "delivery_kind: ready",
          "completion_recorded: yes", "push_result: success", "runtime_limitation_recorded: no", "active_phase: 0", "completed_phases: 1",
          "spec_identity: " + action.specIdentity, "plan_identity: " + action.planIdentity, "baseline_branch: " + action.branch,
          "pr_url: https://example.test/pull/17", "---", "# Delivered"].join("\n"));
        await mkdir(join(root, "4.done"), { recursive: true });
        await rename(dir, join(root, "4.done", action.ticket));
        notify("turn/diff/updated", { ...base, diff: "diff --git a/calendar.ts b/calendar.ts\n+export const calendar = true;" });
        notify("item/completed", { ...base, item: { type: "collabAgentToolCall", id: "phase", tool: "spawnAgent", status: "completed", receiverThreadIds: [threadId + "-phase"] } });
        text = "The checks passed and the pull request was created.";
      }
    } else {
      const decision = await request("item/commandExecution/requestApproval", { ...base, itemId: "status", command: "git status", reason: "Inspect status" });
      await record({ event: "hostPermission", decision: decision.decision });
      text = "Status has been checked.";
    }
  } else if (input.startsWith("Propose") || input.startsWith("Status")) {
    const tool = input.startsWith("Status") ? "wf_status" : "wf_to_pr";
    const ticket = input.startsWith("Propose failure") ? "002" : input.startsWith("Propose unverified") ? "003" : "001";
    const args = { change: "SHOP-8", ticket, reason: "You asked to run the workflow for this ticket." };
    const item = { type: "dynamicToolCall", id: "action", tool, arguments: args };
    notify("item/started", { ...base, item: { ...item, status: "inProgress" } });
    const result = await request("item/tool/call", { ...base, callId: item.id, tool, arguments: args });
    notify("item/completed", { ...base, item: { ...item, status: result.success ? "completed" : "failed", ...result } });
    text = result.success ? "The action is ready for your authorization." : result.contentItems[0].text;
  }
  notify("item/completed", { ...base, item: { id: "reason", type: "reasoning", summary: ["Checked the requested ticket."], content: ["non-public test content"] } });
  notify("item/completed", { ...base, item: { id: "message", type: "agentMessage", text } });
  notify("turn/completed", { threadId, turn: { id: turnId, status: failure ? "failed" : "completed", error: failure ? { message: failure } : null } });
}

async function packet(value) {
  const { id, method, params } = value;
  if (!method) {
    const callback = pending.get(id);
    pending.delete(id);
    return value.error ? callback.reject(new Error(value.error.message)) : callback.resolve(value.result);
  }
  if (method === "initialized") return;
  let result = {};
  if (method === "config/read") result = { config: { mcp_servers: { external: {} } } };
  if (method === "skills/list") result = { data: [{ cwd, skills: [{ name: "wf", enabled: true, path: join(cwd, "skills", "wf", "SKILL.md") }] }] };
  if (method === "thread/items/list") result = { data: [{ turnId: "review", item: { type: "commandExecution", id: "verify", command: "npm run verify", exitCode: 0, status: "completed", aggregatedOutput: "Verification passed" } }], nextCursor: null };
  if (method === "thread/start" || method === "thread/resume") {
    threadId = params.threadId || randomUUID();
    workflow = params.sandbox !== "read-only";
    await record({ event: method, threadId, workflow, tools: params.dynamicTools?.map(t => t.name), config: params.config });
    result = { thread: { id: threadId } };
  }
  if (method === "turn/start") {
    const turnId = randomUUID();
    send({ id, result: { turn: { id: turnId, status: "inProgress" } } });
    return turn(params, turnId);
  }
  send({ id, result });
}

createInterface({ input: process.stdin }).on("line", line => { void packet(JSON.parse(line)); });
