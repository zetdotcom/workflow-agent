import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { startServer } from "../dist/server/server.js";
import { fixture } from "./fixture.mjs";

test("switches between changes and tickets, drills into a change, and tracks live moves", async t => {
  const repository = await fixture(t);
  const data = join(repository, ".workflow");
  const id = "SHOP-8-checkout";
  const change = join(data, "changes", id);
  const ticket = "001-receipts";
  const source = join(change, "2.todo", ticket);
  await mkdir(source, { recursive: true });
  await mkdir(join(change, "4.done"));
  await writeFile(join(change, "CONTEXT.md"), "# Checkout\n\n## Goal\n\nSend **receipts**.");
  await writeFile(join(source, "TICKET.md"), "# 001 — Receipts\n\n## Summary\n**Goal:** Confirm the order.\n**Scope:** Orders\n**Acceptance Criteria:**\n- [ ] Receipt delivered");
  await writeFile(join(source, "PLAN.md"), "# Delivery plan\n\nDeliver by **email**.");
  const otherChange = join(data, "changes", "SHOP-9-catalog");
  const otherTicket = join(otherChange, "3.in-progress", "001-products");
  await mkdir(otherTicket, { recursive: true });
  await writeFile(join(otherChange, "CONTEXT.md"), "# Catalog\n\n## Goal\n\nManage products.");
  await writeFile(join(otherTicket, "TICKET.md"), "# 001 — Products");
  const emptyChange = join(data, "changes", "SHOP-10-shipping");
  await mkdir(emptyChange, { recursive: true });
  await writeFile(join(emptyChange, "CONTEXT.md"), "# Shipping");
  const server = await startServer(repository);
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const lane = name => page.getByRole("region", { name, exact: true });
      const changesView = page.getByRole("link", { name: "Changes", exact: true });
      const ticketsView = page.getByRole("link", { name: "Tickets", exact: true });
      const receiptCard = page.getByRole("link", { name: "001 Receipts" });
      const back = page.getByRole("link", { name: "Back to changes" });
      const dialog = page.getByRole("dialog");
      const close = page.getByRole("button", { name: "Close details" });

      await page.goto(server.url);
      assert.equal(await changesView.getAttribute("aria-current"), "page");
      const checkout = lane("To Do").getByRole("link", { name: /Checkout/ });
      await checkout.getByText("Send receipts.", { exact: true }).waitFor();
      await ticketsView.click();
      await lane("To Do").getByRole("link", { name: "001 Receipts" }).waitFor();
      await lane("In Progress").getByRole("link", { name: "001 Products" }).waitFor();
      assert.equal(await ticketsView.getAttribute("aria-current"), "page");
      await page.reload();
      await receiptCard.click();
      await dialog.getByText("Confirm the order.", { exact: true }).waitFor();
      await close.click();
      await dialog.waitFor({ state: "detached" });
      assert.equal(await ticketsView.getAttribute("aria-current"), "page");
      await page.goBack();
      await checkout.waitFor();

      await ticketsView.click();
      await page.getByRole("link", { name: "Parent change SHOP-8" }).click();
      await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "001 Products" }).count(), 0);
      await page.goBack();
      await lane("In Progress").getByRole("link", { name: "001 Products" }).waitFor();
      await changesView.click();
      await checkout.click();
      await page.getByRole("link", { name: "Change details" }).click();
      await dialog.getByText("Send receipts.").waitFor();
      await close.click();
      await dialog.waitFor({ state: "detached" });
      await lane("To Do").getByRole("link", { name: "001 Receipts" }).click();
      await page.getByText("Confirm the order.", { exact: true }).waitFor();
      await page.getByText("Plan", { exact: true }).click();
      await page.locator("details[open]").getByText("email", { exact: true }).waitFor();
      await rename(source, join(change, "4.done", ticket));
      await dialog.getByText("Done", { exact: true }).waitFor();
      assert.equal(await page.locator("details[open]").count(), 1);
      await page.goBack();
      await dialog.waitFor({ state: "detached" });
      await lane("Done").getByRole("link", { name: "001 Receipts" }).waitFor();
      await page.reload();
      await lane("Done").getByRole("link", { name: "001 Receipts" }).waitFor();
      await back.click();
      await lane("Done").getByText("1 of 1 done").waitFor();
      await lane("Draft").getByRole("link", { name: /Shipping/ }).click();
      await page.getByText("No tickets yet.", { exact: true }).waitFor();
      await back.click();
      await ticketsView.click();
      await lane("Done").getByRole("link", { name: "001 Receipts" }).waitFor();

      const archive = join(data, "archive", "2026-08-12-" + id);
      await mkdir(archive, { recursive: true });
      await writeFile(join(archive, "SUMMARY.md"), "---\nchange: " + id + "\narchived: 2026-08-12\noutcome: completed\n---\n# Checkout\n\n## Outcome\n\nReceipts delivered.");
      await rename(change, join(repository, "archived-working-files"));
      await receiptCard.waitFor({ state: "detached" });
      await page.getByRole("link", { name: "Archive", exact: true }).click();
      await page.getByRole("link", { name: /Checkout/ }).click();
      await page.getByText("Receipts delivered.").waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.deepEqual(errors, []);
      assert.equal((await fetch(server.url + "/api/board", { method: "POST" })).status, 405);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
