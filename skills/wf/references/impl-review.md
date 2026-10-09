# `wf impl-review [change] [ticket]`

Optionally review code changes against ticket plan and acceptance criteria.

## Argument Resolution

Use the shared resolution rules in `SKILL.md`. Include tickets in `3.in-progress/` or `4.done/` containing `PROGRESS.md`.

## Steps

1. Read `TICKET.md`, `PLAN.md`, `PLAN-BRIEF.md`, `PROGRESS.md`, and `REVIEWS.md` if present.
2. Pin review scope from `PROGRESS.md` and the relevant Git diff. Do not assume unrelated worktree changes belong to ticket.
3. Review behavior tests first: confirm they exercise public seams, would fail for a plausible regression, and cover required boundaries rather than implementation details.
4. Run relevant focused checks, then the full test/typecheck/lint/build commands required by the plan. Exercise every changed runnable surface directly. If a check or runtime is unavailable, state the exact limitation.
5. Review changed code for:
   - Correctness and completeness
   - Plan adherence and justified deviations
   - Project conventions, simplicity, and maintainability
   - Edge cases and scope creep
   - Security, performance, and breaking-change risk where relevant
   - Whether `PLAN-BRIEF.md` still accurately describes implemented architecture and data flow
6. Create `REVIEWS.md` from `references/reviews-template.md` if absent, otherwise append:

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
   - Critical | required | optional - finding, evidence, and concrete remedy
   ```
7. If implementation materially differs from brief, update `PLAN-BRIEF.md` to reflect actual result and record discrepancy in review. Do not hide unapproved scope changes.
8. Update actual `updated` date in every modified file.
9. If approved and ticket is in progress, suggest `wf complete <change> <ticket>`. If changes are needed, suggest `wf implement <change> <ticket> phase <N>`. Keep tickets already in `4.done/` there while applying PR feedback unless user explicitly requests reopening.

## Rules

- Read actual changed code; do not trust `PROGRESS.md` alone.
- Findings first, ordered by severity. Each required finding names evidence, user impact, and a concrete remedy; avoid style-only nitpicks.
- Approval requires observed verification evidence, not absence of obvious problems.
- Note acceptance criteria requiring unavailable manual/runtime verification as unverified, not passed.
