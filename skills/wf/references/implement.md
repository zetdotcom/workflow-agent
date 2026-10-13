# `wf implement [change] [ticket] [phase N]`

Execute ticket implementation plan and write code.

## Argument Resolution

Use the shared resolution rules in `SKILL.md`. Optional `phase N` selects one implementation phase. Without it, implement the next incomplete phase; if multiple phases are independently actionable and materially different, ask which one.

## Steps

1. Read `TICKET.md`, optional `SPEC.md`, `PLAN.md`, `PROGRESS.md` if present, and `REVIEWS.md` if present. Use `PLAN-BRIEF.md` only for orientation; `PLAN.md` remains implementation source of truth and `SPEC.md`, when present, remains the behavioral source of truth.
2. Verify:
   - `PLAN.md` and `PLAN-BRIEF.md` exist.
   - Latest plan review is not blocked. If review absent, warn but allow proceeding because review is optional.
   - Dependencies are done. If not, stop unless user explicitly overrides.
   - Planned check commands still match repository configuration; correct stale commands in both plan files before implementation.
   - When `SPEC.md` exists, the plan maps every scenario and protected behavior to verification. If not, stop and reconcile the plan before implementation.
3. If ticket directory is in `1.draft/`, stop and suggest planning. If in `2.todo/`, move whole directory to `3.in-progress/` and update `STATUS.md` before changing code. If in `4.done/`, keep it in `4.done/` unless user explicitly asked to move it back to in-progress.
4. Select requested phase or next incomplete phase. Verify required preceding phases are complete. Stop and explain unmet phase dependencies unless user explicitly overrides.
5. Establish pre-change evidence before production code:
   - Bug: run the smallest reproduction at the planned public seam and observe the reported failure.
   - New behavior: add or identify one behavior test at the planned seam and observe it fail when practical.
   - Non-runnable change: record why red evidence is not meaningful and run the planned validator.
6. Implement the smallest complete behavior slice within the selected phase. Add only enough code to satisfy it; do not anticipate later slices.
7. After each slice, run the focused check, then exercise the changed runtime surface directly when runnable. Fix failures caused by the slice before expanding. Do not repeat a successful command unless relevant code changed.
8. If codebase findings contradict implementation details, update the plan and record the deviation. Ask before changing scope, public contracts, architecture, risk, or acceptance criteria. A material change to specified behavior requires `wf specify <change> <ticket>` and explicit user confirmation before continuing.
9. Run final cross-phase verification only after all phases are complete.
10. Create `PROGRESS.md` from `references/progress-template.md` if absent, otherwise append phase implementation notes:

   ```markdown
   ### Phase N Implementation - YYYY-MM-DD

   **Phase:** N - <phase title>

   **Changes made:**
   - `path/to/file.ts` - description

   **Pre-change evidence:**
   - Command/scenario and observed failure, or why not applicable

   **Deviations from plan:**
   - Change and reason

   **Verification:**
   - Scenario or protected-behavior heading, exact command/scenario, and observed result when `SPEC.md` exists; otherwise exact command/scenario and observed result

   **Phase status:** completed | partial | blocked
   ```
11. Mark phase completion criteria in `PLAN.md` when verified. Do not mark unverified criteria complete.
12. Update actual `updated` date in `PLAN.md` and `PROGRESS.md`. Update `STATUS.md` only if directory moved.
13. If phases remain, suggest `wf implement <change> <ticket> phase <next>`. If all phases and final verification pass, suggest `wf impl-review <change> <ticket>` or `wf complete <change> <ticket>`.

## Rules

- Do not refactor unrelated code.
- Fix failing checks caused by implementation; otherwise report unresolved failure clearly.
- Preserve unrelated worktree changes.
- Do not mark a runnable behavior complete from tests alone; record direct observed smoke/runtime evidence.
- PR review feedback may be implemented while ticket remains in `4.done/`; append follow-up notes to `PROGRESS.md` and update dates normally.
- If implementation materially changes architecture, data flow, phase structure, scope, or risk, update both `PLAN.md` and `PLAN-BRIEF.md` and record deviation in `PROGRESS.md`.
- Do not infer completion of a specified scenario from adjacent test coverage; record evidence against each scenario and protected behavior explicitly. One observed check may cover multiple behaviors when stated.
