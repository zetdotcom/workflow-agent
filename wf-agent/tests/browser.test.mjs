import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { commitWorkflowFixture, fixture, peerEnvironment } from "./fixture.mjs";

const launcher = fileURLToPath(new URL("../bin/wf-agent.js", import.meta.url));
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function withBoard(repository, exercise, env = {}) {
  const app = spawn(process.execPath, [launcher, "--no-open"], {
    cwd: repository,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  const closed = once(app, "close");
  const output = createInterface({ input: app.stdout });
  let stderr = "";
  app.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });

  try {
    const [line] = await Promise.race([
      once(output, "line", { signal: AbortSignal.timeout(10_000) }),
      closed.then(([code]) => { throw new Error("wf-agent exited before serving (" + code + "): " + stderr); }),
    ]);
    const launch = /^Workflow board: (http:\/\/127\.0\.0\.1:\d+)$/.exec(line);
    assert.ok(launch, "Expected a board URL from the CLI, received " + line);

    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(launch[1]);
      await exercise(page);
      assert.deepEqual(errors, [], "Uncaught browser errors");
    } finally {
      await page.close();
    }
  } finally {
    output.close();
    app.kill();
    await closed;
  }
}

async function createChange(repository, id, title, goal = "Deliver " + title.toLowerCase() + ".") {
  const change = join(repository, ".workflow", "changes", id);
  await mkdir(change, { recursive: true });
  await writeFile(join(change, "CONTEXT.md"), "# " + title + "\n\n## Goal\n\n" + goal);
  return change;
}

async function createTicket(change, folder, id, title, summary = "") {
  const ticket = join(change, folder, id);
  await mkdir(ticket, { recursive: true });
  await writeFile(join(ticket, "TICKET.md"), "# " + id.split("-")[0] + " — " + title + "\n\n" + summary);
  return ticket;
}

async function createArchive(repository, id, date, title, summary) {
  const archive = join(repository, ".workflow", "archive", date + "-" + id);
  await mkdir(archive, { recursive: true });
  await writeFile(join(archive, "SUMMARY.md"), [
    "---", "change: " + id, "archived: " + date, "outcome: completed", "---",
    "# " + title, "", "## Outcome", "", summary,
  ].join("\n"));
}

const lane = (page, name) => page.getByRole("region", { name, exact: true });
const link = (page, name) => page.getByRole("link", { name, exact: true });
const closeDetails = page => page.getByRole("button", { name: "Close details" }).click();

test("launches from the invoking repository and shows an empty board", async t => {
  const repository = await fixture(t);
  await mkdir(join(repository, ".workflow"));

  await withBoard(repository, async page => {
    await page.getByText(basename(repository), { exact: true }).waitFor();
    await page.getByRole("status").getByText("Live updates").waitFor();
    await page.getByText("0 active changes", { exact: true }).waitFor();
    assert.equal(await link(page, "Changes").getAttribute("aria-current"), "page");
    assert.equal(await page.getByText("No changes", { exact: true }).count(), 4);

    await link(page, "Tickets").click();
    await page.getByText("0 tickets", { exact: true }).waitFor();
    assert.equal(await page.getByText("No tickets", { exact: true }).count(), 4);

    await link(page, "Archive").click();
    await page.getByText("No archived changes", { exact: true }).waitFor();
    const response = await page.request.post(new URL("/api/board", page.url()).href);
    assert.equal(response.status(), 405);
  });
});

