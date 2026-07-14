---
name: wf-implement
description: "Invoke this skill when the user wants to implement a planned ticket. Triggered by: 'implement NNN', 'implement ticket NNN', 'code NNN', 'build NNN'. Reads the ticket's implementation plan and executes it, writing actual code changes."
---

# Implement Skill

Executes the implementation plan from a ticket, writing actual code changes.

## Workflow

### Step 1: Read Ticket

- Read the full ticket — search across status folders (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`) in `.workflow/inits/<init-name>/`
- Focus on: Implementation Plan, Acceptance Criteria, Technical Deep-Dive
- Check Review Notes for any constraints or warnings from plan-review

### Step 2: Verify Preconditions

- Check that plan exists and has been reviewed (Review Notes section should have plan review)
- Check that dependent tickets are done (read their status)
- If preconditions not met, inform user and stop

### Step 3: Implement

Follow the implementation plan:
- Work through steps in order
- Make actual code changes
- Validate technical assumptions as you go
- If you encounter something unexpected that contradicts the plan, stop and inform user

### Step 4: Verify

- Run relevant tests if they exist
- Check that all acceptance criteria are addressed
- Ensure no unintended side effects in related code

### Step 5: Update Ticket

Add implementation notes to the ticket:

```markdown
### Implementation Notes — <date>

**Changes made:**
- `path/to/file.ts` — description of change
- ...

**Deviations from plan:**
- <any changes from original plan and why>

**Status:** ready-for-review
```

Update ticket status to `in_progress` if not already, and move ticket file to `3.in-progress/` if not already there.

## Rules

- Follow the plan — don't go off-script without informing user
- If plan is wrong or incomplete, stop and suggest running `plan-review` again
- Keep changes minimal and focused on ticket scope
- Don't refactor unrelated code unless ticket explicitly calls for it
- If tests fail, fix them or flag the issue
- After implementation, ticket needs `impl-review` before completion
