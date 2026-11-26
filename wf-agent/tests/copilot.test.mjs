import assert from "node:assert/strict";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CopilotClient } from "@microsoft/copilot-sdk";
import { runCopilot } from "../dist/server/copilot.js";
import { fixture } from "./fixture.mjs";

function runtime(t) {
  const session = {
    sessionId: "bf9c1dfd-4ccd-4533-a229-7446306a5c15",
    permissionModeResult: { mode: "manual" },
    on: t.mock.fn(),
    rpc: { tools: { initializeAndValidate: async () => {}, getCurrentMetadata: t.mock.fn(async () => ({ tools: [{ name: "task" }, { name: "bash" }] })) },
      agent: { list: t.mock.fn(async () => ({ agents: [{ name: "wf-implementer" }, { name: "wf-reviewer" }] })) } },
    sendAndWait: t.mock.fn(async () => ({ data: { content: "The board answer" } })),
    abort: t.mock.fn(async () => {})
  };
  const client = CopilotClient.prototype;
  return {
    session,
    start: t.mock.method(client, "start", async () => {}),
    auth: t.mock.method(client, "getAuthStatus", async () => ({ isAuthenticated: true })),
    create: t.mock.method(client, "createSession", async () => session),
    resume: t.mock.method(client, "resumeSession", async () => session),
    stop: t.mock.method(client, "stop", async () => [])
  };
}

function turn(overrides = {}) {
  return { directory: tmpdir(), repository: tmpdir(), input: "Test", signal: new AbortController().signal,
    callbacks: { beforeTurn: async () => {}, thread() {}, entry() {}, projectTool: async () => {}, prompt: async () => ({ approve: false, answers: {} }) }, ...overrides };
}

test("Copilot starts and resumes only the bound session with the same read-only discussion contract", async t => {
  const peer = runtime(t);
  const opened = [];
  const calls = [];
  const options = turn();
  options.callbacks.thread = id => opened.push(id);
  options.callbacks.projectTool = async (name, args) => { calls.push([name, args]); return { text: "board result" }; };
  peer.session.sendAndWait.mock.mockImplementation(async () => {
    const config = peer.resume.mock.calls.at(-1)?.arguments[1] || peer.create.mock.calls.at(-1).arguments[0];
    const read = config.tools.definitions.find(tool => tool.name === "read_file");
    assert.equal((await read.handler({ path: "README.md" }, { sessionId: "another session" })).resultType, "failure");
    const result = await read.handler({ path: "README.md" }, { sessionId: peer.session.sessionId });
    assert.equal(result.resultType, "success");
    assert.deepEqual(JSON.parse(result.textResultForLlm), { text: "board result" });
    return { data: { content: "The board answer" } };
  });
  const ask = (thread, input) => runCopilot({ ...options, thread, input });
  assert.equal(await ask(undefined, "What is the goal?"), "The board answer");
  assert.equal(await ask(opened[0], "Continue"), "The board answer");
  const [created] = peer.create.mock.calls[0].arguments;
  const [resumedId, resumed] = peer.resume.mock.calls[0].arguments;
  assert.deepEqual(opened, [peer.session.sessionId, peer.session.sessionId]);
  assert.equal(resumedId, opened[0]);
  for (const config of [created, resumed]) {
    assert.equal(config.workingDirectory, tmpdir());
    assert.equal(config.enableConfigDiscovery, false);
    assert.deepEqual(config.tools.availableTools, ["custom:find_files", "custom:read_file", "custom:wf_status", "custom:wf_to_pr"]);
    assert.equal(config.permissions.mode, "manual");
    const caller = { sessionId: peer.session.sessionId };
    assert.deepEqual(await config.permissions.onRequest({ kind: "shell" }, caller), { kind: "reject" });
    const read = config.tools.definitions.find(tool => tool.name === "read_file");
    assert.equal(read.skipPermission, true);
    assert.equal(read.defer, "never");
    assert.equal((await read.handler({ path: "README.md" }, caller)).resultType, "failure");
  }
  assert.deepEqual(calls, Array.from({ length: 2 }, () => ["read_file", { path: "README.md" }]));
  assert.deepEqual(peer.session.sendAndWait.mock.calls.map(call => call.arguments[0].prompt), ["What is the goal?", "Continue"]);
  assert.equal(peer.stop.mock.callCount(), 2);
});

