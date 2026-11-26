import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { CopilotClient } from "@microsoft/copilot-sdk";
import { startServer } from "../dist/server/server.js";
import { RepositoryFiles } from "../dist/server/chat-files.js";
import { displayText } from "../dist/server/chat-model.js";
import { fixture } from "./fixture.mjs";

function request(server, path, body, origin = server.url) {
  return fetch(server.url + "/api/" + path, body === undefined ? {} : {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

test("redacts complete credentials before paging, including requests that start inside a field", async t => {
  const root = await realpath(await fixture(t));
  const files = new RepositoryFiles(root);
  const page = 24_576;
  const token = "ghp_" + "fixture".repeat(7);
  const assigned = "A".repeat(90_000) + " synthetic quoted tail";
  const pemBody = ("syntheticBase64Line".repeat(8) + "\n").repeat(900);
  const samples = [
    { source: token, hidden: "fixture", at: 16 },
    { source: 'password = "' + assigned + '"', hidden: "synthetic quoted tail", at: 85_000 },
    { source: 'secretoken = "' + assigned + '"', hidden: "synthetic quoted tail", at: 85_000 },
    { source: "-----BEGIN EC PRIVATE KEY-----\n" + pemBody + "-----END EC PRIVATE KEY-----", hidden: "syntheticBase64Line", at: 80_000 },
    { source: "Bearer\n " + "field".repeat(12), hidden: "field", at: 28 },
    { source: "https://user:" + "sensitive".repeat(9) + "@example.test/", hidden: "sensitive", at: 40 }
  ];
  for (const { source, hidden, at } of samples) {
    const prefix = "entry. ".repeat(Math.floor((page - 9) / 7));
    const sourceText = prefix + source + "\nPublic continuation.\n";
    await writeFile(join(root, "text"), sourceText);
    let offset = 0, assembled = "";
    do {
      const result = await files.read("text", offset);
      assert(!result.text.includes(hidden));
      assembled += result.text;
      offset = result.nextOffset;
    } while (offset !== null);
    assert.equal(assembled, displayText(sourceText));
    const interior = await files.read("text", Buffer.byteLength(prefix) + at);
    assert(!interior.text.includes(hidden));
    assert(!interior.text.includes("AAAA"));
    assert(interior.text.endsWith("Public continuation.\n") || interior.nextOffset !== null);
  }
  const malformedKey = "-----BEGIN PRIVATE KEY-----\nunfinished synthetic material";
  await writeFile(join(root, "text"), malformedKey);
  assert(!((await files.read("text", 30)).text.includes("unfinished")));
  const nested = ("-----BEGIN PRIVATE KEY-----\n" + "synthetic material\n").repeat(12_000);
  await writeFile(join(root, "nested"), nested);
  assert.deepEqual(await files.read("nested", Buffer.byteLength(nested) - 100), { path: "nested", text: "", nextOffset: null });
  const compound = "sk-" + "sk-test-part-".repeat(55_000);
  await writeFile(join(root, "compound"), compound);
  const inside = await files.read("compound", 100_000);
  assert.deepEqual(inside, { path: "compound", text: "", nextOffset: compound.length - 1 });
  assert.deepEqual(await files.read("compound", inside.nextOffset), { path: "compound", text: "-", nextOffset: null });
});

test("keeps safe large files byte-paged, preserves UTF-8 boundaries and rejects malformed or binary content", async t => {
  const root = await realpath(await fixture(t));
  const files = new RepositoryFiles(root);
  const page = 24_576;
  const ascii = "long ordinary line. ".repeat(145_000);
  await writeFile(join(root, "large"), ascii);
  for (const offset of [0, page, page * 70, ascii.length - 16, ascii.length + 4]) {
    const result = await files.read("large", offset);
    assert.equal(result.text, ascii.slice(offset, offset + page));
    assert.equal(result.nextOffset, offset + page < ascii.length ? offset + page : null);
  }
  const prefix = ".".repeat(page - 2);
  await writeFile(join(root, "unicode"), prefix + "🌏łąka");
  const first = await files.read("unicode");
  assert.equal(first.text, prefix);
  assert.equal(first.nextOffset, page - 2);
  assert.equal((await files.read("unicode", first.nextOffset)).text, "🌏łąka");
  assert.equal((await files.read("unicode", page)).text, "łąka");
  for (const data of [Buffer.from([0x41, 0x00, 0x42]), Buffer.from([0x41, 0xc0, 0xaf]), Buffer.from([0xe2, 0x82])]) {
    await writeFile(join(root, "bad"), data);
    await assert.rejects(files.read("bad"), error => error.status === 400 && /binary|UTF-8/i.test(error.message));
  }
  const controller = new AbortController();
  const reading = files.read("large", ascii.length - 100, controller.signal);
  setImmediate(() => controller.abort(new Error("Stopped paged file read.")));
  await assert.rejects(reading, /Stopped paged file read/);
});

async function isolatedState(t) {
  const old = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = await fixture(t);
  t.after(() => { if (old === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = old; });
}

test("configures a project explicitly, guards stale changes, and keeps chats with their provider", async t => {
  let board;
  t.after(() => board?.close());
  await isolatedState(t);
  const repo = await fixture(t);
  await mkdir(join(repo, ".workflow"));
  board = await startServer(repo);
  const settings = () => request(board, "settings").then(r => r.json());
  const save = (provider, expectedProvider) => request(board, "settings", { provider, expectedProvider });
  assert.deepEqual(await settings(), { provider: null });
  assert.equal((await request(board, "chats", {})).status, 409);
  assert.equal((await request(board, "settings", { provider: "codex", expectedProvider: null }, "https://external.example")).status, 403);
  assert.equal((await save("constructor", null)).status, 400);
  assert.equal((await save("claude", null)).status, 200);
  assert.equal((await save("copilot", null)).status, 409);
  const created = await request(board, "chats", { expectedProvider: "claude" });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  await board.close();
  board = await startServer(repo);
  assert.deepEqual(await settings(), { provider: "claude" });
  assert.equal((await save("copilot", "claude")).status, 200);
  assert.equal((await request(board, "chats", { expectedProvider: "claude" })).status, 409);
  const oldChat = await (await request(board, "chats/" + id)).json();
  assert.equal(oldChat.provider, "claude");
  assert.equal((await request(board, "chats/" + id + "/messages", { text: "Stay with my selected provider" })).status, 409);
  assert.deepEqual((await (await request(board, "chats/" + id)).json()).entries, []);
  const { id: next } = await (await request(board, "chats", { expectedProvider: "copilot" })).json();
  assert.equal((await (await request(board, "chats/" + next)).json()).provider, "copilot");
  assert.equal((await request(board, "chats/" + next + "/messages", { text: "Stale tab", expectedProvider: "claude" })).status, 409);
  assert.equal((await save("claude", "copilot")).status, 200);
  const previousHome = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = join(repo, "claude-state");
  try {
    const blocked = await request(board, "chats/" + id + "/messages", { text: "Keep my transcript out of Git" });
    assert.equal(blocked.status, 422);
    assert.match(await blocked.text(), /CLAUDE_CONFIG_DIR outside this project/);
    assert.deepEqual((await (await request(board, "chats/" + id)).json()).entries, []);
  } finally { if (previousHome === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = previousHome; }
});

test("shares the setting across linked Git worktrees, isolates another clone and leaves Git clean", async t => {
  const boards = [];
  t.after(() => Promise.all(boards.map(board => board.close())));
  await isolatedState(t);
  const repo = await fixture(t);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet");
  await mkdir(join(repo, ".workflow"));
  await writeFile(join(repo, ".workflow", "README.md"), "Workflow fixture\n");
  git("add", ".workflow");
  git("-c", "user.name=Board Test", "-c", "user.email=board@example.test", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "test: create board project");
  const linked = await fixture(t);
  git("worktree", "add", "--quiet", "--detach", linked, "HEAD");
  const clone = await fixture(t);
  git("clone", "--quiet", "--local", repo, clone);
  for (const root of [repo, linked, clone]) boards.push(await startServer(root));
  assert.equal((await request(boards[0], "settings", { provider: "claude", expectedProvider: null })).status, 200);
  await request(boards[0], "chats", {});
  assert.deepEqual(await (await request(boards[1], "settings")).json(), { provider: "claude" });
  assert.deepEqual(await (await request(boards[1], "chats")).json(), []);
  assert.deepEqual(await (await request(boards[2], "settings")).json(), { provider: null });
  process.env.XDG_STATE_HOME = join(linked, "board-state");
  const invalid = await startServer(repo);
  boards.push(invalid);
  const blocked = await request(invalid, "settings", { provider: "codex", expectedProvider: null });
  assert.equal(blocked.status, 422);
  assert.match(await blocked.text(), /outside this project/);
  for (const root of [repo, linked, clone]) assert.equal(git("-C", root, "status", "--porcelain", "--untracked-files=all"), "");
});

test("adopts a saved Codex chat without choosing the project's first provider", async t => {
  let server;
  t.after(() => server?.close());
  await isolatedState(t);
  const repo = await realpath(await fixture(t));
  await mkdir(join(repo, ".workflow"));
  const directory = join(process.env.XDG_STATE_HOME, "wf-agent", createHash("sha256").update(repo).digest("hex"));
  await mkdir(directory, { recursive: true });
  const old = { id: randomUUID(), title: "Before setup", updated: 1, thread: "original-codex-thread" };
  const db = new DatabaseSync(join(directory, "chats.sqlite"));
  try {
    db.exec("CREATE TABLE chats (id TEXT PRIMARY KEY, title TEXT, updated INTEGER, state TEXT); CREATE TABLE entries (chat TEXT, id TEXT, value TEXT, UNIQUE(chat,id));");
    db.prepare("INSERT INTO chats VALUES(?,?,?,?)").run(old.id, old.title, old.updated, JSON.stringify(old));
    db.prepare("INSERT INTO entries VALUES(?,?,?)").run(old.id, "reply", JSON.stringify({ id: "reply", kind: "assistant", title: "Codex", text: "Saved answer" }));
    server = await startServer(repo);
    assert.deepEqual(await (await request(server, "settings")).json(), { provider: null });
    const view = await (await request(server, "chats/" + old.id)).json();
    assert.equal(view.provider, "codex");
    assert.equal(view.entries[0].text, "Saved answer");
    assert.deepEqual(JSON.parse(db.prepare("SELECT state FROM chats WHERE id=?").get(old.id).state), { ...old, provider: "codex" });
  } finally { db.close(); }
});

test("sends only the selected board document and validated text to the project's provider", async t => {
  let server;
  t.after(() => server?.close());
  await isolatedState(t);
  const repo = await fixture(t);
  const change = ".workflow/changes/LOCAL-1-board";
  const ticket = change + "/2.todo/001-context";
  const archive = ".workflow/archive/2026-11-26-LOCAL-2-record";
  await mkdir(join(repo, ticket), { recursive: true });
  await mkdir(join(repo, archive), { recursive: true });
  await writeFile(join(repo, change, "CONTEXT.md"), "# Current change");
  await writeFile(join(repo, ticket, "TICKET.md"), "# Current ticket");
  await writeFile(join(repo, archive, "SUMMARY.md"), "---\nchange: LOCAL-2-record\narchived: 2026-11-26\noutcome: completed\n---\n# Archived record");
  await writeFile(join(repo, "note.txt"), "Board note\nsecret = disposable-test-marker");
  await writeFile(join(repo, "big.txt"), Buffer.alloc(96 * 1024, 65));
  await writeFile(join(repo, "image.bin"), Buffer.from([1, 0, 2]));
  const outside = await fixture(t);
  await writeFile(join(outside, "private.txt"), "Outside");
  await symlink(outside, join(repo, "outside"), "junction");

  const prompts = [];
  const resumed = [];
  const session = { sessionId: randomUUID(), permissionModeResult: { mode: "manual" }, sendAndWait: async ({ prompt }) => {
    prompts.push(JSON.parse(prompt.split("\n\n").at(-1)));
    return { data: { content: "Received board context" } };
  } };
  const peer = CopilotClient.prototype;
  t.mock.method(peer, "start", async () => {});
  t.mock.method(peer, "getAuthStatus", async () => ({ isAuthenticated: true }));
  t.mock.method(peer, "createSession", async () => session);
  t.mock.method(peer, "resumeSession", async id => { resumed.push(id); return session; });
  t.mock.method(peer, "stop", async () => []);
  server = await startServer(repo);
  await request(server, "settings", { provider: "copilot", expectedProvider: null });
  const { id } = await (await request(server, "chats", {})).json();
  const path = "chats/" + id;
  const send = (selection, files) => request(server, path + "/messages", { text: "Describe the supplied material", selection, files });
  async function completed(selection, files) {
    assert.equal((await send(selection, files)).status, 202);
    const signal = AbortSignal.timeout(10_000);
    while ((await (await request(server, path)).json()).running) await delay(20, undefined, { signal });
    const view = await (await request(server, path)).json();
    assert.equal(view.entries.at(-1).title, "GitHub Copilot");
    return prompts.at(-1).documents;
  }
  assert.deepEqual(await completed({ change: "LOCAL-1-board" }, [change + "/CONTEXT.md", "note.txt"]), [
    { path: change + "/CONTEXT.md", text: "# Current change" }, { path: "note.txt", text: "Board note\nsecret = [redacted]" }
  ]);
  assert.deepEqual(await completed({ change: "LOCAL-1-board", ticket: "001-context" }, []), [{ path: ticket + "/TICKET.md", text: "# Current ticket" }]);
  assert.match((await completed({ change: "archived 2026-11-26-LOCAL-2-record" }, []))[0].text, /# Archived record/);
  assert.deepEqual(resumed, [session.sessionId, session.sessionId]);
  const prior = (await (await request(server, path)).json()).entries;
  for (const [file, status] of [["image.bin", 400], ["missing.txt", 404], ["outside/private.txt", 400], ["big.txt", 413]]) {
    const response = await send({ change: "LOCAL-1-board" }, [file]);
    assert.equal(response.status, status);
    assert((await response.text()).includes(file));
  }
  assert.deepEqual((await (await request(server, path)).json()).entries, prior);
  assert.equal(prompts.length, 3);
});
