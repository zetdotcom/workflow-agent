---
created: 2026-10-21
updated: 2026-10-21
---

# 001 — Add Autonomous Ticket-to-PR Orchestration

## Summary

**Goal:** Add a single `wf to-pr` command that autonomously executes one human-approved ticket plan through a locally verified and independently reviewed pull request.

**User-Visible / Operational Behavior:** After approving the current `SPEC.md` and `PLAN.md`, a user can invoke `wf to-pr <change> <ticket>`. The command executes every remaining phase with fresh agents, creates verified phase commits, repairs bounded failures and required review findings, pushes normally, and creates either a ready-for-review PR or a draft PR with explicit verification limitations.

**Scope:** Add routing, orchestration instructions, durable execution state, verification and escalation rules, Git and PR behavior, supporting templates, validation rules, tests, and user-facing documentation. Preserve existing commands and lifecycle behavior.

**Acceptance Criteria:**
- [ ] `wf to-pr` accepts one planned ticket and treats invocation as approval of the current `SPEC.md` and `PLAN.md`.
- [ ] The command uses a fresh implementation agent for each phase and separate fresh read-only review agents.
- [ ] Each phase is objectively verified before an explicit ticket-owned commit is created.
- [ ] Phase repair and review repair are bounded and stop on unresolved required findings or repeated diagnoses.
- [ ] The command preserves unrelated dirty-worktree changes and blocks overlapping-path ownership.
- [ ] Execution is resumable from durable `TO-PR.md` state without repeating committed phases.
- [ ] A successful run pushes without force and creates a ready-for-review PR; unavailable required runtime checks produce only a clearly qualified draft PR.
- [ ] Scope-expanding decisions and unsafe Git states halt for human action.
- [ ] Existing workflow commands retain their behavior and validation passes.

**Verification Required:**
- [ ] Static contract tests cover routing, command invariants, forbidden Git behavior, required state, review separation, and PR outcomes.
- [ ] Workflow validation accepts valid `to-pr` artifacts and rejects invalid lifecycle or state combinations.
- [ ] Manual conformance scenarios cover clean success, dirty baseline isolation, interruption/resume, phase failure, review repair, unavailable runtime verification, and push conflict.

**Risk:** high

**Dependencies:** none

## Technical Deep-Dive

> ⚠️ VERIFY: Assumptions below are directional. Validate against actual code before implementing.

**Context:** The workflow agent is an instruction-based skill. Command behavior lives in `skills/wf/SKILL.md` and command references under `skills/wf/references/`. Durable ticket state lives in `.workflow/changes/<change>/<status>/<ticket>/`. Existing implementation and review commands already define test-first evidence, phase verification, runtime smoke checks, review recording, and lifecycle movement.

**Known Interfaces / Constraints:**

- `SKILL.md` routes commands and defines shared lifecycle invariants.
- `references/implement.md` owns phase implementation behavior.
- `references/impl-review.md` owns implementation-review behavior.
- `references/complete.md` owns transition to `4.done/`.
- `references/worktree.md` provides optional isolated worktree setup.
- `scripts/validate-workflow.sh` validates repository workflow metadata.
- The command requires a host capable of dispatching fresh agents; it must not silently degrade to one-session execution.
- The command must not stash, discard, broadly stage, force-push, rebase, or rewrite user work.
- The command ends at PR creation. It does not merge, deploy, or guarantee remote CI success.

**Suggested Direction:** Introduce a `to-pr` command reference that coordinates existing implementation and review invariants through an explicit resumable state machine. Add a `TO-PR.md` template for operational state. Keep authoritative behavior in `SPEC.md` and `PLAN.md`, evidence in `PROGRESS.md`, review findings in `REVIEWS.md`, and orchestration state in `TO-PR.md`.

**Codebase Anchors To Validate:**
- `skills/wf/SKILL.md`
- `skills/wf/references/implement.md`
- `skills/wf/references/impl-review.md`
- `skills/wf/references/complete.md`
- `skills/wf/references/worktree.md`
- `skills/wf/scripts/validate-workflow.sh`
- `tests/static-contracts.sh`
- `tests/workflow-validation.sh`
- `tests/manual-skill-conformance.md`
- `README.md`

**Edge Cases / Gotchas:**
- A phase may need a file that already contains baseline changes; hunk ownership must not be guessed.
- Specification or plan content may change during a paused run.
- A successful focused check may coexist with an unchanged unrelated baseline failure.
- Tests may pass after being skipped, weakened, or made tautological.
- Required runtime verification may be impossible before PR creation.
- A review fix may affect multiple phase commits; history must remain append-only.
- Normal push may fail because the remote branch advanced.
- PR creation may succeed while remote CI later fails.
