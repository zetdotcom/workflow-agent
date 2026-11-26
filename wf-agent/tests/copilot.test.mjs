import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import test from "node:test";
import { CopilotClient } from "@microsoft/copilot-sdk";
import { runCopilot } from "../dist/server/copilot.js";

function runtime(t) {
  const session = {
    sessionId: "bf9c1dfd-4ccd-4533-a229-7446306a5c15",
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

test("Copilot starts and resumes only the bound session with the same read-only discussion contract", async t => {
  const peer = runtime(t);
  const opened = [];
  const ask = (thread, message) => runCopilot(tmpdir(), thread, message, id => opened.push(id), new AbortController().signal);
  assert.equal(await ask(undefined, "What is the goal?"), "The board answer");
  assert.equal(await ask(opened[0], "Continue"), "The board answer");
  const [created] = peer.create.mock.calls[0].arguments;
  const [resumedId, resumed] = peer.resume.mock.calls[0].arguments;
  assert.deepEqual(opened, [peer.session.sessionId, peer.session.sessionId]);
  assert.equal(resumedId, opened[0]);
  for (const config of [created, resumed]) {
    assert.equal(config.workingDirectory, tmpdir());
    assert.equal(config.enableConfigDiscovery, false);
    assert.deepEqual(config.tools.availableTools, []);
    assert.deepEqual(await config.permissions.onRequest({ kind: "shell" }), { kind: "reject" });
  }
  assert.deepEqual(peer.session.sendAndWait.mock.calls.map(call => call.arguments[0].prompt), ["What is the goal?", "Continue"]);
  assert.equal(peer.stop.mock.callCount(), 2);
});

test("Copilot setup, lost sessions and provider failures produce actionable public errors", async t => {
  const peer = runtime(t);
  const ask = thread => runCopilot(tmpdir(), thread, "Test", () => {}, new AbortController().signal);
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
      const reply = runCopilot(tmpdir(), undefined, "Test", () => {}, controller.signal);
      await entered.promise;
      controller.abort();
      await assert.rejects(reply, /chat stopped/);
      assert.equal(peer.stop.mock.callCount(), 1);
      assert.equal(peer.session.abort.mock.callCount(), phase === "turn" ? 1 : 0);
    });
  }
});
