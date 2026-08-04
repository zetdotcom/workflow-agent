# `wf status [change] [ticket]`

Show progress and recommend next action.

## Argument Resolution

1. No change argument: present existing changes with Question tool. Do not show all-change overview.
2. Exact change folder match: show that change.
3. Unique case-insensitive ID/name prefix such as `PYE-1123`: show matching change.
4. Ticket argument after change: resolve ticket directory only within selected change and show that ticket.
5. Ambiguous result: ask user to clarify.
6. Show all changes only when user explicitly asks for `all` or "all changes".

## Output

All changes:

```text
Workflow Status
---------------
PROJ-123-auth-refactor  3/10 done  (1 in progress)
PROJ-456-add-metrics    5/5 done   complete
PROJ-789-new-feature    CONTEXT only, no tickets yet
```

Single change:

```text
PROJ-123-auth-refactor - 3/10 done

In Progress:
  004 - extract deposit validator
  Next: finish implementation, then run `wf impl-review PYE-1123 004`

Todo:
  005 - split route handlers (planned; run `wf implement PYE-1123 005`)
  006 - add integration tests (unplanned; run `wf plan PYE-1123 006`)

Done:
  001 - extract types
  002 - create deposit service
  003 - add unit tests

Recommended next action: Finish 004, then implement 005.
```

Single ticket:

```text
004 - extract deposit validator
Status: in-progress
Risk: medium
Dependencies: none
Last updated: 2026-07-20
Next: complete implementation, then run `wf impl-review PYE-1123 004`
```

## Reconciliation

List ticket directories in all status folders and verify `STATUS.md` matches folder source of truth. Read each `TICKET.md` for title/risk/dependencies and derive latest activity from newest `updated` value across files in ticket directory. If drift exists, repair only `STATUS.md`, update its actual `updated` date, and report corrections.

## Rules

- Read-only except `STATUS.md` reconciliation.
- Always show recommended next action.
- Treat context-only changes with no tickets as normal early state.
- Keep output concise.
- Never show all changes unless explicitly requested.
