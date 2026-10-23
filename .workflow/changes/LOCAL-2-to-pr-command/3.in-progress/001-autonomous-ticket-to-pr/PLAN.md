---
created: 2026-10-21
updated: 2026-10-22
---

# Implementation Plan

## Validated Assumptions

- Command routing is declarative in `skills/wf/SKILL.md`; every command has one operation-specific Markdown reference.
- The repository contains no application runtime for workflow commands. `to-pr` must be expressed as a host-agent orchestration contract, not as a new daemon or CLI executable.
- Existing `implement.md`, `impl-review.md`, and `complete.md` already define most implementation, evidence, review, and completion invariants. `to-pr.md` should coordinate and strengthen them rather than duplicate incompatible alternatives.
- `scripts/verify.sh` is the canonical full repository check. It runs shell syntax checks, static contracts, workflow-validator fixtures, and disposable worktree tests.
- `tests/static-contracts.sh` is the stable automated seam for command routing, reference availability, documentation distribution, and required instruction text.
- `tests/workflow-validation.sh` is the stable automated seam for valid and invalid ticket-artifact combinations.
- `tests/manual-skill-conformance.md` is the established behavioral seam for instruction-following cases that cannot be executed deterministically by shell tests.
- The current validator accepts any ticket-local Markdown file with valid dates. Supporting `TO-PR.md` requires explicit state validation rather than only generic document validation.
- No archived workflow decisions exist under `.workflow/archive/`.
- The installed development skill is a symlink to `skills/wf`, so repository changes become locally available without a separate build step.
- A successful `to-pr` run may apply existing `wf complete` readiness rules, move the ticket to `4.done/`, then record `delivered-to-review`; `done` already permits an open PR awaiting review.
- Fresh-agent dispatch is a required host capability. The command must detect its absence and stop; no single-session fallback is allowed.

## Relevant Archived Decisions

- None found. Search target `.workflow/archive/**/SUMMARY.md` returned no archive records after verifying the relevant components: `SKILL.md`, command references, workflow validator, static contracts, and manual conformance tests.

## Verified Project Commands

- Focused routing and documentation contracts: `bash tests/static-contracts.sh`
- Focused workflow metadata scenarios: `bash tests/workflow-validation.sh`
- Full test suite: `./scripts/verify.sh`
- Typecheck / lint / build: none separate; this repository is Markdown, HTML, and Bash, and `scripts/verify.sh` runs `bash -n` for all executable shell surfaces.
- Runtime / smoke scenario: install to a temporary skills directory through `AGENTS_SKILLS_DIR=<tmp>/skills ./install.sh`, then run the manual `wf to-pr` conformance scenarios in a disposable Git repository with a fresh-agent-capable host.

## Verification Seams

- `skills/wf/SKILL.md` router table and reference links prove that `wf to-pr` is discoverable and dispatches exactly one command reference.
- `skills/wf/scripts/validate-workflow.sh` against generated fixtures proves valid `TO-PR.md` lifecycle/state combinations and rejects malformed or contradictory states.
- `tests/static-contracts.sh` proves required safety language and distribution surfaces remain synchronized.
- `tests/manual-skill-conformance.md` exercised in disposable repositories proves agent orchestration, dirty-baseline isolation, phase commits, resume behavior, review separation, and PR outcomes.
- `./scripts/verify.sh` proves repository-wide structural compatibility after all changes.

## Specification Verification

