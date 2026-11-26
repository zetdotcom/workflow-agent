---
created: 2026-11-26
updated: 2026-11-26
---

# Implementation and verification

### Project setup and board conversations — 2026-11-26

The board now asks for an explicit project provider at first open, saves it in external SQLite storage, and exposes changes through Settings. Linked worktrees use the same preference and individual checkouts own their transcripts. New conversations inherit the project choice. An earlier-provider conversation keeps its session, can still be read or stopped, and can resume when its provider is selected again.

The server compares the current setting when saving a change and claiming a turn. Copilot and Claude receive a bounded snapshot of selected text in a tool-free session. Codex retains its existing project tools and approval flow. The provider runtimes start on demand.

**Before implementation.** The original suite passed 13 tests. The new settings tests failed against that build because `GET /api/settings` returned an empty 404 response and the settings write returned 405.

| Specification scenario | Observed evidence |
| --- | --- |
| First-open setup and returning visits | Chromium displayed all three choices with none preselected, allowed browsing after defer, and restored the selected provider on a fresh browser and server restart. |
| Project scope and privacy | The HTTP tests opened a Git repository, a linked worktree and a separate clone. The linked boards shared the choice and had independent chat lists. The clone prompted for setup. Git status stayed clean. The server rejected storage in a linked worktree and a Claude configuration under the checkout. |
| Change provider in Settings | Two browser windows exercised concurrent saves. The stale edit could not overwrite the new setting. An old draft and its attached file remained with their original chat. Opening the new provider produced a separate chat. |
| Reopen and resume | The SQLite migration preserved the thread and transcript of a saved Codex chat and left the project choice unset. In the packaged board, live Copilot returned the value of an attached test file, then recalled the value from the same conversation after a full server restart. |
| Discuss selected work | HTTP tests covered active change, ticket and archive documents, attachment deduplication and redaction. Missing, binary, external and oversized files produced visible errors before any new transcript entry. |
| Stop or fix setup | Tests covered cancellation during Copilot startup and during a turn, and native Claude process termination. Claude Code 2.1.332 reported its real sign-in requirement in the board. Its unmodified CLI also completed create, resume and interruption against a local test inference endpoint. Hosted Anthropic inference was unavailable on the verification machine. |
| Use workflow actions | The Codex integration and browser tests passed for proposals, declining and authorizing, interrupted runs, saved pending approvals and PR receipts. The new providers' discussions have no project tools. |

**Commands.** On macOS with Node 22.14.0, `npm ci`, `npm run test:browser:install`, and `npm test` in `wf-agent` succeeded. The final suite passed 26 tests, including 10 Chromium scenarios. The independent browser smoke launched the production `wf-agent/bin/wf-agent.js --no-open` against a disposable project and used a real signed-in Copilot account. `./scripts/verify.sh` passed all repository checks. `bash skills/wf/scripts/validate-workflow.sh "$PWD"` and the installed skill validator both reported valid metadata.
