---
created: 2026-11-26
updated: 2026-11-26
---
# Native provider workflow delivery

### Stage 1 — Board tools

Before implementation, both new native board scenarios failed at repository tool use on the provider-selection build. The existing Codex board suite passed.

Claude Code and GitHub Copilot can find and read checkout files and propose a resolved workflow in both new and resumed chats. The board owns the tool handlers. It accepts one proposal per turn and keeps discussion separate from native workflow execution. Claude connects through its private stdio MCP channel. Copilot registers the four SDK tools on session creation and resume.

### Stage 2 — Approved execution

The approval transaction captures the chat's provider and checks project settings. A fresh native session receives the approved checkout, target, branch and packaged wf instructions. Status writes are limited to eligible active summaries. The board validates metadata after an approved status edit and before reporting a published PR. Ticket delivery requires native implementation and review agents and an authenticated publication mechanism.

| Specification scenario | Observed evidence |
| --- | --- |
| Search from a conversation | Both real runtimes found and read an unattached file containing a newly generated value. Tests exercised scoped file access, redaction, tool registration on resume and denial of unapproved operations. |
| Propose and authorize | Chromium showed the provider on the preview. Decline left the checkout intact. A second board approval, a changed plan and a conflicting settings change could not start another run. |
| Execute without Codex | Through the production launcher, signed-in Copilot and Claude Code 2.1.332 each changed a stale status from 0/1 to 1/1 after permission. The packaged validator accepted both repaired checkouts. The PATH for each smoke contained no Codex executable. Each provider separately dispatched distinct native implementation and review agents. |
| Stop, restart and report delivery | A pending permission could be denied or stopped. Its late response was rejected. A server restart preserved an outstanding proposal. Positive ready and draft receipts passed the canonical metadata validator. Missing journals, incorrect baselines and a journal with a missing required field produced errors without a published link. |
| Protected behavior | The existing Codex browser and HTTP delivery flows still pass. The project and provider settings suites cover checkout isolation, attachments, sign-in errors and original-session ownership. An approved status write that produced invalid frontmatter was visible as a failure. |

The signed-in Copilot smoke initially failed because the model tried a path outside the disposable checkout. The board now supplies the exact checkout and workflow target in the authorized invocation. A rerun on a fresh project passed. Claude used the installed CLI and local controlled inference. Hosted Anthropic inference was unavailable. Native worker dispatch and the board's ready/draft receipt handling were exercised separately. The provider smokes used disposable local projects and did not open external pull requests.

### Final local verification - 2026-11-26

- On macOS with Node 22.14.0, `npm test` in `wf-agent` rebuilt the server and web app. All 36 tests passed, including the two native Chromium approval flows and the Codex regression suite.
- `./scripts/verify.sh` passed skill distribution, workflow metadata and worktree checks. Both `bash skills/wf/scripts/validate-workflow.sh "$PWD"` and the installed skill validator reported three active changes, five tickets and one archived change.
- `npm pack` followed by a clean `npm install` into a temporary prefix exercised the distributable. All bundled wf files matched the canonical tree. The installed binary served a disposable project, saved both provider choices, created chats and loaded its own command references and validator.
- The independent reviewer approved the final file reader after exercising long sensitive fields, arbitrary offsets, malformed UTF-8 and cancellation. An unrelated Git history and a missing baseline were both rejected before a resumed workflow could start.
- A boundary comparison found an overlap between an authorization header and the Basic credential it contained. The corrected reader matched the shared redactor byte for byte for all 367 page cuts in the comparison. A regression case runs in the board suite.