| Scenario or protected behavior | Verification seam | Planned evidence | Phase |
|---|---|---|---|
| Start a planned ticket | Manual conformance plus router contracts | A disposable planned ticket creates `TO-PR.md`, records input identities/baseline, and dispatches the first phase | 2 |
| Refuse incomplete or unsupported input | Manual conformance | Missing plan files, dependencies, review readiness, or dispatch capability stop before code mutation | 2 |
| Approved inputs change during execution | Validator plus manual resume case | Changed `SPEC.md` or `PLAN.md` identity blocks resume | 2 |
| Dispatch a fresh phase agent | Static contract plus manual conformance | Distinct fresh agent is assigned one phase with authoritative files and durable prior results | 2 |
| Verify a completed phase | Manual conformance | Exact focused/runtime evidence and integrity checks precede an explicit phase commit | 2 |
| A planned check fails | Manual conformance | New diagnosis is required per repair; fourth attempt and repeated diagnosis block | 2 |
| Resume after interruption | Validator plus manual conformance | Committed phase is recognized and the next phase starts without history rewriting | 2 |
| Run with non-overlapping baseline changes | Disposable Git manual case | Baseline changes remain unstaged and byte-identical while ticket-owned paths commit | 2 |
| Phase overlaps a baseline-modified path | Disposable Git manual case | Overlap blocks before commit and names the path | 2 |
| Unsafe Git operation would be required | Static forbidden-operation contracts plus manual case | Stash/reset/rebase/force/broad-stage paths are refused | 2 |
| Final verification with a green baseline | Manual conformance | Full required commands and specification mapping are recorded before review | 2 |
| Final verification with an existing baseline failure | Manual conformance | Only an unchanged normalized failure signature is accepted and disclosed | 2 |
| Independent review passes | Static contract plus manual conformance | Fresh read-only reviewer records aggregate-diff findings without edits | 2 |
| Required review findings are repaired | Manual conformance | One fresh repair pass, full reverify, and one fresh re-review occur; remaining required findings block | 2 |
| Only optional findings remain | Manual conformance | Ready PR is allowed and optional findings appear in its body | 2 |
| Create a ready-for-review pull request | Manual conformance | Normal push and ready PR occur only after all required evidence passes | 2 |
| Required runtime verification is unavailable | Manual conformance | Only a draft PR is created and every limitation is listed | 2 |
| Push is not a fast-forward | Disposable Git manual case | Normal push failure blocks without rewrite or force | 2 |
| Pull request content preserves evidence | Static documentation contract plus manual PR-body review | Repository template is preserved and workflow evidence is added | 2 |
| Pull request creation is not production delivery | Static contract plus journal fixture | State is `delivered-to-review`; no CI, merge, or deployment claim is emitted | 1, 2 |
| Implementation requires scope expansion | Manual conformance | Unplanned dependency/API/schema/security/architecture decision blocks for replanning | 2 |
| Existing commands remain unchanged | Full repository suite and existing manual cases | All existing static, validator, worktree, and manual contracts remain valid | 3 |
| Optional `--worktree` behavior remains unchanged | `tests/worktree-git.sh` and manual worktree conformance | Existing worktree setup still precedes `to-pr` routing | 3 |
| Workflow-file ownership remains unchanged | Static contract and reference review | Spec, plan, progress, reviews, status, and journal roles are stated without overlap | 1, 3 |
| Validator runs after workflow mutations | Static contract plus manual conformance | `to-pr` records exact validator evidence after each metadata mutation | 2 |
| Runtime evidence remains required | Static contract plus draft-PR manual case | Runnable surfaces require observation or produce a qualified draft PR | 2 |
| Approved scope is not silently broadened | Manual halt cases | Material scope decisions stop and require specification or plan revision | 2 |

## Approach Summary

- Add `to-pr` as a first-class ticket command whose reference defines a finite resumable state machine. Do not implement an unbounded Ralph loop.
- Add `TO-PR.md` as a ticket-local execution journal. Use YAML frontmatter for validator-critical state and Markdown sections for human-readable evidence.
- Record approved `SPEC.md` and `PLAN.md` identities with `git hash-object`, the baseline HEAD and branch, baseline changed-path inventory, phase/review attempt counts, verified commit IDs, PR state, and blockers.
- Reuse existing implementation, review, and completion semantics by explicitly incorporating their readiness rules. `to-pr.md` remains the orchestration authority for ordering, delegation, retry budgets, Git safety, and delivery.
- Require one fresh phase agent per phase. Keep up to three repair turns with the active phase agent so failure context is retained. Require fresh read-only agents for initial and final implementation reviews, and one fresh repair agent for required findings.
- Keep Git history append-only: one commit per verified phase and separate review-fix commits. Never amend, rebase, squash, stash, reset, broadly stage, or force-push.
- Permit a dirty baseline only when ticket-owned paths do not overlap baseline-modified paths. Detect known overlap before dispatch from plan paths and enforce a post-agent changed-path guard before staging.
- Use normal push and repository-standard authenticated GitHub PR capability. Preserve a repository PR template when present and augment it with workflow evidence.
- Move the ticket through existing lifecycle states: `2.todo` to `3.in-progress` before implementation, then `4.done` only after existing completion readiness passes and PR creation succeeds. Record `delivered-to-review` in `TO-PR.md`.
- Reject an alternative `ship` command name because it can imply merge or production deployment. Reject portable one-session fallback because the confirmed behavior requires fresh agents.

## Plan Review Clarifications

The implementation must make these operational contracts explicit in `to-pr.md`, the journal template, validator rules, and conformance cases:

