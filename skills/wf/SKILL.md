---
name: wf
description: "Unified workflow agent for managing work items from idea to completion. Triggered by: 'wf', 'wf <command>', 'workflow', or any workflow-related intent (e.g., 'plan ticket', 'create change', 'check status', 'breakdown', 'implement'). Handles both single-PR features and multi-ticket epics through a single entry point."
---

# Workflow Agent

Manage work from initial idea through completed implementation. Support single-ticket changes and multi-ticket epics through one `wf` entry point.

## Router

Determine intent, then read the matching command reference before acting. Paths are relative to this skill directory.

### Global Worktree Modifier

Before normal command routing, detect whether invocation contains `--worktree` in any position or naturally asks to run workflow work in an isolated Git worktree. Worktree intent is an execution modifier, not a command.

When worktree intent is present:

1. Preserve original invocation and inferred command arguments. Remove only explicit `--worktree` tokens from payload that normal command receives.
2. If command intent is missing or ambiguous, resolve it using normal routing behavior before changing repository state.
3. Read and execute `references/worktree.md` before reading command reference. This is exception to one-reference rule below.
4. After setup succeeds, treat selected worktree root as execution root for rest of invocation:
   - Use absolute paths rooted there for every file tool operation.
   - Set that directory as working directory for every Bash operation.
   - Resolve `.workflow/` only there; never read or mutate caller worktree as fallback.
5. Continue preserved command under normal routing and lifecycle rules. If setup stops or is cancelled, do not dispatch command.

Without explicit or natural-language worktree intent, skip setup and preserve existing behavior exactly.

| Command | Purpose | Instructions |
|---|---|---|
| `new` | Start a change | `references/new.md` |
| `discover` | Flesh out context | `references/discover.md` |
| `breakdown` | Split change into tickets | `references/breakdown.md` |
| `plan` | Create ticket implementation plan | `references/plan.md` |
| `plan-review` | Optionally review plan | `references/plan-review.md` |
| `implement` | Execute implementation plan | `references/implement.md` |
| `impl-review` | Optionally review code changes | `references/impl-review.md` |
| `complete` | Mark ticket done | `references/complete.md` |
| `status` | Show progress and next actions | `references/status.md` |

Routing behavior:

1. **No arguments / `wf`**: use Question tool to show command menu. Include command names and purposes from table.
2. **Explicit command** (for example, `wf plan PYE-1123 001`): load its reference and execute it directly.
3. **Natural language** (for example, "I want to start working on something"): infer command, confirm with user, then load its reference.
4. **Unknown command**: show command menu. Do not guess an unsupported operation.

Read only relevant command reference for current operation. Worktree-modified invocation may additionally read `references/worktree.md` before command reference. If operation changes during conversation, read new command reference before continuing.

## Storage Model

All workflow data lives in `.workflow/changes/<slug>/`:

```text
.workflow/
  changes/
    <PROJ-123-slug>/
      CONTEXT.md
      STATUS.md
      1.draft/
        001-ticket-slug/
          TICKET.md
      2.todo/
      3.in-progress/
      4.done/
```

Folder meanings:

- `1.draft/`: new or unplanned tickets
- `2.todo/`: planned tickets ready for implementation
- `3.in-progress/`: tickets currently being implemented or updated
- `4.done/`: implementation completed; PR may be ready for review, ready to merge, merged, or receiving follow-up review changes

Each ticket is a directory named `NNN-slug`. Move whole ticket directories between numbered folders as status changes. Directory location is source of truth for ticket lifecycle status. `STATUS.md` is derived progress summary.

Ticket directory files:

- `TICKET.md`: stable goal, scope, acceptance criteria, testing requirements, risk, dependencies, and technical context; created during breakdown
- `PLAN.md`: detailed, comprehensive, phased implementation plan; created during planning
- `PLAN-BRIEF.md`: concise human-readable explanation of planned changes and data flow; created during planning
- `PROGRESS.md`: phase results, verification, deviations, reopening notes, and PR-feedback work; created when first needed
- `REVIEWS.md`: dated plan and implementation reviews; created when first review runs

Do not create empty optional files. Commands must read only files relevant to their operation plus `TICKET.md`.

## Resolution Rules

- Never guess when change or ticket selection is ambiguous.
- When user omitted required selection, use Question tool with exact available options.
- Resolve change before resolving ticket: exact change folder match first, then unique case-insensitive ID/name prefix such as `PYE-1123`.
- Ticket-scoped commands use `<change> <ticket>` addressing, for example `wf implement PYE-1123 001`.
- Do not resolve a bare ticket number across all changes. If change is omitted, ask user to select change first.
- Search ticket directories across all four status folders.
- If `.workflow/` does not exist, suggest `wf new` unless current command is `new`.

## Shared Invariants

- `CONTEXT.md` must contain substantive context before breakdown or planning.
- Tickets should be independently deployable and take 1-3 days unless explicit dependency chain requires otherwise.
- Dependencies must form a directed acyclic graph.
- Never create breakdown tickets without user confirmation.
- Plans must be grounded in actual codebase exploration.
- Keep implementation changes minimal and ticket-scoped.
- Plan review and implementation review are optional; warn before bypassing relevant review, but permit explicit override.
- Plans are detailed, comprehensive, and divided into coherent, independently verifiable implementation phases.
- `done` is not immutable. PR feedback changes may update code and ticket notes while ticket remains in `4.done/`.
- `done -> in-progress` is valid when user explicitly requests reopening; record reason and update dates.
- Follow-up work beyond original ticket or PR-review scope should become a new ticket.
- Update `STATUS.md` whenever ticket folders change.
- Suggest exact `wf <command>` next action after every mutating command and copy that command to the clipboard.

## Date Handling

Use actual current date in `YYYY-MM-DD` format, never placeholder text.

- `CONTEXT.md`: `created` and `updated` in YAML frontmatter
- Every ticket Markdown file: `created` and `updated` in YAML frontmatter
- `STATUS.md`: `updated` in YAML frontmatter
- Update `updated` whenever file content changes
- Ticket latest modification is newest `updated` value among files in its directory

## Output Rules

- Keep output concise and actionable.
- Use actual `wf <command>` syntax in next-step guidance.
- Whenever suggesting a next `wf` command, use the Bash tool to copy only the exact command to the clipboard. Use `pbcopy` on macOS, `wl-copy` or `xclip -selection clipboard` on Linux, and `clip.exe` on Windows. Detect availability first, treat clipboard failure as non-fatal, and report whether the command was copied.
- Report files moved or created and verification performed.
- Surface blockers and unmet prerequisites explicitly.
