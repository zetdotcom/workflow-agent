import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { once } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runClaude } from "../dist/server/claude.js";
import { fixture } from "./fixture.mjs";

test("Claude uses supplied text, an exact session, and a restricted native process", async t => {
  const directory = await fixture(t);
  const cli = fileURLToPath(new URL("claude-fixture.mjs", import.meta.url));
  const invoke = childProcess.execFile;
  const calls = [];
  let child;
  const processMock = t.mock.method(childProcess, "execFile", (file, args, options, done) => {
    calls.push({ file, args, options });
    child = invoke(process.execPath, [cli, ...args], options, done);
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { processMock.mock.restore(); syncBuiltinESMExports(); });

  const confirmed = [];
  const run = (input, thread, signal = new AbortController().signal) =>
    runClaude(directory, thread, input, id => confirmed.push(id), signal);
  const input = "Discuss @orders.txt as literal text.\nThis text arrives on stdin.";
  assert.equal(await run(input), input);
  const [id] = confirmed;
  assert.match(id, /^[a-f\d-]{36}$/);
  assert.equal(await run("follow-up", id), "follow-up");
  assert.deepEqual(confirmed, [id, id]);
  for (const [index, { args, options }] of calls.entries()) {
    assert(!args.includes(input));
    assert.equal(options.cwd, directory);
    assert(!options.shell);
    for (const flag of ["--safe-mode", "--restricted", "--strict-mcp-config", "--disable-slash-commands"]) assert(args.includes(flag));
    assert.equal(args[args.indexOf("--tools") + 1], "");
    assert.equal(args[args.indexOf("--disallowedTools") + 1], "*");
    assert.equal(args[args.indexOf("--permission-mode") + 1], "dontAsk");
    assert.deepEqual(JSON.parse(args[args.indexOf("--settings") + 1]).permissions.deny, ["Read(//**)"]);
    assert.equal(args[args.indexOf(index ? "--resume" : "--session-id") + 1], id);
    assert(!args.includes("--continue"));
  }
  await assert.rejects(run("needs sign-in"), error => /claude auth login/.test(error.message) && !error.message.includes("Private"));
  await assert.rejects(run("missing session", id), error => /new chat/i.test(error.message) && !error.message.includes("Private"));
  await assert.rejects(run("different session", id), /session/i);
  await assert.rejects(run("empty answer", id), /response|reply|answer/i);
  assert.deepEqual(confirmed, [id, id]);

  const controller = new AbortController();
  const pending = run("wait for stop", id, controller.signal);
  let closed = false;
  child.once("close", () => { closed = true; });
  await once(child.stderr, "data", { signal: AbortSignal.timeout(10_000) });
  controller.abort();
  await assert.rejects(pending, /interrupt/i);
  assert.equal(closed, true);
  assert.deepEqual(confirmed, [id, id]);
});

test("a missing local Claude executable reports setup and leaves the session unassigned", async t => {
  const directory = await fixture(t);
  const path = process.env.PATH;
  process.env.PATH = directory;
  try {
    await assert.rejects(runClaude(directory, undefined, "Hello", () => assert.fail("Unexpected session"),
      new AbortController().signal), /Install Claude Code on PATH.*claude auth login/);
  } finally { process.env.PATH = path; }
});
