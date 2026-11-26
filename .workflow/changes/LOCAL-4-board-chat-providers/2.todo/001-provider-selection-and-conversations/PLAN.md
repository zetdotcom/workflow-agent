---
created: 2026-11-26
updated: 2026-11-26
---

# Implementation plan

## Grounding

The dock currently creates a chat with an empty JSON object. The SQLite store keeps a native thread ID in the chat state. The server always calls `runCodex` and supplies board tools through the Codex app-server. In a ticket, change or archive panel, the board already knows the selected document. The existing Playwright suite covers a saved empty chat, a resumed thread and an authorized workflow.

The archived LOCAL-2 delivery contract establishes that a proposal, an authorized execution and a verified PR receipt are distinct. This change keeps those operations in the existing Codex path.

## Implementation

Deliver one end-to-end feature across the following components. The two provider adapters have independent implementations and share the same chat and context contract.

1. **Selection and history.** Add a typed provider catalog for Codex, Copilot and Claude. Accept a provider on chat creation and reject unknown values. Persist it in SQLite, migrate existing records to Codex once, and expose it in chat summaries and views. Derive every send from the stored chat. Show provider choice on the first and new-chat paths, and the active provider on the saved-chat and composer paths.
2. **Discussion context.** Resolve the active change, ticket or archived record and deduplicate it with attached files. Read through `RepositoryFiles`, apply its text redaction, and enforce a combined 96 KiB file budget. Reject bad inputs before recording the message. Use the existing claim, Stop and transcript lifecycle. Dispatch discussion outside the checkout using a private directory under the board’s per-repository state.
3. **Provider runtimes.** Use the Microsoft Copilot SDK’s version-matched stdio runtime in empty mode. Deny tools and config discovery on create and resume. Use the signed-in Claude Code CLI with safe mode, an empty tool set, strict MCP configuration and structured output. Both adapters bind the native session, return a public answer, and stop the owned runtime when cancelled. Recheck the run identity before persisting a result. Document sign-in and capability differences.
4. **Verification and delivery.** Exercise the production server and browser, run the repository checks, independently review the aggregate diff, and save evidence in this ticket. Publish the feature branch into a PR targeting GitHub main.

## Specification verification

| Scenario | Evidence |
| --- | --- |
| Choose and identify the assistant | HTTP creation, invalid provider, first collapsed send, independent empty new chat and saved-chat labels in the real browser. |
| Reopen and resume | Open SQLite containing a pre-provider chat, reopen and send follow-ups, assert exact provider/session on subsequent turns. Test a failed resume. |
| Discuss selected work | Exercise the real context builder with active, ticket and archive selections, duplicate attachments, redaction, binary, missing, external and oversized files. |
| Stop or fix setup | Exercise provider process or SDK cancellation, session errors and cleanup. Smoke the real runtimes with synthetic text and record authentication constraints. |
| Use workflow actions | Run the existing Codex proposal, permission, execution and PR receipt tests. Check the provider capability hint and discussion tool restrictions. |

## Project checks

From `wf-agent` run `npm ci`, `npm run test:browser:install` and `npm test`. From the repository root run `./scripts/verify.sh` and the installed workflow metadata validator. The release check includes the packaged board launched with `node wf-agent/bin/wf-agent.js --no-open`. Hosted inference requires an active provider entitlement and is recorded separately from deterministic protocol coverage.

## Dependencies and rollout

Pin the maintained Copilot SDK with its native runtime. Its macOS arm64 runtime adds approximately 200 MB on disk. Load that integration only for Copilot turns. Claude Code is a locally installed executable. The one-time SQLite update adds a provider to previously saved records without altering their thread IDs or transcript entries. [Copilot SDK v2](https://github.com/microsoft/copilot-sdk/blob/main/docs/v2-breaking-changes.md) · [Claude Code CLI](https://code.claude.com/docs/en/cli-reference)
