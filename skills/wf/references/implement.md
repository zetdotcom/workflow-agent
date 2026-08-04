# `wf implement [change] [ticket] [phase N]`

Execute ticket implementation plan and write code.

## Argument Resolution

Resolve change first, then ticket directory within that change. Accept unique change prefixes such as `PYE-1123`. If omitted, present choices at each level. Optional `phase N` selects one implementation phase. Without phase argument, implement next incomplete phase; if multiple phases are independently actionable, ask user which one.

## Steps

1. Read `TICKET.md`, `PLAN.md`, `PROGRESS.md` if present, and `REVIEWS.md` if present. Use `PLAN-BRIEF.md` only for orientation; `PLAN.md` remains implementation source of truth.
2. Verify:
   - `PLAN.md` and `PLAN-BRIEF.md` exist.
   - Latest plan review is not blocked. If review absent, warn but allow proceeding because review is optional.
   - Dependencies are done. If not, stop unless user explicitly overrides.
3. If ticket directory is in `1.draft/`, stop and suggest planning. If in `2.todo/`, move whole directory to `3.in-progress/` and update `STATUS.md` before changing code. If in `4.done/`, keep it in `4.done/` unless user explicitly asked to move it back to in-progress.
4. Select requested phase or next incomplete phase. Verify required preceding phases are complete. Stop and explain unmet phase dependencies unless user explicitly overrides.
5. Implement only selected phase. Follow its steps in order and make minimal ticket-scoped code changes.
6. If codebase contradicts plan materially, stop and inform user before deviating.
7. Run phase-specific verification. Run final verification only after all phases are complete.
8. Create `PROGRESS.md` from `references/progress-template.md` if absent, otherwise append phase implementation notes:

   ```markdown
   ### Phase N Implementation - YYYY-MM-DD

   **Phase:** N - <phase title>

   **Changes made:**
   - `path/to/file.ts` - description

   **Deviations from plan:**
   - Change and reason

   **Verification:**
   - Command and result

   **Phase status:** completed | partial | blocked
   ```

9. Mark phase completion criteria in `PLAN.md` when verified. Do not mark unverified criteria complete.
10. Update actual `updated` date in `PLAN.md` and `PROGRESS.md`. Update `STATUS.md` only if directory moved.
11. If phases remain, suggest `wf implement <change> <ticket> phase <next>`. If all phases and final verification pass, suggest `wf impl-review <change> <ticket>` or `wf complete <change> <ticket>`.

## Rules

- Do not go off-plan without informing user when deviation is material.
- Do not refactor unrelated code.
- Fix failing checks caused by implementation; otherwise report unresolved failure clearly.
- Preserve unrelated worktree changes.
- PR review feedback may be implemented while ticket remains in `4.done/`; append follow-up notes to `PROGRESS.md` and update dates normally.
- If implementation materially changes architecture, data flow, phase structure, scope, or risk, update both `PLAN.md` and `PLAN-BRIEF.md` and record deviation in `PROGRESS.md`.
