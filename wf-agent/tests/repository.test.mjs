import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rename, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBoard } from "../dist/server/repository.js";
import { fixture } from "./fixture.mjs";

test("archive order follows the recorded date across outcomes", async t => {
  const cwd = await fixture(t);
  for (const [id, date, outcome] of [["A-1-first", "2026-09-09", "completed"], ["B-2-second", "2026-10-10", "superseded"]]) {
    const dir = join(cwd, ".workflow", "archive", date + "-" + id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SUMMARY.md"), "---\nchange: " + id + "\narchived: " + date + "\noutcome: " + outcome + "\n---\n# Archived change\n\n## Outcome\n\n" + outcome);
  }
  const { archive } = await readBoard(cwd);
  assert.deepEqual(archive.map(item => item.id), ["B-2-second", "A-1-first"]);
  assert.equal(archive[0].outcome, "superseded");
  assert.match(archive[0].summary, /## Outcome/);
});

test("missing workflow explains the launch directory and exits before serving", async t => {
  const cwd = await fixture(t);
  const binary = fileURLToPath(new URL("../bin/wf-agent.js", import.meta.url));
  const result = spawnSync(process.execPath, [binary], { cwd, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(cwd));
  assert.match(result.stderr, /\.workflow/);
  assert.equal(result.stdout, "");
});

test("derives all four stages from ticket locations and ignores stale STATUS.md", async t => {
  const cwd = await fixture(t);
  const root = join(cwd, ".workflow");
  await mkdir(root);
  assert.deepEqual((await readBoard(cwd)).changes, []);
  const change = join(root, "changes", "EX-7-update");
  await mkdir(change, { recursive: true });
  await writeFile(join(change, "CONTEXT.md"), "# Update\n\n## Goal\n\nShip the update.\n");
  await writeFile(join(change, "STATUS.md"), "# Progress: 3/3 done");
  const getChange = async () => (await readBoard(cwd)).changes[0];
  assert.equal((await getChange()).stage, "Draft");
  const dirs = ["1.draft", "2.todo", "3.in-progress", "4.done"].map(dir => join(change, dir));
  for (const dir of dirs) await mkdir(dir);
  const first = "001-docs";
  await mkdir(join(dirs[0], first));
  const source = "# 001 — Docs\r\n\r\n## Summary\r\n**Goal:**\r\nReadable docs.\r\n**Scope:** Guide\r\n**Acceptance Criteria:**\r\n- [ ] Read the guide\r\n\r\n## Technical Deep-Dive\r\nHidden by default.";
  await writeFile(join(dirs[0], first, "TICKET.md"), source);
  const initial = await getChange();
  assert.equal(initial.stage, "Draft");
  assert.equal(initial.tickets[0].goal, "Readable docs.");
  assert.equal(initial.tickets[0].criteria, "- [ ] Read the guide");
  assert.deepEqual(initial.tickets[0].documents.map(item => item.label), ["Full ticket"]);
  for (let index = 1; index < dirs.length; index++) {
    await rename(join(dirs[index - 1], first), join(dirs[index], first));
    assert.equal((await getChange()).stage, ["Draft", "To Do", "In Progress", "Done"][index]);
  }
  const second = await mkdtemp(join(dirs[0], "002-"));
  await writeFile(join(second, "TICKET.md"), "# More docs");
  assert.equal((await getChange()).stage, "In Progress");
});