test("shows changes and tickets by stage and opens a change-scoped board", async t => {
  const repository = await fixture(t);
  const entries = [
    ["Draft", "1.draft", "SHOP-7-pricing", "Pricing", "Price table"],
    ["To Do", "2.todo", "SHOP-8-checkout", "Checkout", "Receipts"],
    ["In Progress", "3.in-progress", "SHOP-9-catalog", "Catalog", "Products"],
    ["Done", "4.done", "SHOP-10-payments", "Payments", "Refunds"],
  ];
  for (const [, folder, id, title, ticketTitle] of entries) {
    const change = await createChange(repository, id, title);
    await createTicket(change, folder, "001-ticket", ticketTitle);
  }
  await createChange(repository, "SHOP-11-shipping", "Shipping");

  await withBoard(repository, async page => {
    for (const [stage, , , title] of entries) {
      await lane(page, stage).getByRole("link").filter({ hasText: title }).waitFor();
    }
    const checkout = lane(page, "To Do").getByRole("link").filter({ hasText: "Checkout" });
    await checkout.getByText("SHOP-8", { exact: true }).waitFor();
    await checkout.getByText("Deliver checkout.", { exact: true }).waitFor();
    await checkout.getByText("0 of 1 done", { exact: true }).waitFor();

    await link(page, "Tickets").click();
    await page.reload();
    assert.equal(await link(page, "Tickets").getAttribute("aria-current"), "page");
    for (const [stage, , , , title] of entries) {
      await link(lane(page, stage), "001 " + title).waitFor();
    }

    await link(page, "Parent change SHOP-8").click();
    await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
    await page.reload();
    await link(lane(page, "To Do"), "001 Receipts").waitFor();
    assert.equal(await link(page, "001 Products").count(), 0);

    await page.getByRole("link", { name: "Back to changes" }).click();
    await lane(page, "Draft").getByRole("link").filter({ hasText: "Shipping" }).click();
    await page.getByText("No tickets yet.", { exact: true }).waitFor();
  });
});

test("opens a ticket, expands its documents, and supports reload and back navigation", async t => {
  const repository = await fixture(t);
  const change = await createChange(repository, "SHOP-8-checkout", "Checkout");
  const ticket = await createTicket(change, "2.todo", "001-receipts", "Receipts", [
    "## Summary",
    "**Goal:** Confirm the order.",
    "**Scope:** Orders",
    "**Acceptance Criteria:**",
    "- [ ] Receipt delivered",
  ].join("\n"));
  const documents = [
    ["SPEC.md", "Specification", "The buyer receives a receipt."],
    ["PLAN.md", "Plan", "Deliver by email."],
    ["PROGRESS.md", "Progress", "Email delivery verified."],
    ["REVIEWS.md", "Reviews", "Receipt format reviewed."],
  ];
  await Promise.all(documents.map(([file, , body]) => writeFile(join(ticket, file), body)));

  await withBoard(repository, async page => {
    await link(page, "Tickets").click();
    const boardUrl = page.url();
    await link(page, "001 Receipts").click();
    const dialog = page.getByRole("dialog", { name: "Receipts" });
    await dialog.getByText("Confirm the order.", { exact: true }).waitFor();
    await dialog.getByText("Orders", { exact: true }).waitFor();
    await dialog.getByText("Receipt delivered", { exact: true }).waitFor();
    await dialog.getByText("Full ticket", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("Plan brief", { exact: true }).count(), 0);
    for (const [, label, body] of documents) {
      const content = dialog.getByText(body, { exact: true });
      await content.waitFor({ state: "hidden" });
      await dialog.getByText(label, { exact: true }).click();
      await content.waitFor();
    }

    await page.reload();
    await dialog.waitFor();
    await page.goBack();
    await dialog.waitFor({ state: "detached" });
    await page.waitForURL(boardUrl);
    await page.goForward();
    await dialog.waitFor();
    await closeDetails(page);
    await page.waitForURL(boardUrl);
    await dialog.waitFor({ state: "detached" });
  });
});

