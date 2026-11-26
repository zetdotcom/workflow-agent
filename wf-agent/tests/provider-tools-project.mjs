import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const date = "2026-11-26";
export const workflowDocument = body => "---\ncreated: " + date + "\nupdated: " + date + "\n---\n\n" + body + "\n";
const title = id => id.slice(4).replace(/-/g, " ").replace(/^./, initial => initial.toUpperCase());

export function checkoutStatus(todo, note, done = []) {
  const rows = ids => ids.map(id => "- `" + id.slice(0, 3) + "` " + title(id)).join("\n");
  return [
    "---\nupdated: " + date + "\n---", "# Checkout", "## Progress: " + done.length + "/" + (todo.length + done.length) + " done",
    todo.length && "### Todo\n\n" + rows(todo), done.length && "### Done\n\n" + rows(done), note
  ].filter(Boolean).join("\n\n") + "\n";
}

export async function plannedCheckout(repository, tickets) {
  const change = join(repository, ".workflow", "changes", "SHOP-8-checkout");
  for (const stage of ["1.draft", "2.todo", "3.in-progress", "4.done"]) await mkdir(join(change, stage), { recursive: true });
  await writeFile(join(change, "CONTEXT.md"), workflowDocument("# Checkout\n\n## Goal\n\nSend receipts."));
  await writeFile(join(change, "STATUS.md"), checkoutStatus(tickets));
  for (const id of tickets) {
    const directory = join(change, "2.todo", id);
    await mkdir(directory);
    await writeFile(join(directory, "TICKET.md"), workflowDocument("# " + id.slice(0, 3) + " — " + title(id)));
    for (const name of ["SPEC.md", "PLAN.md", "PLAN-BRIEF.md"]) {
      await writeFile(join(directory, name), workflowDocument("# " + title(id) + "\n\n" + name));
    }
  }
  return change;
}

export async function completeTestDelivery(repository, action, { url, draft = false, head = action.baselineHead, omitFingerprint = false }) {
  const change = join(repository, ".workflow", "changes", action.change);
  const todo = join(change, "2.todo", action.ticket);
  const baselinePaths = execFileSync("git", ["status", "--porcelain=v1", "-z"], { cwd: repository });
  const fingerprint = createHash("sha256").update(baselinePaths).digest("hex");
  const evidence = draft
    ? "Runtime limitation: browser unavailable. Human action: open the changed page and verify the ticket flow."
    : "Implementation, verification and independent review completed.";
  const journal = [
    "---", "created: " + date, "updated: " + date, "state: delivered-to-review",
    "spec_identity: " + action.specIdentity, "plan_identity: " + action.planIdentity,
    "baseline_branch: " + action.branch, "baseline_head: " + head,
    ...(omitFingerprint ? [] : ["baseline_paths_fingerprint: " + fingerprint]),
    "active_phase: 0", "completed_phases: 1", "phase_attempts: 1", "review_cycle: 1",
    "delivery_kind: " + (draft ? "draft" : "ready"), "runtime_limitation_recorded: " + (draft ? "yes" : "no"),
    "browser_verification: " + (draft ? "unavailable" : "not-applicable"), "completion_recorded: yes", "push_result: success",
    "pr_url: " + url, "---", "", "# Delivery", "", evidence, ""
  ].join("\n");
  await writeFile(join(todo, "TO-PR.md"), journal);
  await writeFile(join(todo, "PROGRESS.md"), workflowDocument("# Progress\n\n" + evidence));
  await rename(todo, join(change, "4.done", action.ticket));
  const [remaining, completed] = await Promise.all([readdir(join(change, "2.todo")), readdir(join(change, "4.done"))]);
  await writeFile(join(change, "STATUS.md"), checkoutStatus(remaining.sort(), undefined, completed.sort()));
}
