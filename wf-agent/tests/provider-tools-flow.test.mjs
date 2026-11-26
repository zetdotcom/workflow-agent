import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, delimiter, join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { CopilotClient } from "@microsoft/copilot-sdk";
import { chromium } from "playwright-core";
import { startServer } from "../dist/server/server.js";
import { commitWorkflowFixture, fixture } from "./fixture.mjs";
import { plannedCheckout, workflowDocument } from "./provider-tools-project.mjs";
import { boardScenario, draftPullRequest, examplePullRequest, permissionMarker, reconciledStatus, ticketNames } from "./provider-tools-scenario.mjs";

let browser;
before(async () => { browser = await chromium.launch(); });
after(() => browser?.close());

function isolateProvider(t, provider) {
  const originalPath = process.env.PATH;
  const nativeExecutables = ["codex", "codex.exe", "codex.cmd", join("node_modules", "@openai", "codex", "bin", "codex.js"),
    "claude", "claude.exe", "claude.cmd", join("node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe")];
  process.env.PATH = originalPath.split(delimiter).filter(directory =>
    directory && !nativeExecutables.some(name => existsSync(join(directory, name)))).join(delimiter);
  t.after(() => { process.env.PATH = originalPath; });

  const nativeSpawn = childProcess.spawn;
  const peer = fileURLToPath(new URL("claude-fixture.mjs", import.meta.url));
  const spawnSpy = t.mock.method(childProcess, "spawn", (file, args, options) => {
    assert(!/^(?:codex|codex\.exe)$/i.test(basename(file)), "The selected provider should own this workflow");
    if (provider === "claude" && /^claude(?:\.exe)?$/i.test(basename(file))) {
      return nativeSpawn(process.execPath, [peer, ...args], options);
    }
    return nativeSpawn(file, args, options);
  });
  syncBuiltinESMExports();
  t.after(() => { spawnSpy.mock.restore(); syncBuiltinESMExports(); });
}

function copilotPeer(t) {
  const client = CopilotClient.prototype;
  const connect = (sessionId, options) => ({
    sessionId,
    permissionModeResult: { applied: true, mode: "manual" },
    rpc: {
      agent: { list: async () => ({ agents: [{ name: "wf-implementer" }, { name: "wf-reviewer" }] }) },
      tools: {
        initializeAndValidate: async () => ({}),
        getCurrentMetadata: async () => ({ tools: [{ name: "task" }, { name: "bash" }] })
      }
    },
    on: () => () => {},
    abort: async () => {},
    async sendAndWait({ prompt }) {
      const text = await boardScenario({
        input: prompt, cwd: options.workingDirectory, provider: "copilot",
        async tool(name, args) {
          const handler = options.tools.definitions?.find(definition => definition.name === name)?.handler;
          assert.equal(typeof handler, "function", "Missing board tool " + name);
          const result = await handler(args, { sessionId, toolName: name, toolCallId: randomUUID(), signal: new AbortController().signal });
          return JSON.parse(typeof result === "string" ? result : result.textResultForLlm);
        },
        async permission(path, content) {
          const request = { kind: "write", canOfferSessionApproval: false, fileName: path, resolvedPath: path,
            diff: content.split("\n").map(line => "+" + line).join("\n"), intention: "Reconcile workflow status" };
          const result = await options.permissions.onRequest(request, { sessionId });
          return result.kind === "attributed" && result.result.kind === "approve-once";
        }
      });
      return { data: { content: text } };
    }
  });
  t.mock.method(client, "start", async () => {});
  t.mock.method(client, "stop", async () => []);
  t.mock.method(client, "getAuthStatus", async () => ({ isAuthenticated: true }));
  t.mock.method(client, "createSession", async options => connect(randomUUID(), options));
  t.mock.method(client, "resumeSession", async (id, options) => connect(id, options));
}

