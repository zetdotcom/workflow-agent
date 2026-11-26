// The native peers use this deterministic conversation. The board still owns the
// tool implementations, approval transaction, transcript, and delivery checks.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkoutStatus, completeTestDelivery } from "./provider-tools-project.mjs";

export const changeName = "SHOP-8-checkout";
export const ticketNames = {
  ready: "001-ready", draft: "002-draft", unconfirmed: "003-unconfirmed", "wrong-head": "004-wrong-head",
  "invalid-journal": "005-invalid-journal", "invalid-status": "006-invalid-status"
};
export const examplePullRequest = "https://example.test/team/board/pull/17";
export const draftPullRequest = "https://example.test/team/board/pull/18";
export const permissionMarker = "Reviewed reconciliation patch content";
export const reconciledStatus = provider => checkoutStatus(Object.values(ticketNames), permissionMarker + " from " + provider + ".");

export async function boardScenario({ input, cwd, tool, permission, provider }) {
  const command = /Board parity: (read|status|ready|draft|unconfirmed|wrong-head|invalid-journal|invalid-status)\b/.exec(input)?.[1];
  if (command === "read") {
    const found = await tool("find_files", { query: "receipt.txt" });
    assert.deepEqual(found, ["receipt.txt"]);
    const result = await tool("read_file", { path: found[0] });
    return result.text;
  }
  if (command) {
    const args = { change: changeName, reason: "Requested in the board chat." };
    if (ticketNames[command]) args.ticket = ticketNames[command];
    const proposed = await tool(["status", "invalid-status"].includes(command) ? "wf_status" : "wf_to_pr", args);
    assert.equal(proposed.status, "awaiting_user_authorization");
    return "The proposal is ready to review.";
  }
  const action = JSON.parse(input.split("\n").find(line => line.startsWith("{") && line.includes('"command"')));
  assert.equal(action.change, changeName);
  const change = join(cwd, ".workflow", "changes", changeName);
  if (action.command === "status") {
    const path = join(change, "STATUS.md");
    const content = action.ticket === ticketNames["invalid-status"] ? "Missing workflow metadata\n" : reconciledStatus(provider);
    if (await permission(path, content)) await writeFile(path, content);
    return "The status request was handled.";
  }
  assert.equal(action.command, "to-pr");
  if (action.ticket !== ticketNames.unconfirmed) {
    const draft = action.ticket === ticketNames.draft;
    await completeTestDelivery(cwd, action, {
      url: draft ? draftPullRequest : examplePullRequest, draft,
      head: action.ticket === ticketNames["wrong-head"] ? "1".repeat(40) : action.baselineHead,
      omitFingerprint: action.ticket === ticketNames["invalid-journal"]
    });
  }
  // The unconfirmed case deliberately returns identical prose without a receipt.
  return "The pull request has been published.";
}
