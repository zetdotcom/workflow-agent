# `wf complete [change] [ticket]`

Mark ticket done.

## Argument Resolution

Use the shared resolution rules in `SKILL.md`, limited to matching ticket directories in `3.in-progress/`. Ask when omitted or ambiguous.

## Steps

1. Read `TICKET.md`, optional `SPEC.md`, `PLAN.md`, `PROGRESS.md`, and `REVIEWS.md` if present. Check readiness:
   - `PROGRESS.md` exists.
   - Every required implementation phase and its completion criteria are complete.
   - Final cross-phase repository checks passed after the final code change.
   - Every changed runnable surface has an observed runtime/smoke result, or an explicit limitation is recorded.
   - Every acceptance criterion is addressed and, when `SPEC.md` exists, every scenario and protected behavior has explicit observed evidence, including boundary and failure behavior.
   - Latest implementation review is approved. If absent, warn but allow explicit override because review is optional.
   - No unresolved review action items remain.
   - Workflow metadata validator passes before completion.
2. If not ready, report missing conditions and proceed only after explicit override. Never present an overridden condition as verified.
3. Append to `PROGRESS.md`:

   ```markdown
   ### Completed - YYYY-MM-DD
   ```

4. Update `PROGRESS.md` actual `updated` date.
5. Move whole ticket directory to `4.done/`.
6. Update `STATUS.md`: move ticket to Done, update progress counter and actual `updated` date.
7. Report progress and next actionable ticket. If final ticket, report change implementation complete and suggest `wf archive <change>` to preserve its durable outcome and rationale.

## Rules

- Never silently bypass readiness checks.
- Always move completed ticket directory to `4.done/`.
- Always update `STATUS.md`.
- `done` means implementation completed and may include PR ready for review, ready to merge, merged, or subsequent PR feedback updates.
- Ticket files and related code may still be updated while remaining in `4.done/`; append notes to `PROGRESS.md` and update relevant file dates.
- If user explicitly asks to reopen, move whole ticket directory from `4.done/` to `3.in-progress/`, append reopening reason and date to `PROGRESS.md`, and update `STATUS.md`.
- Never treat a material implementation mismatch as satisfied by editing `SPEC.md` to match the code. Require user confirmation through `wf specify <change> <ticket>`.
