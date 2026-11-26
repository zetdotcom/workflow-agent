import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { once } from "node:events";
import { mkdir, rename, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runClaude } from "../dist/server/claude.js";
import { fixture } from "./fixture.mjs";

function peer(t) {
  const cli = fileURLToPath(new URL("claude-fixture.mjs", import.meta.url));
  const start = childProcess.spawn;
  const calls = [];
  const patch = t.mock.method(childProcess, "spawn", (file, args, options) => {
    if (!/claude(?:\.exe)?$/i.test(file)) return start(file, args, options);
    const child = start(process.execPath, [cli, ...args], options);
    calls.push({ file, args, options, child });
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { patch.mock.restore(); syncBuiltinESMExports(); });
  return calls;
}

async function turn(t) {
  const confirmed = [];
  const entries = [];
  const options = {
    repository: await fixture(t), directory: await fixture(t), input: "", signal: new AbortController().signal,
    callbacks: {
      thread: id => confirmed.push(id), entry: item => entries.push(item), beforeTurn: async () => {},
      projectTool: () => assert.fail("Unexpected project tool request"), prompt: () => assert.fail("Unexpected permission request")
    }
  };
  const run = (input, changes) => runClaude({ ...options, input, ...changes });
  return { options, confirmed, entries, run };
}

test("Claude discussions expose only the board MCP tools and resume the exact confirmed native session", async t => {
  const calls = peer(t);
  const { options, confirmed, run } = await turn(t);
  const input = "Discuss @orders.txt as literal text.\nThis text arrives on stdin.";
  assert.equal(await run(input), input);
  const [id] = confirmed;
  assert.match(id, /^[a-f\d-]{36}$/);
  assert.equal(await run("follow-up", { thread: id }), "follow-up");
  assert.deepEqual(confirmed, [id, id]);
  for (const [index, { args, options: processOptions }] of calls.entries()) {
    assert(!args.includes(input));
    assert.equal(processOptions.cwd, options.directory);
    assert(!processOptions.shell);
    for (const flag of ["--safe-mode", "--restricted", "--strict-mcp-config", "--disable-slash-commands"]) assert(args.includes(flag));
    assert.equal(args[args.indexOf("--tools") + 1], "");
    assert.equal(args[args.indexOf("--permission-mode") + 1], "dontAsk");
    assert.deepEqual(JSON.parse(args[args.indexOf("--settings") + 1]).permissions.deny, ["Read(//**)"]);
    assert.deepEqual(JSON.parse(args[args.indexOf("--mcp-config") + 1]), { mcpServers: { wfboard: { name: "wfboard", type: "sdk" } } });
    assert.deepEqual(args.filter(value => value.startsWith("mcp__")), ["find_files", "read_file", "wf_status", "wf_to_pr"].map(name => "mcp__wfboard__" + name));
    assert.equal(args[args.indexOf(index ? "--resume" : "--session-id") + 1], id);
    assert(!args.includes("--continue"));
  }
  const tool = (name, args) => run("Fixture tool " + JSON.stringify({ name, args }));
  options.callbacks.projectTool = async (name, args) => {
    assert.equal(name, "read_file");
    assert.deepEqual(args, { path: "board.md" });
    return { text: "a board-provided result" };
  };
  const found = JSON.parse(await tool("read_file", { path: "board.md" }));
  assert.deepEqual(JSON.parse(found.result.content[0].text), { text: "a board-provided result" });
  assert.match(JSON.parse(await tool("Bash", { command: "invalid" })).error.message, /unavailable/i);
  options.callbacks.projectTool = async () => { throw new Error("Private native diagnostic."); };
  const failedRead = JSON.parse(await tool("read_file", { path: "pending.md" })).result;
  assert.equal(failedRead.isError, true);
  assert.doesNotMatch(failedRead.content[0].text, /Private/);
  await assert.rejects(run("extra native tool"), /required.*tools|tools required/i);
});

test("Claude reports safe setup, native, and stale-session failures; Stop waits for its owned process", async t => {
  const calls = peer(t);
  const { options, confirmed, run } = await turn(t);
  const id = "9477e6d3-a00e-43d1-b74e-b18b90c77711";
  await assert.rejects(run("needs sign-in"), error => /claude auth login/.test(error.message) && !error.message.includes("Private"));
  await assert.rejects(run("missing session", { thread: id }), error => /new chat/i.test(error.message) && !error.message.includes("Private"));
  await assert.rejects(run("different session", { thread: id }), /session/i);
  await assert.rejects(run("empty answer", { thread: id }), /response|reply|answer/i);
  await assert.rejects(run("stale", { callbacks: { ...options.callbacks, beforeTurn: async () => { throw new Error("Approval changed."); } } }), /Approval changed/);
  assert.deepEqual(confirmed, []);
  const controller = new AbortController();
  const pending = run("wait for stop", { thread: id, signal: controller.signal });
  const { child } = calls.at(-1);
  let closed = false;
  child.once("close", () => { closed = true; });
  const [started] = await once(child.stderr, "data", { signal: AbortSignal.timeout(10_000) });
  const commandPid = Number(started.toString().trim());
  assert(Number.isSafeInteger(commandPid) && commandPid > 0);
  controller.abort();
  await assert.rejects(pending, /interrupt/i);
  assert.equal(closed, true);
  const alive = () => {
    try { process.kill(commandPid, 0); return true; }
    catch (error) { if (error.code === "ESRCH") return false; throw error; }
  };
  for (let retry = 0; retry < 50 && alive(); retry++) await delay(20);
  assert.equal(alive(), false, "Stop reaps a command that ignored TERM after its parent exited");
  assert.deepEqual(confirmed, []);
});

test("Claude runs a fresh approved workflow in the checkout and scopes every status write", async t => {
  const calls = peer(t);
  const { options, confirmed, entries, run } = await turn(t);
  const change = "LOCAL-9-test";
  const changeDirectory = join(options.repository, ".workflow", "changes", change);
  const path = join(changeDirectory, "STATUS.md");
  await mkdir(changeDirectory, { recursive: true });
  await writeFile(path, "Original status");
  const workflow = { action: { command: "status", change, directory: ".workflow/changes/" + change }, skillDirectory: await fixture(t) };
  const previous = "9477e6d3-a00e-43d1-b74e-b18b90c77711";
  const request = (name, args) => run("Fixture permission " + JSON.stringify({ name, args }), { workflow, thread: previous }).then(JSON.parse);
  let prompts = 0;
  options.callbacks.prompt = async prompt => {
    prompts++;
    assert.match(prompt.title, /Write/);
    assert.equal(JSON.parse(prompt.detail).file_path, path);
    return { approve: true, answers: {} };
  };
  const input = { file_path: path, content: "New status" };
  assert.deepEqual(await request("Write", input), { behavior: "allow", updatedInput: input });
  assert.equal(prompts, 1);
  assert.match(entries.at(-1).title, /Write.*completed/);
  assert.doesNotMatch(JSON.stringify(entries), /Private native diagnostic/);
  const [{ args, options: processOptions }] = calls;
  assert.equal(processOptions.cwd, options.repository);
  assert.equal(args[args.indexOf("--permission-prompt-tool") + 1], "stdio");
  assert.equal(args[args.indexOf("--tools") + 1], "Read,Glob,Grep,Edit,Write");
  assert.deepEqual(JSON.parse(args[args.indexOf("--mcp-config") + 1]), { mcpServers: {} });
  assert(!args.includes("--resume"));
  assert.notEqual(confirmed[0], previous);
  assert.equal((await request("Bash", { command: "invalid" })).behavior, "deny");
  assert.equal((await request("Write", { ...input, file_path: join(options.repository, "README.md") })).behavior, "deny");
  const external = join(options.directory, "external.md");
  await writeFile(external, "Synthetic outside file.");
  assert.equal((await request("Read", { file_path: external })).behavior, "deny");
  const archive = { ...workflow, action: { command: "status", change: "archived", directory: ".workflow/archive" } };
  assert.equal(await run("Read archive", { workflow: archive }), "Read archive");
  const archivedArgs = calls.at(-1).args;
  assert.equal(archivedArgs[archivedArgs.indexOf("--tools") + 1], "Read,Glob,Grep");
  assert.equal(prompts, 1);
  options.callbacks.prompt = async () => ({ approve: false, answers: {} });
  assert.equal((await request("Write", input)).behavior, "deny");

  // Recheck the destination after the user finishes reviewing a pending write.
  options.callbacks.prompt = async () => {
    const moved = join(options.repository, "moved-change");
    await rename(changeDirectory, moved);
    await symlink(moved, changeDirectory, process.platform === "win32" ? "junction" : "dir");
    return { approve: true, answers: {} };
  };
  const changed = await request("Write", input);
  assert.equal(changed.behavior, "deny");
  assert.match(changed.message, /changed/);
});

test("Claude delivery forwards per-operation native approvals, including fresh agents and user questions", async t => {
  const calls = peer(t);
  const { options, run } = await turn(t);
  const workflow = { action: { command: "to-pr" }, skillDirectory: await fixture(t) };
  await assert.rejects(run("missing native Agent", { workflow }), { message: "to-pr prerequisite unavailable: fresh-agent-dispatch" });
  await assert.rejects(run("missing native shell", { workflow }), { message: "to-pr prerequisite unavailable: pull-request-create" });
  const request = (name, args) => run("Fixture permission " + JSON.stringify({ name, args }), { workflow }).then(JSON.parse);
  const agent = { subagent_type: "general-purpose", prompt: "Independently inspect the change.", description: "Independent review" };
  options.callbacks.prompt = async prompt => {
    assert.match(prompt.title, /Agent/);
    assert.deepEqual(JSON.parse(prompt.detail), agent);
    return { approve: true, answers: {} };
  };
  assert.deepEqual(await request("Agent", agent), { behavior: "allow", updatedInput: agent });
  const [{ args }] = calls;
  assert.match(args[args.indexOf("--tools") + 1], /Bash,Agent,AskUserQuestion/);
  assert(JSON.parse(args[args.indexOf("--settings") + 1]).permissions.ask.includes("Bash"));
  options.callbacks.prompt = async prompt => {
    assert.deepEqual(prompt.questions, [{ id: "0", question: "Which check?", options: ["Build", "Test"] }]);
    return { approve: true, answers: { "0": "Test" } };
  };
  const ask = { questions: [{ question: "Which check?", options: [{ label: "Build" }, { label: "Test" }] }] };
  assert.deepEqual((await request("AskUserQuestion", ask)).updatedInput.answers, { "Which check?": "Test" });
  options.callbacks.prompt = async () => ({ approve: false, answers: {} });
  assert.equal((await request("Bash", { command: "node --version" })).behavior, "deny");
});

test("Claude redacts quoted credentials in permission previews before forwarding approved input", async t => {
  peer(t);
  const { options, run } = await turn(t);
  const workflow = { action: { command: "to-pr" }, skillDirectory: await fixture(t) };
  const input = { command: 'TEST_PASSWORD="synthetic credential words" node --version', description: "Inspect the Node version" };
  options.callbacks.prompt = async prompt => {
    assert.deepEqual(JSON.parse(prompt.detail), {
      command: "TEST_PASSWORD=[redacted] node --version", description: input.description
    });
    return { approve: true, answers: {} };
  };
  const reply = await run("Fixture permission " + JSON.stringify({ name: "Bash", args: input }), { workflow });
  assert.deepEqual(JSON.parse(reply), { behavior: "allow", updatedInput: input });
});

test("a missing local Claude executable reports setup and leaves the session unassigned", async t => {
  const { options, confirmed, run } = await turn(t);
  const path = process.env.PATH;
  process.env.PATH = options.directory;
  try {
    await assert.rejects(run("Hello"), /Install Claude Code on PATH.*claude auth login/);
    assert.deepEqual(confirmed, []);
  } finally { process.env.PATH = path; }
});
