# `wf to-pr [change] [ticket]`

Execute one human-approved, planned ticket through fresh-agent implementation,
verification, independent review, and pull-request delivery.

## Prerequisites And Preflight

1. Resolve exactly one ticket with `TICKET.md`, `SPEC.md`, `PLAN.md`, and
   `PLAN-BRIEF.md`. A new run must be in `2.todo/`; a resumable run must be in
   `3.in-progress/`.
2. Verify dependencies and the latest plan review. A blocked review, missing
   planning file, changed approved input, or incomplete dependency stops before
   production changes and names the corrective `wf` command.
3. Require host capabilities `fresh-agent-dispatch` and
   `pull-request-create`. Missing capability stops with exactly
   `to-pr prerequisite unavailable: <capability>`. Never fall back to the
   current session, guess a CLI, remote, or target branch.
4. Detect whether the approved ticket changes a browser-runnable surface. If
   it does, prefer `playwright-cli` for direct browser verification. Missing
   Playwright CLI does not stop implementation or pull-request creation;
   record the unavailable browser check as a runtime limitation that permits
   only draft delivery with an explicit human verification action. Do not
   substitute unit tests or an unverified manual claim for browser evidence.
5. Record `git hash-object SPEC.md`, `git hash-object PLAN.md`, `git rev-parse
   HEAD`, and `git branch --show-current` in `TO-PR.md`.
6. Capture staged, unstaged, and untracked paths plus normalized baseline
   verification failures. Move a new ticket to `3.in-progress/`, update
   `STATUS.md`, create the journal, and run
   `bash <skill-root>/scripts/validate-workflow.sh <execution-root>`.

The invocation approves the current specification and plan. Any later change
to either content identity blocks resume and requires human review followed by
a new invocation.

## Durable Journal

Create `TO-PR.md` from `references/to-pr-template.md` in the ticket directory.
It records approved `SPEC.md` and `PLAN.md` identities, Git baseline ownership,
phase attempts and commits, review state, verification limitations, blockers,
and delivery metadata. `SPEC.md` remains the behavioral source of truth and
`PLAN.md` remains the implementation source of truth.

The journal uses these states:
`preflight`, `phase-N`, `final-verification`, `review`, `review-repair`,
`delivery`, `blocked`, and `delivered-to-review`.

`delivered-to-review` means a pull request exists and completion metadata has
been validated. It does not claim remote CI success, merge, deployment, or
production delivery. A `blocked` state records the exact human action required.

## State Machine

The coordinator persists the journal before and after every state transition.
The legal path is:

```text
preflight -> phase-1 -> ... -> final-verification -> review -> delivery
review -> review-repair -> final-verification
delivery -> delivered-to-review
any active state -> blocked
```

`phase-N` means exactly one plan phase is active. A phase cannot advance until
its preceding phases have verified commits. `blocked` records the exact
diagnosis, unchanged inputs, current Git state, and required human action.

## Phase Dispatch And Verification

For each incomplete phase, dispatch one fresh implementation agent with only
that phase's plan slice, `TICKET.md`, `SPEC.md`, relevant `PLAN.md` sections,
repository instructions, and prior durable results. The phase agent must:

- establish pre-change evidence, or record why red evidence is not meaningful;
- implement only the assigned vertical behavior slice;
- run every planned focused check and direct runtime smoke check when runnable;
- for every changed browser-runnable surface, start the planned local or test
  runtime and use `playwright-cli` to exercise the affected user flow at the
  browser boundary, including the relevant navigation, interaction, and
  observable result;
- map evidence to acceptance criteria, scenarios, and protected behaviors;
- report changed paths, diagnosis, verification, and scope decisions.

Playwright verification must use the actual changed application, not a static
mock or test-only fixture unless the approved plan explicitly defines that
fixture as the runnable surface. Record the exact `playwright-cli` commands,
target URL, and observed results in `PROGRESS.md` and `TO-PR.md`. Store only
ticket-owned artifacts when screenshots or traces are needed. A browser flow
failure is a verification failure and enters the same bounded repair loop as
any specified check: return the failed step, visible state, console errors,
relevant request failures, and artifact paths to the retained phase agent for
diagnosis and a targeted fix. An unavailable `playwright-cli` executable or
application runtime is an explicit runtime limitation and cannot be reported
as passing browser verification.

