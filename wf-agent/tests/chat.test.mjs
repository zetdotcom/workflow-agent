import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { startServer } from "../dist/server/server.js";
import { prepareAction, RepositoryFiles } from "../dist/server/chat-files.js";
import { commitWorkflowFixture, fixture, peerEnvironment } from "./fixture.mjs";
import { plannedCheckout, workflowDocument } from "./provider-tools-project.mjs";

async function plannedRepository(t) {
  const repo = await fixture(t);
  const change = await plannedCheckout(repo, ["001-receipts", "002-fails", "003-unverified"]);
  commitWorkflowFixture(repo);
  return { repo, change };
}

test("searches repository-wide with the selected file first and enforces the repository boundary", async t => {
  const repo = await fixture(t);
  const external = await fixture(t);
  await writeFile(join(external, "outside.md"), "outside");
  for (const name of [".git", "src", "nested"]) await mkdir(join(repo, name));
  const inputs = ["src/plan.md", "nested/plan.md", ".hidden", ".git/internal"];
  for (const path of inputs) await writeFile(join(repo, path), path);
  await symlink(external, join(repo, "linked"), "junction");
  const index = new RepositoryFiles(await realpath(repo));
  assert.deepEqual(await index.search("plan.md", "nested/plan.md"), ["nested/plan.md", "src/plan.md"]);
  assert.deepEqual(await index.search(".hidden"), [".hidden"]);
  assert.deepEqual(await index.search("outside"), []);
  assert.deepEqual(await index.search(".git"), []);
  assert.equal((await index.read("src/plan.md")).text, "src/plan.md");
  await assert.rejects(index.read("../outside.md"), /inside this repository/);
  await assert.rejects(index.read("linked/outside.md"), /inside this repository/);
  await assert.rejects(index.read(".git/internal"), /inside this repository/);
});