test("Copilot setup, lost sessions and provider failures produce actionable public errors", async t => {
  const peer = runtime(t);
  const ask = thread => runCopilot(turn({ thread }));
  peer.auth.mock.mockImplementationOnce(async () => ({ isAuthenticated: false }));
  await assert.rejects(ask(), /gh auth login/);
  assert.equal(peer.create.mock.callCount(), 0);
  peer.resume.mock.mockImplementationOnce(async () => { throw new Error("private runtime diagnostic"); });
  await assert.rejects(ask(peer.session.sessionId), { message: "GitHub Copilot could not reopen this conversation. Start a new chat to continue." });
  assert.equal(peer.create.mock.callCount(), 0);
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => { throw new Error("403: private account diagnostic"); });
  await assert.rejects(ask(), error => error.message.includes("gh auth login") && !error.message.includes("private"));
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => ({ data: { content: "" } }));
  await assert.rejects(ask(), /complete text reply/);
});

test("Stop closes an owned Copilot runtime during startup or an active turn", async t => {
  for (const phase of ["startup", "turn"]) {
    await t.test(phase, async t => {
      const peer = runtime(t);
      const entered = Promise.withResolvers();
      const waiting = Promise.withResolvers();
      const controller = new AbortController();
      const operation = phase === "startup" ? peer.start : peer.session.sendAndWait;
      operation.mock.mockImplementationOnce(() => { entered.resolve(); return waiting.promise; });
      peer.stop.mock.mockImplementationOnce(async () => { waiting.reject(new Error("Disconnected")); return []; });
      const reply = runCopilot(turn({ signal: controller.signal }));
      await entered.promise;
      controller.abort();
      await assert.rejects(reply, /chat stopped/);
      assert.equal(peer.stop.mock.callCount(), 1);
      assert.equal(peer.session.abort.mock.callCount(), phase === "turn" ? 1 : 0);
    });
  }
});

test("a native status run uses the checkout, prompts only for eligible writes and keeps archives immutable", async t => {
  const peer = runtime(t);
  const repository = await realpath(await fixture(t));
  const change = "LOCAL-1-demo";
  const directory = ".workflow/changes/" + change;
  const summary = join(repository, directory, "STATUS.md");
  await mkdir(join(repository, directory), { recursive: true });
  await writeFile(summary, "Current status");
  const options = turn({ repository, workflow: { action: { command: "status", change, directory }, skillDirectory: repository } });
  const prompts = [];
  options.callbacks.prompt = async prompt => { prompts.push(prompt); return { approve: prompts.length === 1, answers: {} }; };
  const caller = { sessionId: peer.session.sessionId };
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => {
    const [config] = peer.create.mock.calls[0].arguments;
    assert.equal(config.workingDirectory, repository);
    assert.deepEqual(config.tools.availableTools.sort(), ["builtin:create", "builtin:edit", "builtin:glob", "builtin:grep", "builtin:view"]);
    const permission = request => config.permissions.onRequest(request, caller);
    const write = { kind: "write", fileName: summary, diff: "Changed summary" };
    assert.equal((await permission(write)).result.kind, "approve-once");
    assert.equal((await permission(write)).result.kind, "reject");
    assert.deepEqual(await permission({ ...write, fileEdits: [{ after: { path: join(repository, "outside.md"), content: "private" } }] }), { kind: "reject" });
    assert.deepEqual(await permission({ kind: "shell", fullCommandText: "echo hello" }), { kind: "reject" });
    assert.equal(prompts.length, 2);
    assert.match(prompts[0].detail, /STATUS\.md/);
    const preTool = config.hooks.handlers.onPreToolUse;
    assert.equal(await preTool({ toolName: "edit", toolArgs: { path: summary } }), undefined);
    assert.equal((await preTool({ toolName: "create", toolArgs: { path: "outside.md" } })).permissionDecision, "deny");
    return { data: { content: "Status verified" } };
  });
  assert.equal(await runCopilot(options), "Status verified");
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => {
    const [config] = peer.create.mock.calls.at(-1).arguments;
    const result = await config.permissions.onRequest({ kind: "write", fileName: summary }, caller);
    assert.equal(result.result.kind, "reject");
    return { data: { content: "", toolRequests: [{ name: "edit" }] } };
  });
  await assert.rejects(runCopilot(options), /write permission was declined/);
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => {
    const [archive] = peer.create.mock.calls.at(-1).arguments;
    assert.deepEqual(archive.tools.availableTools, ["builtin:view", "builtin:grep", "builtin:glob"]);
    assert.deepEqual(await archive.permissions.onRequest({ kind: "write", fileName: summary }, caller), { kind: "reject" });
    return { data: { content: "Archive read" } };
  });
  await runCopilot({ ...options, workflow: { ...options.workflow, action: { command: "status", change: "archived", directory: ".workflow/archive" } } });
  assert.equal(peer.resume.mock.callCount(), 0);
});

