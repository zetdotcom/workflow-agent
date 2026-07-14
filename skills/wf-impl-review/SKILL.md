---
name: wf-impl-review
description: "Invoke this skill when the user wants to review the implementation of a ticket after coding. Triggered by: 'review impl NNN', 'impl-review NNN', 'review implementation NNN', 'code review NNN'. Reviews the actual code changes against the plan and acceptance criteria."
---

# Implementation Review Skill

Reviews the code changes made during implementation against the ticket's plan and acceptance criteria.

## Workflow

### Step 1: Read Context

- Read the full ticket — search across status folders (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`) in `.workflow/inits/<init-name>/`
- Note: acceptance criteria, implementation plan, implementation notes
- Identify what files were changed (from implementation notes or git diff)

### Step 2: Review Code Changes

For each changed file, review against:

1. **Correctness** - Does the code do what the ticket requires?
2. **Completeness** - Are all acceptance criteria met?
3. **Plan adherence** - Does it follow the plan? Are deviations justified?
4. **Code quality** - Clean, readable, follows project conventions?
5. **Edge cases** - Are edge cases from the ticket handled?
6. **No scope creep** - Only changes relevant to this ticket?
7. **Tests** - Are there adequate tests? Do they pass?
8. **Safety** - Any risk of breaking existing functionality?

### Step 3: Write Review

Add to the ticket's `## Review Notes` section:

```markdown
### Implementation Review — <date>

**Verdict:** approved | needs-changes | rejected

**Files reviewed:**
- `path/to/file.ts` — ✅ | ⚠️ | ❌

**Findings:**
- ✅ <what's good>
- ⚠️ <concern/suggestion>
- ❌ <must fix>

**Acceptance Criteria Check:**
- [x] criterion 1 — met
- [ ] criterion 2 — not met, because...

**Action items:**
- ...
```

### Step 4: If Changes Needed

- If `needs-changes`: list specific fixes needed, user runs `implement` again or fixes manually
- If `rejected`: explain why, likely needs re-planning
- If `approved`: ticket is ready for `complete` skill

## Rules

- Actually read the changed code, don't just trust implementation notes
- Use git diff if available to see what changed
- Be thorough but pragmatic — flag real issues, not style nitpicks
- If acceptance criteria can't be verified without running the app, note that
- After approval, inform user they can run `complete` to finish the ticket
