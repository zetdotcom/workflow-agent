# `wf status [change] [ticket]`

Show progress and recommend next action.

## Argument Resolution

1. No argument: present active changes under `.workflow/changes/` with Question tool. Do not show all-change or archive overview.
2. `all`: show all active changes only.
3. `archived`: list archived records. `archived <identifier>` resolves only archive records by exact dated directory name, exact logical `change` value in `SUMMARY.md`, then unique case-insensitive ID/name prefix or content match.
4. One ordinary argument: search active file and folder names first, then active file contents. If one active change or ticket matches, show it. Only when no active match exists, search archive directory names and `SUMMARY.md` logical `change` values, then archive contents.
5. Two ordinary arguments: resolve active change first when one argument identifies a change, then resolve ticket within that change. If order is unclear but the pair uniquely identifies one active ticket, use it.
6. Ambiguous result: ask user to clarify with exact matching active changes, tickets, or archive records. Never merge active and archived state.

## Output

All changes:

```text
Workflow Status
---------------
PROJ-123-auth-refactor  3/10 done  (1 in progress)
PROJ-456-add-metrics    5/5 done   complete
PROJ-789-new-feature    CONTEXT only, no tickets yet
```

Archived records:

```text
Workflow Archive
----------------
2026-12-05  PROJ-123-auth-refactor  completed
2026-11-18  PROJ-456-old-checkout    superseded
```

Single archived change:

```text
PROJ-123-auth-refactor
Archived: 2026-12-05
Outcome: completed
Summary: .workflow/archive/2026-12-05-PROJ-123-auth-refactor/SUMMARY.md
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

For an archived record, validate the dated directory and `SUMMARY.md` identity while reading it. Do not reconcile or mutate immutable archive state; report metadata drift and suggest running the validator.

## Rules

- Read-only except active `STATUS.md` reconciliation.
- Always show recommended next action for active state; archived records instead show outcome and summary path.
- For an active change with every ticket in `4.done/`, recommend `wf archive <change>` rather than leaving the completed workspace indefinitely.
- Treat context-only active changes with no tickets as normal early state.
- Keep output concise.
- Never show all active changes or archived records unless explicitly requested.