test("to-pr preflights native capabilities, binds permission responses and records actual worker progress", async t => {
  const peer = runtime(t);
  const options = turn({ workflow: { action: { command: "to-pr", change: "LOCAL-1", directory: ".workflow/changes/LOCAL-1" }, skillDirectory: tmpdir() } });
  const entries = [], prompts = [];
  options.callbacks.entry = entry => entries.push(entry);
  options.callbacks.prompt = async prompt => { prompts.push(prompt); return { approve: true, answers: {} }; };
  await assert.rejects(runCopilot({ ...options, thread: peer.session.sessionId }), /fresh execution session/);
  const metadata = peer.session.rpc.tools.getCurrentMetadata;
  metadata.mock.mockImplementationOnce(async () => ({ tools: [{ name: "bash" }] }));
  await assert.rejects(runCopilot(options), /to-pr prerequisite unavailable: fresh-agent-dispatch/);
  metadata.mock.mockImplementationOnce(async () => ({ tools: [{ name: "task" }] }));
  await assert.rejects(runCopilot(options), /to-pr prerequisite unavailable: pull-request-create/);
  peer.session.rpc.agent.list.mock.mockImplementationOnce(async () => ({ agents: [{ name: "wf-implementer" }, { name: "wf-reviewer", disableModelInvocation: true }] }));
  await assert.rejects(runCopilot(options), /to-pr prerequisite unavailable: fresh-agent-dispatch/);
  assert.equal(peer.session.sendAndWait.mock.callCount(), 0);
  peer.session.sendAndWait.mock.mockImplementationOnce(async () => {
    const [config] = peer.create.mock.calls.at(-1).arguments;
    assert.deepEqual(config.agents.definitions.map(agent => agent.name), ["wf-implementer", "wf-reviewer"]);
    assert.deepEqual(config.agents.definitions[1].tools, ["view", "grep", "glob"]);
    assert.equal(config.tools.availableTools.includes("builtin:task"), true);
    const shell = { kind: "shell", fullCommandText: "git status", resolvedWorkingDirectory: options.repository };
    const handle = config.permissions.onRequest;
    assert.deepEqual(await handle(shell, { sessionId: "unrelated" }), { kind: "reject" });
    assert.equal((await handle(shell, { sessionId: peer.session.sessionId })).result.kind, "approve-once");
    assert.match(prompts[0].detail, /git status/);
    const [event] = peer.session.on.mock.calls.at(-1).arguments;
    event({ type: "subagent.started", data: { toolCallId: "a", agentName: "wf-reviewer" } });
    event({ type: "subagent.completed", data: { toolCallId: "a", agentName: "wf-reviewer" } });
    return { data: { content: "Reviewer completed" } };
  });
  await runCopilot(options);
  assert.deepEqual(entries.map(({title,text}) => [title,text]), [["Agent · started", "wf-reviewer"], ["Agent · completed", "wf-reviewer"]]);
});