test("resumes a ticket delivery only when the approved branch contains its original baseline", async t => {
  const { repo, change } = await plannedRepository(t);
  const files = new RepositoryFiles(await realpath(repo));
  const prepare = () => prepareAction(files, "to-pr", "SHOP-8", "001", "Resume this delivery");
  const first = await prepare();
  const current = join(change, "3.in-progress", first.ticket);
  await rename(join(change, "2.todo", first.ticket), current);
  const journal = head => writeFile(join(current, "TO-PR.md"), [
    "---", "spec_identity: " + first.specIdentity, "plan_identity: " + first.planIdentity,
    "baseline_branch: " + first.branch, "baseline_head: " + head, "---", "# Delivery"
  ].join("\n"));
  const git = args => execFileSync("git", ["-c", "user.name=Board Test", "-c", "user.email=board@example.test",
    "-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" }).trim();
  git(["commit", "--allow-empty", "-m", "test: advance the branch"]);
  await journal(first.head);
  const resumed = await prepare();
  assert.equal(resumed.baselineHead, first.head);
  assert.notEqual(resumed.head, first.head);

  const unrelated = git(["commit-tree", "HEAD^{tree}", "-m", "test: create unrelated history"]);
  for (const invalid of [unrelated, "0".repeat(first.head.length)]) {
    await journal(invalid);
    await assert.rejects(prepare(), /baseline is missing from this branch's history/);
  }
});

test("routes project actions through Codex, persists chats, binds approvals, and records only evidenced delivery", async t => {
  let server;
  t.after(() => server?.close());
  const { repo, change } = await plannedRepository(t);
  const env = await peerEnvironment(t);
  const old = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  server = await startServer(repo);
  const post = (path, body, origin = server.url) => fetch(server.url + "/api/chats" + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post("", {}, "https://external.example")).status, 403);
  const { id } = await (await post("", {})).json();
  const url = "/" + id;
  const state = () => fetch(server.url + "/api/chats" + url).then(response => response.json());
  async function wait(check) {
    const limit = Date.now() + 12_000;
    do { const view = await state(); if (check(view)) return view; await delay(25); } while (Date.now() < limit);
    assert.fail("Timed out waiting for the expected chat state");
  }
  async function send(text) {
    assert.equal((await post(url + "/messages", { text })).status, 202);
    return wait(view => !view.running);
  }
  const recorded = async () => (await readFile(env.WF_TEST_CALLS, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  let view = await send("Explain the plan");
  assert(view.entries.some(entry => entry.kind === "assistant"));
  assert(!JSON.stringify(view).includes("non-public test content"));
  const first = (await recorded())[0];
  assert.deepEqual(first.tools, ["find_files", "read_file", "wf_status", "wf_to_pr"]);
  assert.equal(first.config["mcp_servers.external.enabled"], false);
  view = await send("Propose the PR");
  assert.equal(view.proposal.ticket, "001-receipts");
  assert.equal(view.proposal.command, "to-pr");
  assert.equal(view.proposal.remote, "origin");
  assert(view.proposal.plan.includes("PLAN.md"));
  assert.equal((await recorded()).filter(call => call.event === "execute").length, 0);
  await server.close(); server = await startServer(repo);
  assert.equal((await state()).proposal.id, view.proposal.id);
  const plan = join(change, "2.todo", "001-receipts", "PLAN.md");
  await writeFile(plan, workflowDocument("# A revised plan"));
  assert.equal((await post(url + "/decision", { id: view.proposal.id, approve: true })).status, 409);
  assert.equal((await recorded()).filter(call => call.event === "execute").length, 0);
  assert.equal((await post(url + "/decision", { id: view.proposal.id, approve: false })).status, 202);
  view = await send("Status of this ticket");
  assert.equal((await post(url + "/decision", { id: view.proposal.id, approve: true })).status, 202);
  const prompt = (await wait(item => item.prompt)).prompt;
  assert(prompt.detail.includes("git status"));
  assert.equal((await post(url + "/permission", { id: prompt.id, approve: true })).status, 202);
  await wait(item => !item.running);
  view = await send("Propose the PR");
  const approval = { id: view.proposal.id, approve: true };
  const results = await Promise.all([post(url + "/decision", approval), post(url + "/decision", approval)]);
  assert.deepEqual(results.map(result => result.status).sort(), [202, 409]);
  view = await wait(item => !item.running);
  assert(view.entries.some(entry => entry.kind === "diff" && entry.text.includes("calendar")));
  assert(view.entries.some(entry => entry.title.startsWith("Agent · Command") && entry.text.includes("npm run verify")));
  assert(view.entries.some(entry => entry.title === "PR published" && entry.text.includes("https://example.test/pull/17")));
  const calls = await recorded();
  assert(calls.some(call => call.event === "thread/resume" && call.threadId === first.threadId));
  const workflow = calls.filter(call => call.event === "execute" && call.action.command === "to-pr");
  assert.equal(workflow.length, 1);
  assert(workflow[0].authorizedPublication);
  assert.equal(workflow[0].skill, "wf");
  view = await send("Propose failure");
  assert.equal((await post(url + "/decision", { id: view.proposal.id, approve: true })).status, 202);
  view = await wait(item => !item.running);
  assert(view.entries.some(entry => entry.title === "Workflow stopped" && entry.text.includes("checks failed")));
  view = await send("Propose unverified delivery");
  assert.equal((await post(url + "/decision", { id: view.proposal.id, approve: true })).status, 202);
  view = await wait(item => !item.running);
  assert(view.entries.some(entry => entry.title === "Workflow stopped" && entry.text.includes("delivery is unconfirmed")));
  assert.equal(view.entries.filter(entry => entry.title === "PR published").length, 1);
  assert.equal((await post(url + "/messages", { text: "Wait for stop" })).status, 202);
  await wait(item => item.entries.some(entry => entry.title === "Codex" && entry.text === "Waiting for interruption."));
  assert.equal((await post(url + "/stop", {})).status, 202);
  view = await wait(item => !item.running);
  assert(view.entries.some(entry => entry.title === "Chat stopped" && entry.text.includes("interrupted")));
  const second = await (await post("", {})).json();
  assert.notEqual(second.id, id);
  assert.deepEqual((await (await fetch(server.url + "/api/chats/" + second.id)).json()).entries, []);
});
