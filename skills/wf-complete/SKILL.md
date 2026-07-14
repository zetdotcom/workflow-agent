---
name: wf-complete
description: "Invoke this skill when the user wants to mark a ticket as done and archive it. Triggered by: 'done NNN', 'complete NNN', 'finish NNN', 'close NNN', 'archive NNN'. Moves ticket to archive, updates STATUS.md."
---

# Complete Skill

Marks a ticket as done, moves it to `4.done/`, and updates STATUS.md.

## Workflow

### Step 1: Identify Ticket

- Determine which init and ticket number
- Read the ticket file
- Verify it has been through impl-review with `approved` verdict

### Step 2: Confirm Readiness

Check:
- [ ] Implementation review verdict is `approved`
- [ ] All acceptance criteria are checked off
- [ ] No unresolved action items in review notes

If not ready, inform user what's missing. Proceed only if user explicitly overrides.

### Step 3: Update Ticket

- Change `## Status: in_progress` to `## Status: done`
- Add completion note:

```markdown
### Completed — <date>
```

### Step 4: Move to Done

- Move ticket file to `.workflow/inits/<init-name>/4.done/NNN-slug.md`
- Ticket may currently be in `3.in-progress/` (or another folder if override)

### Step 5: Update STATUS.md

- Remove ticket from "In Progress" section
- Add to "Done" section with `[x]` checkbox
- Update progress counter: `Progress: X/Y done`

### Step 6: Report

Show updated progress:
```
✓ Ticket NNN completed and moved to 4.done/.
Progress: X/Y done.
Remaining: <list of todo tickets>
```

## Rules

- Don't complete tickets that haven't been reviewed (warn user, allow override)
- Always move to `4.done/` — keeps other folders clean
- Always update STATUS.md
- If this was the last ticket in an init, congratulate and note the init is complete