for (const [provider, label] of [["claude", "Claude Code"], ["copilot", "GitHub Copilot"]]) {
  test(label + " runs board tools and approved workflows without Codex", async t => {
    let server;
    const page = await browser.newPage();
    t.after(async () => { await page.close(); await server?.close(); });
    const repo = await fixture(t);
    const change = await plannedCheckout(repo, Object.values(ticketNames));
    const statusFile = join(change, "STATUS.md");
    const initialStatus = await readFile(statusFile, "utf8");
    commitWorkflowFixture(repo);
    const receipt = randomUUID();
    await writeFile(join(repo, "receipt.txt"), receipt + "\nsecret = private-test-marker");
    const previousState = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = await fixture(t);
    t.after(() => { if (previousState === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previousState; });
    isolateProvider(t, provider);
    if (provider === "copilot") copilotPeer(t);
    server = await startServer(repo);

    const request = (path, body) => fetch(server.url + "/api/" + path, body === undefined ? {} : {
      method: "POST", headers: { Origin: server.url, "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    await page.goto(server.url);
    const setup = page.getByRole("region", { name: "Project chat setup" });
    await setup.getByRole("radio", { name: label }).check();
    await setup.getByRole("button", { name: "Save provider" }).click();
    const dock = page.getByRole("region", { name: label + " chat" });
    await dock.getByRole("textbox").fill("Board parity: read");
    const created = page.waitForResponse(response => response.url() === server.url + "/api/chats" && response.status() === 201);
    await dock.getByRole("button", { name: "Send message" }).click();
    const { id } = await (await created).json();
    const path = "chats/" + id;
    const state = () => request(path).then(response => response.json());
    async function wait(check) {
      const timeout = AbortSignal.timeout(12_000);
      for (;;) {
        const view = await state();
        if (check(view)) return view;
        await delay(25, undefined, { signal: timeout });
      }
    }
    let view = await wait(item => !item.running && item.entries.length > 0);
    assert(view.entries.some(entry => entry.kind === "assistant" && entry.text.includes(receipt) && entry.text.includes("[redacted]")),
      "Read did not return the host's redacted file: " + view.entries.map(entry => entry.title + " " + entry.text).join("\n"));
    assert(!JSON.stringify(view).includes("private-test-marker"));
    async function propose(which) {
      assert.equal((await request(path + "/messages", { text: "Board parity: " + which })).status, 202);
      const next = await wait(item => !item.running);
      assert(next.proposal, "Expected a pending " + which + " proposal. " + next.entries.at(-1)?.text);
      return next.proposal;
    }
    const decide = (proposal, approve) => request(path + "/decision", { id: proposal.id, approve, expectedProvider: provider });
    let proposal = await propose("status");
    assert.equal(await readFile(statusFile, "utf8"), initialStatus);
    await dock.getByText("Runs with " + label, { exact: true }).waitFor();
    await dock.getByRole("button", { name: "Decline", exact: true }).click();
    await wait(item => !item.proposal);
    assert.equal(await readFile(statusFile, "utf8"), initialStatus);

    await propose("status");
    await dock.getByRole("button", { name: "Authorize and run" }).click();
    await dock.getByText(permissionMarker, { exact: false }).waitFor();
    await dock.getByRole("button", { name: "Allow", exact: true }).waitFor();
    await dock.getByRole("button", { name: "Decline", exact: true }).click();
    view = await wait(item => !item.running);
    assert(!JSON.stringify(view.entries).includes(permissionMarker));
    assert.equal(await readFile(statusFile, "utf8"), initialStatus);

    await propose("status");
    await dock.getByRole("button", { name: "Authorize and run" }).click();
    await dock.getByText(permissionMarker, { exact: false }).waitFor();
    await dock.getByRole("button", { name: "Allow", exact: true }).waitFor();
    assert.equal(await readFile(statusFile, "utf8"), initialStatus);
    await dock.getByRole("button", { name: "Allow", exact: true }).click();
    view = await wait(item => !item.running);
    assert(view.entries.some(entry => entry.title === "Status response"));
    assert(view.entries.some(entry => entry.title === "Workflow metadata validated"));
    assert(!JSON.stringify(view.entries).includes(permissionMarker));
    assert.equal(await readFile(statusFile, "utf8"), reconciledStatus(provider));

    proposal = await propose("status");
    assert.equal((await decide(proposal, true)).status, 202);
    const outstanding = (await wait(item => item.prompt)).prompt;
    await dock.getByRole("button", { name: "Stop", exact: true }).click();
    await wait(item => !item.running && !item.prompt);
    assert.equal((await request(path + "/permission", { id: outstanding.id, approve: true })).status, 409);
    assert.equal(await readFile(statusFile, "utf8"), reconciledStatus(provider));

    const previousStatusCount = view.entries.filter(entry => entry.title === "Status response").length;
    await propose("invalid-status");
    await dock.getByRole("button", { name: "Authorize and run" }).click();
    await dock.getByRole("button", { name: "Allow", exact: true }).click();
    view = await wait(item => !item.running);
    assert.equal(await readFile(statusFile, "utf8"), "Missing workflow metadata\n");
    assert.equal(view.entries.at(-1).title, "Workflow stopped");
    assert.match(view.entries.at(-1).text, /Workflow metadata validation failed\./);
    assert.equal(view.entries.filter(entry => entry.title === "Status response").length, previousStatusCount);
    await writeFile(statusFile, reconciledStatus(provider));

    proposal = await propose("ready");
    await page.goto("about:blank");
    await server.close();
    server = await startServer(repo);
    view = await state();
    assert.equal(view.proposal.id, proposal.id);
    assert(!JSON.stringify(view.entries).includes(permissionMarker));
    const other = provider === "claude" ? "copilot" : "claude";
    assert.equal((await request("settings", { provider: other, expectedProvider: provider })).status, 200);
    assert.equal((await decide(proposal, true)).status, 409);
    assert.equal((await request("settings", { provider, expectedProvider: other })).status, 200);
    const plan = join(change, "2.todo", ticketNames.ready, "PLAN.md");
    await writeFile(plan, workflowDocument("# A newly edited scope requires another preview."));
    assert.equal((await decide(proposal, true)).status, 409);
    assert.equal((await decide(proposal, false)).status, 202);

    proposal = await propose("ready");
    const competing = await Promise.all([decide(proposal, true), decide(proposal, true)]);
    assert.deepEqual(competing.map(response => response.status).sort(), [202, 409]);
    view = await wait(item => !item.running);
    assert.equal(view.entries.filter(entry => entry.title === "PR published" && entry.url === examplePullRequest).length, 1);
    proposal = await propose("draft");
    assert.equal((await decide(proposal, true)).status, 202);
    view = await wait(item => !item.running);
    assert.equal(view.entries.filter(entry => entry.title === "Draft PR published" && entry.url === draftPullRequest).length, 1);
    for (const invalid of ["unconfirmed", "wrong-head", "invalid-journal"]) {
      proposal = await propose(invalid);
      assert.equal((await decide(proposal, true)).status, 202);
      view = await wait(item => !item.running);
      assert.equal(view.entries.at(-1).title, "Workflow stopped");
      const error = invalid === "invalid-journal" ? /Workflow metadata validation failed\./ : /delivery is unconfirmed/i;
      assert.match(view.entries.at(-1).text, error);
      if (invalid === "invalid-journal") assert.match(view.entries.at(-1).text, /baseline_paths_fingerprint/);
      assert.equal(view.entries.filter(entry => entry.url).length, 2);
      assert(!view.entries.some(entry => entry.kind === "assistant" && entry.text === "The pull request has been published."));
    }
  });
}
