---
created: 2026-10-22
updated: 2026-10-22
---

# Reviews

Plan and implementation reviews are recorded chronologically below.

### Plan Review - 2026-10-22

**Verdict:** needs-changes

**Findings:**
- The plan is grounded in the repository: the router, command references, validator, static contracts, manual conformance cases, and canonical verification script all exist and match the proposed integration points.
- The phase structure is coherent and preserves working intermediate states. Phase 1 establishes metadata contracts before Phase 2 orchestration, and Phase 3 distributes the completed behavior.
- The plan does not yet define the complete `TO-PR.md` state-transition contract or the required fields for every state. Without that, validator and resume implementations can diverge.
- Fresh-agent and pull-request capability detection is required but no concrete host operation, adapter boundary, or exact unsupported-host diagnostic is named.
- Dirty-baseline protection needs an explicit path-set algorithm covering staged, unstaged, untracked, planned, observed, and ticket-owned metadata paths. The current wording leaves ownership decisions to implementation.
- Delivery ordering is underspecified around interruption after push or PR creation but before `wf complete`; repeated invocation must be defined so it cannot duplicate a PR or falsely claim `delivered-to-review`.
- Delivery conformance is described as manual “where practical” without naming the deterministic fixture or clearly labeling unavailable PR evidence as manual-only.

**Suggested changes to plan:**
- Add the state vocabulary, legal transitions, per-state required journal fields, and interrupted-delivery recovery rules to `to-pr.md` and `to-pr-template.md`.
- Specify the fresh-agent and pull-request host interfaces, exact prerequisite diagnostics, and the no-fallback behavior.
- Specify baseline path capture, overlap checks, explicit metadata exceptions, and staged-diff ownership checks as an algorithm, then add static/manual assertions for each boundary.
- Define the push/PR/completion ordering and idempotent resume behavior, including the durable journal write and validator step at each boundary.
- Name the disposable-repository/manual procedure for ready PR, draft PR, push rejection, and PR-creation recovery; mark non-executable evidence as manual-only.

### Plan Review Resolution - 2026-10-22

The author confirmed the delivery-test boundary:

- Do not require temporary GitHub repositories, which may violate organization policy or exceed user permissions.
- Use temporary local directories created by tests for deterministic journal, state, path-ownership, retry, resume, push-rejection, and PR-payload checks.
- Exercise actual fresh-agent dispatch and PR creation only through authorized host capabilities. If unavailable, record the evidence as manual-only with the exact limitation.

The plan and brief were updated accordingly. The remaining review findings are resolved in the planned implementation contract, which must define the state table, host capability diagnostics, baseline path algorithm, and delivery recovery ordering before implementation.

### Plan Review Follow-up - 2026-10-22

**Verdict:** approved

**Findings:**
- The plan now records the confirmed state vocabulary and legal transition path.
- Host capability requirements and unsupported-host behavior are explicit.
- Baseline path ownership, staged-diff inspection, delivery persistence, and idempotent resume are defined.
- Verification uses local temporary directories and does not require creating temporary GitHub repositories. Host-dependent PR evidence is explicitly manual-only when unavailable.

**Suggested changes to plan:**
- None. Implement Phase 1 and preserve these contracts in the journal template, command reference, validator, and tests.

### Implementation Review - 2026-10-22

**Verdict:** needs-changes

**Files reviewed:**
- `skills/wf/SKILL.md` - pass
- `skills/wf/references/to-pr.md` - concern
- `skills/wf/references/to-pr-template.md` - pass
- `skills/wf/scripts/validate-workflow.sh` - concern
- `tests/static-contracts.sh` - pass
- `tests/workflow-validation.sh` - concern
- `tests/manual-skill-conformance.md` - pass
- `README.md` - pass
- `llms.txt` - pass
- `index.html` - pass
- `presentation.html` - pass

**Findings:**
- Required | `skills/wf/references/to-pr.md` instructs the coordinator to update `PLAN.md` after each phase. `PLAN.md` is an approved-input identity recorded in `TO-PR.md`, and the same reference says any later plan change blocks resume. Following both instructions makes a normal multi-phase run invalidate its own approval and prevents safe resume. Do not mutate `PLAN.md` during execution; record phase evidence and deviations in `PROGRESS.md`, `TO-PR.md`, and `REVIEWS.md`, and stop for `wf plan` if the approved plan must change.
- Required | `skills/wf/scripts/validate-workflow.sh` validates individual frontmatter values but does not reject contradictory state combinations required by the journal contract. For example, `delivered-to-review` can have `active_phase: 1`, `completed_phases: 0`, or `delivery_kind: draft` with no recorded runtime limitation, and `phase-1` can have `active_phase: 0`; the current fixtures do not exercise these contradictions. Add state-specific invariants and fixtures for phase counters, delivery metadata, and blocked-state requirements so invalid journals cannot be resumed as valid.

**Acceptance And Specification Check:**
- [x] `wf to-pr` routing, journal storage, state vocabulary, and delivery boundary are documented and covered by static contracts.
- [x] Existing workflow commands retain their behavior; `./scripts/verify.sh` passed.
- [ ] Resumable execution is safe because the implementation instructions currently require mutating the approved `PLAN.md`.
- [ ] Invalid lifecycle or state combinations are rejected; the validator currently accepts several contradictory combinations.
- [ ] Fresh-agent dispatch, real phase execution, independent review, push, and pull-request creation remain manual-only because this repository has no runtime coordinator or authorized host integration.

**Action items:**
- Required | Remove the `PLAN.md` mutation instruction and clarify that approved plan changes require a new reviewed `wf plan`/`wf to-pr` invocation.
- Required | Enforce and test state-specific `TO-PR.md` invariants, including phase counters, delivery metadata, and blocked-state requirements.

### Implementation Review Resolution - 2026-10-22

**Verdict:** resolved

**Changes:**
- Removed the execution-time instruction to mutate the approved `PLAN.md`; plan changes now require reviewed replanning and a new `wf to-pr` invocation.
- Added journal validation for state-specific phase counters, delivery metadata, runtime limitations, completion metadata, and contradictory terminal combinations.
- Added static and workflow-validation coverage for both review findings.

**Verification:**
- `./scripts/verify.sh` - passed: all automated checks passed.