- Define the complete `TO-PR.md` state vocabulary and legal transitions, including preflight, phase execution, final verification, review, delivery, `blocked`, and `delivered-to-review`. List required frontmatter keys for each transition and define how interrupted delivery resumes when a push or pull request already exists.
- Define the host capability boundary for fresh-agent dispatch and pull request creation. The command must name the supported host operations it invokes, stop with an exact prerequisite diagnostic when either capability is unavailable, and never invent a CLI, remote, or target branch.
- Define baseline ownership as a path-set algorithm: capture staged, unstaged, and untracked paths; reject planned or post-agent writes that overlap baseline paths; exclude only explicitly ticket-owned metadata; and inspect the staged diff before every commit.
- Define delivery ordering and recovery: record the normal push result, PR URL, and delivery kind durably before moving the ticket to `4.done/`; make repeated invocation idempotent after PR creation; and never claim `delivered-to-review` if completion metadata or validation is incomplete.
- Name the exact local fixture or host-dependent procedure for each delivery outcome, including push rejection and an environment-unavailable runtime check. Do not require creating temporary GitHub repositories; if real PR creation cannot be exercised deterministically, mark that evidence manual-only rather than implying automated coverage.

### Confirmed Operational Decisions

- `TO-PR.md` uses the states `preflight`, `phase-N`, `final-verification`, `review`, `review-repair`, `delivery`, `blocked`, and `delivered-to-review`. Legal forward transitions are `preflight -> phase-1 -> ... -> final-verification -> review -> review-repair -> final-verification` or `review -> delivery -> delivered-to-review`; `blocked` is reachable from every active state. Resume uses the last durable state and completed phase-commit ledger without repeating committed phases.
- The host must expose `fresh-agent-dispatch` and `pull-request-create` capabilities. Missing capability stops with `to-pr prerequisite unavailable: <capability>`. The command never falls back to the current session and never guesses a CLI, remote, or target branch.
- Baseline ownership is computed from staged, unstaged, and untracked paths captured before execution. Planned paths are checked against this set before dispatch; post-agent paths are checked again before staging. Only explicitly ticket-owned workflow metadata paths are exceptions. Every commit requires explicit path staging and staged-diff ownership inspection.
- Delivery persists push result, PR URL, and ready/draft kind before lifecycle movement. Resume reuses recorded delivery metadata and does not create a duplicate PR. `delivered-to-review` is recorded only after completion metadata and validation succeed.
- Deterministic checks use temporary local directories created by the test process. Real PR delivery is host-dependent and manual-only when no authorized destination is available.

## Phase 1: Add Command, Journal Contract, And Metadata Validation

**Goal / observable outcome:**
- `wf to-pr` is a recognized ticket command with a documented state model, and the workflow validator can distinguish valid journal states from malformed or contradictory ones.

**Dependencies:**
- None

**Changes:**
1. Add `to-pr` to the `SKILL.md` router and storage model. Update compatibility to require fresh-agent dispatch only for this command, without raising requirements for existing commands.
2. Add `references/to-pr-template.md` defining:
   - frontmatter dates;
   - execution state;
   - approved spec/plan object IDs;
   - baseline HEAD, branch, and changed-path fingerprints;
   - active/completed phase and attempt counters;
   - phase commit ledger;
   - review-cycle state;
   - verification limitations;
   - blocker;
   - PR URL and ready/draft delivery status.
   - the confirmed state vocabulary, legal transitions, and required fields for interrupted delivery recovery.
3. Add the skeleton `references/to-pr.md` with argument resolution, prerequisites, state vocabulary, file ownership, idempotency rules, and the terminal meanings `delivered-to-review` and `blocked`. Phase 2 fills the full transitions.
4. Extend `validate-workflow.sh` so optional `TO-PR.md`:
   - is valid only in `3.in-progress/` or `4.done/`;
   - has valid date metadata and a recognized state;
   - requires immutable input identities and baseline identity once execution has started;
   - requires PR URL and delivery kind for `delivered-to-review`;
   - cannot claim delivered state outside `4.done/`;
   - rejects unsupported or contradictory combinations with specific diagnostics.
   - enforces state-specific delivery fields and rejects `delivered-to-review` without completion metadata.
5. Add validator fixtures for valid active, blocked, draft-delivered, and ready-delivered journals plus malformed state, missing identities, invalid lifecycle location, and missing PR reference.
6. Add static contracts requiring the route, reference, template, state terms, fresh-agent requirement, and delivered-to-review semantics.

**Affected files:**
- `skills/wf/SKILL.md`
- `skills/wf/references/to-pr.md` (new)
- `skills/wf/references/to-pr-template.md` (new)
- `skills/wf/scripts/validate-workflow.sh`
- `tests/static-contracts.sh`
- `tests/workflow-validation.sh`

