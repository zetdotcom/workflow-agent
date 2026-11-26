---
created: 2026-11-26
updated: 2026-11-26
---
# Implementation plan

The two requested stages share the provider dispatch and permission boundary. Ship them in one PR on the provider-selection branch.

## Repository findings

- `server/codex.ts` owns the four schemas. `server/chat.ts` dispatches them only in the Codex branch and hardcodes Codex in the approval path.
- `server/chat-files.ts`, `chat-store.ts` and `project-state.ts` enforce the checkout boundary, pending proposal, transaction claim and external state.
- The archived LOCAL-2 design requires real fresh-agent dispatch, independent review, bounded repair, journal-based ready or qualified draft delivery and explicit prerequisites. Use the current canonical skill under `skills/wf`.
- The npm package contains only `bin` and `dist`. Stage the canonical skill tree in the distributable at build time and test packed contents from outside the source checkout.

## Stage 1 — Board-owned tools

1. Share the tool schemas, board instructions and callback contract. Keep Codex's app-server representation and behavior. Route validated lookup, reads and proposal calls through one run-bound server handler.
2. Register only board tools in Claude's explicit private stdio MCP session and Copilot's SDK custom tool surface. Re-register on resume. Preserve native sign-in, direct attachments and distinct session identities. Record public calls without copying raw provider diagnostics.
3. Exercise search, paged reads and proposals for each provider with Codex missing. Cover denial of external files, ambient tools and model attempts to execute a proposal.

## Stage 2 — Selected-provider execution

1. Capture the saved provider in the same SQLite transaction that claims an approved workflow. Revalidate its target before invoking the native worker. Keep a fresh execution session and leave the original conversation thread available.
2. Supply the packaged skill and command reference. Use checkout-scoped native tools for approved work, scope status writes to eligible STATUS.md paths, expose provider-native subagents for ticket-to-PR, and send permission requests to the existing board dialog. Verify Stop and cancellation while permission is outstanding.
3. Harden receipt handling for ready and qualified draft outcomes. Update Settings, approval copy and user documentation. Assert the two providers never launch or depend on Codex.

## Verification

| Scenario | Evidence |
| --- | --- |
| Search from a conversation | Shared repository tests, actual native tool registration and invocation, resumed session and boundary cases. |
| Propose and authorize | Public board API and browser checks for preview, denied/accepted actions, changed inputs and provider ownership. |
| Execute without Codex | Exercise native CLI and SDK with absent Codex, actual checkout effects, scope of permission prompts and fresh-agent capability. Inspect npm tarball. |
| Stop, restart and report delivery | Stop/cancel tests, original-session continuation, matching ready/draft journal and false-delivery rejection. |
| Protected behavior | Run `npm test` in `wf-agent`, `./scripts/verify.sh`, workflow validator and cross-platform CI. Record external credential limitations separately. |