test("keeps the ticket panel and expanded plan open during a live move", async t => {
  const repository = await fixture(t);
  const change = await createChange(repository, "SHOP-8-checkout", "Checkout");
  const ticket = await createTicket(change, "2.todo", "001-receipts", "Receipts");
  await writeFile(join(ticket, "PLAN.md"), "Deliver by email.");
  await mkdir(join(change, "3.in-progress"));

  await withBoard(repository, async page => {
    await lane(page, "To Do").getByRole("link").filter({ hasText: "Checkout" }).click();
    await link(lane(page, "To Do"), "001 Receipts").click();
    const dialog = page.getByRole("dialog", { name: "Receipts" });
    await dialog.getByText("Plan", { exact: true }).click();
    const plan = dialog.getByText("Deliver by email.", { exact: true });
    await plan.waitFor();
    const ticketUrl = page.url();

    await rename(ticket, join(change, "3.in-progress", basename(ticket)));
    await dialog.getByText("In Progress", { exact: true }).waitFor();
    await plan.waitFor();
    assert.equal(page.url(), ticketUrl);
    await closeDetails(page);
    await link(lane(page, "In Progress"), "001 Receipts").waitFor();
    assert.equal(await link(lane(page, "To Do"), "001 Receipts").count(), 0);
  });
});

test("keeps Change details open and moves the change to Done when its last ticket finishes", async t => {
  const repository = await fixture(t);
  const change = await createChange(repository, "SHOP-8-checkout", "Checkout", "Send **receipts**.");
  await createTicket(change, "4.done", "001-orders", "Orders");
  const unfinished = await createTicket(change, "3.in-progress", "002-receipts", "Receipts");

  await withBoard(repository, async page => {
    const checkout = lane(page, "In Progress").getByRole("link").filter({ hasText: "Checkout" });
    await checkout.getByText("1 of 2 done", { exact: true }).waitFor();
    await checkout.click();
    await link(page, "Change details").click();
    const dialog = page.getByRole("dialog", { name: "Checkout" });
    await dialog.getByText("In Progress", { exact: true }).waitFor();
    await dialog.getByText("Send receipts.", { exact: true }).waitFor();
    const detailsUrl = page.url();

    await rename(unfinished, join(change, "4.done", basename(unfinished)));
    await dialog.getByText("Done", { exact: true }).waitFor();
    await dialog.getByText("Send receipts.", { exact: true }).waitFor();
    assert.equal(page.url(), detailsUrl);
    await closeDetails(page);
    await link(lane(page, "Done"), "002 Receipts").waitFor();
    await page.getByRole("link", { name: "Back to changes" }).click();
    await lane(page, "Done").getByRole("link").filter({ hasText: "Checkout" })
      .getByText("2 of 2 done", { exact: true }).waitFor();
    assert.equal(await checkout.count(), 0);
  });
});