**Pre-change evidence:**
- Add the routing/template/static assertions first and run `bash tests/static-contracts.sh`; observe failure because `to-pr` files and route do not exist.
- Add `TO-PR.md` validator fixtures first and run `bash tests/workflow-validation.sh`; observe failure because journal state is not validated.

**Verification:**
- `bash tests/static-contracts.sh`
- `bash tests/workflow-validation.sh`
- Review the generated fixture diagnostics for each invalid journal state.
- No direct agent runtime exists yet; confirm the installed temporary skill contains both new references through the existing install assertion.

**Completion criteria:**
- [x] Router and storage documentation recognize `to-pr` and `TO-PR.md`.
- [x] Journal template contains every state needed for resume and audit.
- [x] Validator accepts each supported state and rejects invalid lifecycle/state combinations.
- [x] Existing metadata fixtures remain green.

## Phase 2: Implement End-To-End Autonomous Orchestration

**Goal / observable outcome:**
- A fresh-agent-capable host can execute one approved planned ticket through verified phase commits, bounded independent review repair, normal push, PR creation, and existing completion semantics.

**Dependencies:**
- Phase 1 journal schema and validator rules.

**Changes:**
1. Complete `references/to-pr.md` as an explicit state machine:
   - resolve one ticket in `2.todo/` or resumable `3.in-progress/`;
   - load the authoritative ticket/spec/plan artifacts and relevant review/progress state;
   - verify dependencies and latest plan review;
   - treat invocation as approval and record Git object identities;
   - capture baseline HEAD, branch, staged/unstaged/untracked path inventory, and normalized baseline verification failures;
   - move a new run to `3.in-progress/`, create `TO-PR.md`, update `STATUS.md`, and validate metadata.
2. Define phase dispatch:
   - preflight known affected paths against baseline-modified paths;
   - create one fresh implementation agent per phase with bounded scope and complete authoritative context;
   - retain the active phase agent for up to three diagnosed repair turns;
   - require pre-change evidence where meaningful, focused checks, runtime evidence, scenario mapping, and integrity inspection;
   - block repeated diagnoses, scope expansion, or baseline-path overlap;
   - update `PROGRESS.md`, `PLAN.md`, and `TO-PR.md`, validate metadata, explicitly stage only ticket-owned paths, inspect the staged diff, and commit one verified phase.
3. Define interruption recovery and idempotency:
   - compare approved object IDs and journal ledger with current files and Git commits;
   - recognize complete phase commits;
   - reconcile interrupted pre-commit state without claiming it complete;
   - stop on missing/reordered commits, changed inputs, branch changes, or ambiguous ownership.
   - resume delivery from durable push/PR metadata without creating a duplicate PR.
4. Define final verification:
   - run plan-required full checks after the final change;
   - map evidence to every acceptance criterion, scenario, and protected behavior;
   - compare normalized failures with baseline and allow only unchanged unrelated failures;
   - preserve unavailable runtime checks as explicit limitations.
5. Define independent review:
   - dispatch a fresh read-only reviewer over the aggregate ticket diff;
   - record findings in `REVIEWS.md`;
   - if required findings exist, dispatch one fresh repair agent, create append-only repair commits, rerun full verification, and dispatch one final fresh read-only reviewer;
   - block if required findings remain.
6. Define delivery:
   - verify branch and remote without guessing a target;
   - perform normal push only;
   - preserve repository PR templates and generate evidence sections;
   - create ready PR when all required runtime evidence exists, otherwise only a draft PR for environment-unavailable checks;
   - apply all `wf complete` readiness rules, move the ticket to `4.done/`, update `STATUS.md`, and record the PR URL plus `delivered-to-review` in `TO-PR.md`;
   - stop before claiming remote CI, merge, or deployment.
7. Add conformance cases for every specification scenario using temporary local directories and host-dependent checks only when authorized capabilities and a destination are available.
8. Strengthen static contracts for forbidden Git operations, explicit staging, retry budgets, phase/reviewer separation, baseline comparison, PR qualification, completion ordering, host capability diagnostics, and the no-temporary-GitHub-repository rule.

**Affected files:**
- `skills/wf/references/to-pr.md`
- `skills/wf/references/to-pr-template.md`
- `skills/wf/SKILL.md`
- `tests/static-contracts.sh`
- `tests/workflow-validation.sh`
- `tests/manual-skill-conformance.md`

