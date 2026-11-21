import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { startServer } from "../../dist/server/server.js";
import { fixture } from "./fixture.mjs";

test("read-only board keeps ticket details open across moves and lists archived summaries", async t => {
  const repository = await fixture(t);
  const data = join(repository, ".workflow");
  const id = "SHOP-8-checkout";
  const change = join(data, "changes", id);
  const ticket = "001-receipts";
  const source = join(change, "2.todo", ticket);
  await mkdir(source, { recursive: true });
  await mkdir(join(change, "4.done"));
  await writeFile(join(change, "CONTEXT.md"), "# Checkout\n\n## Goal\n\nSend receipts.");
  await writeFile(join(source, "TICKET.md"), "# 001 — Receipts\n\n## Summary\n**Goal:** Confirm the order.\n**Scope:** Orders\n**Acceptance Criteria:**\n- [ ] Receipt delivered");
  await writeFile(join(source, "PLAN.md"), "# Delivery plan\n\nDeliver by **email**.");
  const server = await startServer(repository);
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(server.url);
      await page.getByRole("region", { name: "To Do", exact: true }).getByRole("link", { name: /Checkout/ }).click();
      await page.getByRole("dialog").getByText("Send receipts.").waitFor();
      await page.getByRole("link", { name: /001 Receipts/ }).click();
      await page.getByText("Confirm the order.", { exact: true }).waitFor();
      await page.getByText("Plan", { exact: true }).click();
      await page.locator("details[open]").getByText("email", { exact: true }).waitFor();
      await rename(source, join(change, "4.done", ticket));
      await page.getByRole("dialog").getByText("Done", { exact: true }).waitFor();
      assert.equal(await page.locator("details[open]").count(), 1);
      await page.getByRole("link", { name: "Close details" }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.getByRole("region", { name: "Done", exact: true }).getByText("1 of 1 done").waitFor();

      const archive = join(data, "archive", "2026-08-12-" + id);
      await mkdir(archive, { recursive: true });
      await writeFile(join(archive, "SUMMARY.md"), "---\nchange: " + id + "\narchived: 2026-08-12\noutcome: completed\n---\n# Checkout\n\n## Outcome\n\nReceipts delivered.");
      await rename(change, join(repository, "archived-working-files"));
      await page.getByRole("region", { name: "Done", exact: true }).getByRole("link", { name: /Checkout/ }).waitFor({ state: "detached" });
      await page.getByRole("link", { name: "Archive", exact: true }).click();
      await page.getByRole("link", { name: /Checkout/ }).click();
      await page.getByText("Receipts delivered.").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.deepEqual(errors, []);
      assert.equal((await fetch(server.url + "/api/board", { method: "POST" })).status, 405);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
