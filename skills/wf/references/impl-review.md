# `wf impl-review [change] [ticket]`

Optionally review code changes against ticket plan and acceptance criteria.

## Argument Resolution

Resolve change first, then ticket directory within that change. Accept unique change prefixes such as `PYE-1123`. If omitted, present choices at each level. Include tickets in `3.in-progress/` or `4.done/` containing `PROGRESS.md`.

## Steps

1. Read `TICKET.md`, `PLAN.md`, `PLAN-BRIEF.md`, `PROGRESS.md`, and `REVIEWS.md` if present.
2. Identify ticket changes from `PROGRESS.md` and Git diff where available. Do not assume unrelated worktree changes belong to ticket.
3. Run relevant tests, linter, and type checker. If checks are unavailable or undiscoverable, state that explicitly.
4. Review changed code for:
   - Correctness and completeness
   - Plan adherence and justified deviations
   - Project conventions and maintainability
   - Edge cases and scope creep
   - Test adequacy and results
   - Breaking-change risk
   - Whether `PLAN-BRIEF.md` still accurately describes implemented architecture and data flow
5. Create `REVIEWS.md` from `references/reviews-template.md` if absent, otherwise append:

   ```markdown
   ### Implementation Review - YYYY-MM-DD

   **Verdict:** approved | needs-changes | rejected

   **Files reviewed:**
   - `path/to/file.ts` - pass | concern | fail

   **Findings:**
   - ...

   **Acceptance Criteria Check:**
   - [x] criterion - met
   - [ ] criterion - not met because...

   **Action items:**
   - ...
   ```

6. If implementation materially differs from brief, update `PLAN-BRIEF.md` to reflect actual result and record discrepancy in review. Do not hide unapproved scope changes.
7. Update actual `updated` date in every modified file.
8. If approved and ticket is in progress, suggest `wf complete <change> <ticket>`. If changes are needed, suggest `wf implement <change> <ticket> phase <N>`. Keep tickets already in `4.done/` there while applying PR feedback unless user explicitly requests reopening.

## Rules

- Read actual changed code; do not trust `PROGRESS.md` alone.
- Findings first, ordered by severity. Avoid style-only nitpicks.
- Note acceptance criteria requiring manual runtime verification.
