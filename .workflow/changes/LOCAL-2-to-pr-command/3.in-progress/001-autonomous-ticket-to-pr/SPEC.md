---
created: 2026-10-21
updated: 2026-10-21
---

# Behavior Specification

## User Story: Start An Approved Autonomous Run

As a workflow user,
I want one explicit command to approve and start execution of the current ticket specification and plan,
so that autonomous work begins from a known, human-reviewed contract.

### Scenario: Start a planned ticket

- **GIVEN** an active ticket has `SPEC.md`, `PLAN.md`, and `PLAN-BRIEF.md`
- **AND** the host supports fresh implementation and review agents
- **WHEN** the user invokes `wf to-pr <change> <ticket>`
- **THEN** invocation is treated as approval of the current `SPEC.md` and `PLAN.md`
- **AND** their content identities, the Git baseline, branch, and existing changes are recorded in `TO-PR.md`
- **AND** execution begins with the next incomplete phase

### Scenario: Refuse incomplete or unsupported input

- **GIVEN** a ticket is missing a required planning file, has unresolved plan-review blockers, has incomplete dependencies, or is running on a host without fresh-agent orchestration
- **WHEN** the user invokes `wf to-pr`
- **THEN** the command stops before production code changes
- **AND** reports the exact unmet prerequisite and corrective action

### Scenario: Approved inputs change during execution

- **GIVEN** a `to-pr` run has recorded approved specification and plan identities
- **WHEN** `SPEC.md` or `PLAN.md` content changes before the run completes
- **THEN** the command stops
- **AND** requires the human to review the changed files and invoke `wf to-pr` again

## User Story: Implement And Verify Every Phase

As a workflow user,
I want each approved plan phase implemented and verified independently,
so that progress is reviewable, recoverable, and grounded in objective evidence.

### Scenario: Dispatch a fresh phase agent

- **GIVEN** an approved plan has an incomplete phase whose prerequisites are complete
- **WHEN** the coordinator starts that phase
- **THEN** it dispatches a fresh implementation agent for exactly that phase
- **AND** supplies `TICKET.md`, `SPEC.md`, relevant `PLAN.md` content, repository instructions, and prior durable phase results
- **AND** the agent does not rely on conversational memory from earlier phases

### Scenario: Verify a completed phase

- **GIVEN** a phase agent has implemented its assigned behavior slice
- **WHEN** phase verification runs
- **THEN** it executes valid checks named by the plan
- **AND** may derive missing or stale checks from repository conventions
- **AND** records exact commands, exit results, scenario coverage, and applicable runtime observations in `PROGRESS.md`
- **AND** verifies that changed tests, fixtures, snapshots, configuration, and verification commands were not weakened solely to produce a passing result
- **AND** creates a phase commit only after all required phase evidence passes

### Scenario: A planned check fails

- **GIVEN** a specified verification command fails
- **WHEN** the phase agent diagnoses the failure
- **THEN** it may repair the implementation without weakening or replacing the failed requirement
- **AND** it records a new diagnosis and targeted remedy before every repair
- **AND** retries verification no more than three times
- **AND** stops earlier when the same failure repeats without a materially new diagnosis

### Scenario: Resume after interruption

- **GIVEN** one or more phases have verified commits and the process is interrupted
- **WHEN** the user invokes `wf to-pr` again with unchanged approved inputs
- **THEN** the command validates `TO-PR.md` against Git state
- **AND** resumes from the first uncommitted phase
- **AND** does not repeat or rewrite committed phases

## User Story: Preserve Existing User Work

As a workflow user,
I want autonomous execution to coexist safely with unrelated local changes,
so that the command never captures, rewrites, or discards work it does not own.

### Scenario: Run with non-overlapping baseline changes

- **GIVEN** the worktree contains uncommitted changes before `wf to-pr` starts
- **AND** a phase does not need any baseline-modified path
- **WHEN** the command implements and commits the phase
- **THEN** it stages only explicit ticket-owned changes
- **AND** the baseline changes remain unstaged and unchanged

### Scenario: Phase overlaps a baseline-modified path

- **GIVEN** a planned phase needs a path that was already modified at baseline
- **WHEN** the phase attempts to modify that path
- **THEN** the command stops before committing
- **AND** reports the overlapping path
- **AND** recommends resolving the overlap or using an isolated worktree

### Scenario: Unsafe Git operation would be required

- **GIVEN** continuation would require automatic stash, reset, rebase, force push, history rewriting, conflict resolution, or broad staging
- **WHEN** the coordinator reaches that condition
- **THEN** it stops without performing the unsafe operation
- **AND** requests explicit human resolution

## User Story: Verify And Review The Complete Ticket

As a workflow user,
I want the aggregate implementation independently checked against the approved behavior,
so that the implementing agents do not mark their own work complete.

### Scenario: Final verification with a green baseline

- **GIVEN** every phase has a verified commit
- **WHEN** final verification runs
- **THEN** every required full test, typecheck, lint, build, and runtime check passes
- **AND** every acceptance criterion, specification scenario, and protected behavior has explicit evidence

