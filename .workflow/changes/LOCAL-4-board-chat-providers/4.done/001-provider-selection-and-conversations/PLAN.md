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

1. **Project setup and Settings.** Resolve the project's canonical Git common directory or standalone root. Add a same-origin settings endpoint keyed by that identity in the external wf-agent state directory. A missing value prompts on board open. An explicit save enables chat. Settings can update the value with an expected-provider check. Notify other tabs and refresh on focus. Reject configuration that would write private state inside the project.
2. **Conversation ownership.** Attach the project settings database to checkout-local chat storage so a chat creation or turn claim can verify the current provider atomically. Save the provider with new chats, migrate existing chat records to Codex once, and expose provider identity in summaries and views. Keep history readable and Stop available across a settings change. The server owns routing. The client only supplies the provider it expects to guard against stale UI.
3. **Discussion context.** Resolve the active change, ticket or archived record and deduplicate it with attached files. Read through `RepositoryFiles`, apply its text redaction, and enforce a combined 96 KiB file budget. Reject bad inputs before recording the message. Use the existing claim, Stop and transcript lifecycle. Dispatch discussion outside the checkout using a private directory under the board’s per-repository state.
4. **Provider runtimes.** Use the Microsoft Copilot SDK’s version-matched stdio runtime in empty mode. Deny tools and config discovery on create and resume. Use the signed-in Claude Code CLI with safe mode, an empty tool set, strict MCP configuration and structured output. Both adapters bind the native session, return a public answer, and stop the owned runtime when cancelled. Recheck the run identity before persisting a result. Document sign-in and capability differences.
5. **Verification and delivery.** Exercise the production server and browser, run the repository checks, independently review the aggregate diff, and save evidence in this ticket. Publish the feature branch into a PR targeting GitHub main.

## Specification verification

| Scenario | Evidence |
| --- | --- |
| First-open setup and returning visits | Open an unconfigured board, save each provider through the same settings control, reopen and restart. Inspect actual browser state. |
| Project scope and privacy | Exercise independent roots and linked Git worktrees, check Git status and the external data location, and reject a state directory inside the project. |
| Change provider in Settings | Switch providers, view an old chat, try a stale write and an inactive-provider send, and create a new chat. |
| Reopen and resume | Open SQLite containing a pre-provider chat, reopen and send follow-ups, assert exact provider/session on subsequent turns. Test a failed resume. |
| Discuss selected work | Exercise the real context builder with active, ticket and archive selections, duplicate attachments, redaction, binary, missing, external and oversized files. |
| Stop or fix setup | Exercise provider process or SDK cancellation, session errors and cleanup. Smoke the real runtimes with synthetic text and record authentication constraints. |
| Use workflow actions | Run the existing Codex proposal, permission, execution and PR receipt tests. Check the provider capability hint and discussion tool restrictions. |

## Project checks

From `wf-agent` run `npm ci`, `npm run test:browser:install` and `npm test`. From the repository root run `./scripts/verify.sh` and the installed workflow metadata validator. The release check includes the packaged board launched with `node wf-agent/bin/wf-agent.js --no-open`. Hosted inference requires an active provider entitlement and is recorded separately from deterministic protocol coverage.

## Dependencies and rollout

Pin the maintained Copilot SDK with its native runtime. Its macOS arm64 runtime adds approximately 200 MB on disk. Load that integration only for Copilot turns. Claude Code is a locally installed executable. The one-time SQLite update adds a provider to previously saved records without altering their thread IDs or transcript entries. [Copilot SDK v2](https://github.com/microsoft/copilot-sdk/blob/main/docs/v2-breaking-changes.md) · [Claude Code CLI](https://code.claude.com/docs/en/cli-reference)