**Pre-change evidence:**
- Add manual cases and static assertions for phase dispatch, retry bounds, dirty baseline, review separation, push safety, and PR state before completing the reference; observe the focused static contracts fail on missing instructions.
- In a disposable manual repository, demonstrate that existing commands require separate human invocations and do not create a PR.

**Verification:**
- `bash tests/static-contracts.sh`
- `bash tests/workflow-validation.sh`
- Run deterministic `to-pr` cases against temporary local directories created by the test process; do not create GitHub repositories.
- Exercise real fresh-agent dispatch and PR creation only when the host supplies those capabilities and an authorized destination; record unavailable host evidence as manual-only.
- Directly inspect Git history, baseline paths, `TO-PR.md`, `PROGRESS.md`, `REVIEWS.md`, ticket lifecycle location, and generated PR payload for success, resume, blocked, and draft cases.

**Completion criteria:**
- [x] Every specification scenario has a deterministic instruction path and named evidence.
- [x] Fresh phase agents, retained phase repairs, fresh reviewers, and fresh review repair have distinct roles.
- [x] No failed or unverified phase can produce a phase commit.
- [x] Resume never repeats or rewrites a verified phase.
- [x] Dirty baseline work is excluded, and overlap blocks.
- [x] Review and repair are bounded exactly as specified.
- [x] Normal push and PR creation occur only after local gates.
- [x] Existing completion rules move successful delivery to `4.done`.

## Phase 3: Synchronize Distribution Documentation And Run Full Conformance

**Goal / observable outcome:**
- Users and agent hosts can discover the exact `to-pr` boundary, prerequisites, artifacts, and safety guarantees from every distributed documentation surface.

**Dependencies:**
- Complete Phase 2 behavior.

**Changes:**
1. Update the lifecycle diagrams and command examples to show `to-pr` as an optional autonomous path after approved planning, not a replacement for `implement`, review, or completion commands.
2. Document the exact success boundary: local verification, independent review, normal push, PR creation, and delivered-to-review status; explicitly exclude CI success, merge, and deployment.
3. Document fresh-agent compatibility, `TO-PR.md`, dirty-baseline rules, phase commits, resume behavior, ready-versus-draft PR behavior, and halt conditions.
4. Update landing and presentation command lists without implying every user must use autonomous execution.
5. Extend static distribution contracts so future changes cannot omit `to-pr` from README, `llms.txt`, landing page, or presentation.
6. Run the full automated suite and manually review the installed skill package and rendered command descriptions.

**Affected files:**
- `README.md`
- `llms.txt`
- `index.html`
- `presentation.html`
- `tests/static-contracts.sh`
- `tests/manual-skill-conformance.md`

**Pre-change evidence:**
- Add distribution assertions first and run `bash tests/static-contracts.sh`; observe failure because the documentation surfaces do not mention `wf to-pr`.
- No red runtime test is meaningful for static prose; use the repository verifier and manual rendered-content inspection.

**Verification:**
- `./scripts/verify.sh`
- `AGENTS_SKILLS_DIR=<temporary-directory>/skills ./install.sh` followed by checking the installed `wf` route and references.
- Search every distribution surface for `wf to-pr`, `TO-PR.md`, `delivered-to-review`, and the no-merge/no-deploy boundary.
- Manually inspect `index.html` and `presentation.html` in a browser for layout regressions.

**Completion criteria:**
- [x] All distribution surfaces describe `to-pr` consistently.
- [x] Existing manual and automated workflow behavior remains green.
- [x] The installed skill exposes the new command and references.
- [x] Documentation clearly distinguishes PR delivery from production shipping.

## Final Verification

- [ ] Run `./scripts/verify.sh` after the final repository change.
- [ ] Exercise deterministic scenarios in temporary local directories; exercise host-dependent fresh-agent and PR behavior only when authorized capabilities are available.
- [ ] Verify all ticket acceptance criteria and every specification scenario/protected behavior against recorded evidence.
- [ ] Confirm phase commits and review-fix commits are append-only and contain no baseline changes.
- [ ] Confirm successful delivery moves the ticket to `4.done/` only after completion readiness and PR creation.
- [ ] Confirm unavailable runtime evidence produces a draft PR, not a ready PR.
- [ ] Confirm normal push rejection blocks without force, rebase, reset, stash, or conflict resolution.
- [ ] Confirm no existing command, worktree route, validator behavior, installer contract, or archive behavior regressed.

## Deploy Notes

- No production deployment applies. The change is distributed as an updated Agent Skill.
- Roll out by merging the repository changes and reinstalling or updating the skill through the existing installation path.
- Roll back by reverting the command route, references, validator support, tests, and documentation together. Existing tickets without `TO-PR.md` remain compatible.