### Scenario: Final verification with an existing baseline failure

- **GIVEN** a verification command failed before implementation
- **WHEN** the same command runs after implementation
- **THEN** continuation is allowed only when the failure signature is demonstrably unchanged and unrelated to ticket-owned changes
- **AND** the baseline limitation is recorded in `PROGRESS.md` and the pull request
- **AND** any new or changed failure blocks continuation

### Scenario: Independent review passes

- **GIVEN** final local verification has completed
- **WHEN** a fresh read-only reviewer examines the aggregate ticket diff
- **THEN** it checks correctness, tests, acceptance criteria, scenarios, protected behaviors, plan adherence, scope, maintainability, security, performance, and breaking-change risk
- **AND** records required and optional findings in `REVIEWS.md`
- **AND** does not edit code

### Scenario: Required review findings are repaired

- **GIVEN** the first independent review contains required findings
- **WHEN** the coordinator starts review repair
- **THEN** one fresh repair agent addresses all required findings in separate append-only commits
- **AND** full verification runs again
- **AND** a second fresh read-only reviewer reviews the complete result
- **AND** any remaining required finding blocks pull request creation

### Scenario: Only optional findings remain

- **GIVEN** verification passes and the final review contains only optional findings
- **WHEN** the command prepares delivery
- **THEN** optional findings do not expand implementation scope
- **AND** they are listed in the pull request body

## User Story: Deliver The Ticket To Pull Request Review

As a workflow user,
I want verified and reviewed ticket work proposed through a pull request,
so that normal human and CI review can continue without implying merge or deployment.

### Scenario: Create a ready-for-review pull request

- **GIVEN** all required local verification and independent review evidence passes
- **WHEN** the coordinator delivers the branch
- **THEN** it performs a normal non-force push
- **AND** creates a ready-for-review pull request
- **AND** records the pull request URL and delivered-to-review state in `TO-PR.md`

### Scenario: Required runtime verification is unavailable

- **GIVEN** implementation, available automated checks, and independent review pass
- **AND** a required runtime check cannot execute because the agent environment lacks credentials, services, hardware, or interactive access
- **WHEN** the coordinator delivers the branch
- **THEN** it may create only a draft pull request
- **AND** the pull request lists every unverified check, reason, and required human action

### Scenario: Push is not a fast-forward

- **GIVEN** the remote branch has advanced or a normal push is rejected
- **WHEN** the coordinator attempts delivery
- **THEN** it does not force-push, rebase, or resolve conflicts automatically
- **AND** stops with the exact Git failure and required human action

### Scenario: Pull request content preserves evidence

- **GIVEN** a pull request is ready to create
- **WHEN** the coordinator constructs its title and body
- **THEN** it incorporates repository pull request templates when present
- **AND** summarizes purpose, implementation approach, phase commits, verification evidence, optional findings, accepted baseline failures, runtime limitations, and remaining human checks

### Scenario: Pull request creation is not production delivery

- **GIVEN** a pull request has been created
- **WHEN** the command records its outcome
- **THEN** the state is delivered to review
- **AND** the command does not claim remote CI success, merge readiness, merge, deployment, or production completion

## User Story: Halt On Unapproved Decisions

As a workflow user,
I want autonomous execution to stop when reality requires a new product or architecture decision,
so that passing checks cannot silently broaden the approved work.

### Scenario: Implementation requires scope expansion

- **GIVEN** implementation discovers a need for an unplanned production dependency, persistence migration, public API change, security-sensitive decision, destructive operation, acceptance-criterion change, or material architecture change
- **WHEN** the agent cannot satisfy the approved plan without that decision
- **THEN** the command stops
- **AND** requires the specification or plan to be revised and reviewed before a new invocation

## Protected Behaviors

- Existing `wf` commands retain their current behavior and remain independently invokable.
- The optional global `--worktree` modifier retains its existing setup and routing behavior.
- `SPEC.md` remains the source of truth for detailed observable behavior.
- `PLAN.md` remains the source of truth for approved implementation phases.
- `PROGRESS.md` remains the human-readable implementation and verification record.
- `REVIEWS.md` remains the plan and implementation review history.
- `STATUS.md` remains derived lifecycle progress, and ticket directory location remains lifecycle source of truth.
- The workflow metadata validator runs after every workflow-file mutation.
- Tests alone do not substitute for runtime evidence when a changed runnable surface can be exercised.
- The workflow never silently changes approved scope, dependencies, persistence shape, public contracts, or security posture.

## Out of Scope

- Creating, revising, or approving the ticket specification or plan within `wf to-pr`.
- Single-session fallback when fresh-agent orchestration is unavailable.
- Monitoring or repairing remote CI after pull request creation.
- Merging pull requests or deploying changes.
- Automatically resolving Git conflicts or divergent branches.
- Automatically stashing or discarding user changes.
- Rewriting, squashing, or folding review fixes into phase commits.
- Automatically fixing optional review findings.
- Automatically broadening the ticket to satisfy discovered requirements.
