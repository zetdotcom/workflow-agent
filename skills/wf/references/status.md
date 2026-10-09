# `wf status [change] [ticket]`

Show progress and recommend next action.

## Argument Resolution

1. No argument: present existing changes with Question tool. Do not show all-change overview.
2. One argument: treat it as a possible change ID, ticket ID, work item ID, or slug fragment. Search file and folder names under `.workflow/changes/` first. If name search has no unique match, search file contents with Grep/ripgrep.
3. If one argument uniquely identifies a change folder, show that change.
4. If one argument uniquely identifies a ticket directory or ticket file content inside any change, show that ticket and its parent change. Example: `wf status PYE-11391` should locate matching file/folder names before content search.
5. Two arguments: resolve change first when one argument identifies a change, then resolve ticket within that change. If order is unclear but the pair uniquely identifies one ticket, use it.
6. Ambiguous result: ask user to clarify with exact matching changes/tickets.
7. Show all changes only when user explicitly asks for `all` or "all changes".

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