test("removes an archived change from the active boards and opens its saved summary", async t => {
  const repository = await fixture(t);
  const change = await createChange(repository, "SHOP-8-checkout", "Checkout");
  await createTicket(change, "4.done", "001-receipts", "Receipts");
  await createArchive(repository, "SHOP-6-orders", "2026-08-09", "Orders", "Orders shipped.");

  await withBoard(repository, async page => {
    const checkout = lane(page, "Done").getByRole("link").filter({ hasText: "Checkout" });
    await checkout.waitFor();
    await createArchive(repository, "SHOP-8-checkout", "2026-08-12", "Checkout", "Receipts delivered.");
    await rename(change, join(repository, "archived-working-files"));
    await checkout.waitFor({ state: "detached" });

    await link(page, "Tickets").click();
    await page.getByText("0 tickets", { exact: true }).waitFor();
    await link(page, "Archive").click();
    const archive = page.getByRole("region", { name: "Archived changes" });
    const records = archive.getByRole("link");
    await records.filter({ hasText: "Checkout" }).waitFor();
    assert.deepEqual(await records.getByRole("heading").allTextContents(), ["Checkout", "Orders"]);
    const newest = records.first();
    await newest.getByText("SHOP-8", { exact: true }).waitFor();
    await newest.getByText("2026-08-12", { exact: true }).waitFor();

    await newest.click();
    await page.reload();
    const dialog = page.getByRole("dialog", { name: "Checkout" });
    await dialog.getByText("Receipts delivered.", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    await newest.waitFor();
  });
});

test("recovers after an unreadable workflow file is repaired", async t => {
  const repository = await fixture(t);
  const change = join(repository, ".workflow", "changes", "SHOP-8-checkout");
  await mkdir(change, { recursive: true });

  await withBoard(repository, async page => {
    const alert = page.getByRole("alert");
    await alert.getByText(/Expected a Markdown file at .*CONTEXT\.md/).waitFor();
    await page.getByRole("status").getByText("Read error").waitFor();

    await writeFile(join(change, "CONTEXT.md"), "# Checkout\n\n## Goal\n\nSend receipts.");
    await alert.waitFor({ state: "detached" });
    await page.getByRole("status").getByText("Live updates").waitFor();
    await lane(page, "Draft").getByRole("link").filter({ hasText: "Checkout" }).waitFor();
  });
});

test("uses the bottom composer from ticket details, mentions repository files, and reopens independent chats", async t => {
  const repo = await fixture(t);
  const env = await peerEnvironment(t);
  const change = await createChange(repo, "SHOP-8-checkout", "Checkout");
  const ticket = await createTicket(change, "2.todo", "001-receipts", "Receipts");
  for (const name of ["SPEC.md", "PLAN.md", "PLAN-BRIEF.md"]) await writeFile(join(ticket, name), "# Receipts\n\n" + name);
  commitWorkflowFixture(repo);
  await writeFile(join(repo, "orders.js"), "export const orders = [];");
  await withBoard(repo, async page => {
    await link(page, "Tickets").click();
    await link(page, "001 Receipts").click();
    const dock = page.getByRole("region", { name: "Codex chat" });
    const input = dock.getByRole("textbox", { name: "Message Codex" });
    await input.fill("@");
    const first = dock.getByRole("option").first();
    await first.getByText("Current selection").waitFor();
    assert.match(await first.textContent(), /001-receipts\/TICKET\.md/);
    await input.press("Tab");
    await dock.getByRole("button", { name: /Remove .*TICKET\.md/ }).waitFor();
    await input.fill("Explain @orders");
    await dock.getByRole("option", { name: /orders\.js/ }).click();
    await dock.getByRole("button", { name: "Send message" }).click();
    await dock.getByText("The plan explains the ticket approach.").waitFor();
    await dock.getByText("Decision summary", { exact: true }).click();
    await dock.getByText("Checked the requested ticket.", { exact: true }).waitFor();
    const original = await dock.getByRole("combobox", { name: "Saved chats" }).inputValue();
    await closeDetails(page);
    await dock.getByText("The plan explains the ticket approach.").waitFor();
    await dock.getByRole("button", { name: "New chat", exact: true }).click();
    await dock.getByText("The plan explains the ticket approach.").waitFor({ state: "detached" });
    await dock.getByRole("combobox", { name: "Saved chats" }).selectOption(original);
    await dock.getByText("The plan explains the ticket approach.").waitFor();
    await input.fill("Status for SHOP-8 001");
    await dock.getByRole("button", { name: "Send message" }).click();
    await dock.getByRole("button", { name: "Authorize and run" }).waitFor();
    await dock.getByRole("button", { name: "Decline", exact: true }).click();
    await dock.getByText("Declined", { exact: true }).waitFor();
    await input.fill("Propose the PR");
    await dock.getByRole("button", { name: "Send message" }).click();
    await dock.getByRole("button", { name: "Authorize and run" }).click();
    await dock.getByText("PR published", { exact: true }).waitFor();
    assert.equal(await dock.getByRole("link", { name: "https://example.test/pull/17" }).getAttribute("href"), "https://example.test/pull/17");
    await dock.getByText("Turn diff", { exact: true }).click();
    await dock.getByText("+export const calendar = true;", { exact: true }).waitFor();
  }, env);
  await withBoard(repo, async page => {
    await page.getByRole("button", { name: "Show or hide saved chats" }).click();
    await page.getByText("Declined", { exact: true }).waitFor();
    assert.equal(await page.getByRole("combobox", { name: "Saved chats" }).locator("option").count(), 2);
  }, env);
});