The coordinator rejects baseline-path overlap before dispatch and again after
the agent returns. Only explicit ticket-owned paths may be staged. Before each
commit, stage paths explicitly, inspect `git diff --cached --name-status` and
the staged diff, and verify that no baseline path is included.

If a specified check fails, retain the phase agent for at most three repair
attempts. Every attempt requires a materially new diagnosis and targeted
remedy. Stop immediately on a repeated diagnosis, a fourth attempt, test
weakening, scope expansion, unsafe Git state, or missing runtime evidence.
Create one append-only phase commit only after all required evidence passes.
Update `PROGRESS.md` and `TO-PR.md`, then run the metadata validator before
committing. Do not mutate the approved `PLAN.md` during execution. Record
implementation evidence and deviations in `PROGRESS.md`, `TO-PR.md`, and
`REVIEWS.md`; if the approved plan must change, stop and require a reviewed
`wf plan` followed by a new `wf to-pr` invocation.

## Final Verification And Independent Review

After the final phase commit, run all plan-required full checks and compare
normalized failures with the captured baseline. An unchanged, unrelated
baseline failure is disclosed; a new or changed failure blocks. Unavailable
required runtime checks remain explicit limitations and qualify delivery as
draft only.

For a ticket that changes a browser-runnable surface, independently repeat the
complete acceptance flow with `playwright-cli` against the final aggregate
implementation. Do not rely only on phase-agent evidence. Record the exact
commands, target URL, and observed final state in `TO-PR.md`. A new browser
console error, failed request that affects the flow, incorrect visible state,
or inability to complete an available flow is a required finding. Dispatch one
fresh repair agent with the browser evidence, create append-only repair commits,
run full verification, and independently repeat the Playwright flow. Apply the
same three-attempt ceiling, materially-new-diagnosis requirement, and stopping
rules used for phase repair. An unresolved observed browser failure blocks pull
request creation. If `playwright-cli` or the application runtime is unavailable
rather than failing, record the limitation and permit only draft delivery with
the exact human browser check still required.

Dispatch a fresh read-only reviewer over the aggregate ticket diff. The
reviewer cannot edit code and records required and optional findings in
`REVIEWS.md`. Required findings receive one fresh repair agent and separate
append-only repair commits, followed by full verification and one fresh
re-review. Remaining required findings block delivery. Optional findings do
not expand scope and are listed in the pull request body.

## Delivery And Recovery

Before delivery, verify the current branch and configured remote without
guessing either value. Perform a normal non-force push only. Preserve any
repository pull-request template and include purpose, phase commits,
verification evidence, baseline limitations, runtime limitations, optional
findings, and remaining human checks.

Create a ready-for-review pull request only when all required runtime evidence
exists. Create a draft pull request only when the remaining required checks are
unavailable because of environment limitations, and list every limitation and
human action. Never claim CI success, merge, deployment, or production
delivery.

Persist push result, pull request URL, delivery kind, and completion metadata
before moving the ticket to `4.done/`. Run the validator after every workflow
mutation. Record `delivered-to-review` only after completion metadata and
validation succeed. On resume, reuse recorded delivery metadata and never
create a duplicate pull request. A non-fast-forward push, changed branch,
changed approved input, ambiguous ownership, or interrupted metadata write
blocks without stash, discard, reset, rebase, force-push, or automatic
conflict resolution.

## Safety And Resume

Capture staged, unstaged, and untracked paths before implementation. Planned
paths and post-agent paths that overlap baseline paths block the run, except
explicit ticket-owned workflow metadata. Stage only explicit ticket-owned paths
and inspect the staged diff before every commit.

Phase commits are append-only. Never stash, discard, reset, rebase, amend,
squash, broadly stage, force-push, or automatically resolve conflicts.
Resume validates the journal identities and Git baseline, recognizes committed
phases, and does not repeat them. Delivery reuses recorded push and pull-request
metadata without creating a duplicate pull request.

## Evidence Boundary

Deterministic conformance cases use temporary local directories and do not
create temporary GitHub repositories. Real fresh-agent dispatch and
pull-request creation are host-dependent; when authorized capabilities are
unavailable, record the limitation as manual-only evidence rather than
claiming delivery.
