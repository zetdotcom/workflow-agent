---
created: 2026-10-21
updated: 2026-10-21
---

# Autonomous Ticket-to-PR Workflow

## Problem Statement

The workflow agent supports specification, planning, phased implementation, implementation review, and completion as separate commands. After a human approves a ticket specification and plan, the remaining delivery work still requires repeated manual command invocation and coordination.

The workflow has no single command that can implement an approved ticket phase by phase, verify each phase, preserve resumable progress, run an independent review, and create a pull request without lowering the existing verification standard.

## Goal

Add a ticket-scoped `wf to-pr` command that autonomously executes a human-approved `SPEC.md` and `PLAN.md` through local implementation, verification, independent review, safe Git commits, push, and pull request creation.

A successful run creates a locally verified, ready-for-review pull request. It does not promise remote CI success, merge, deployment, or production delivery.

## Current State

- A human invokes `wf implement` separately for each plan phase.
- A human invokes `wf impl-review` after implementation.
- `wf complete` records implementation completion but does not commit, push, or create a pull request.
- Workflow files preserve implementation evidence, but no file records resumable orchestration state.
- Worktree support can create or reuse an isolated Git worktree, but it is not required by implementation commands.

## Desired State

After reviewing and approving the current ticket specification and plan, a human runs:

```text
wf to-pr <change> <ticket>
```

The command treats invocation as approval of the current `SPEC.md` and `PLAN.md`, records their content identities, establishes the repository baseline, and then:

1. Dispatches every incomplete phase to a fresh implementation agent.
2. Verifies the phase using planned checks or repository-derived checks.
3. Repairs phase failures within a bounded budget.
4. Creates one immutable commit for each verified phase.
5. Runs final cross-phase verification.
6. Dispatches a separate read-only reviewer with fresh context.
7. Automatically repairs required findings once, reverifies, and re-reviews once.
8. Pushes normally without force and creates a pull request.

The command creates a ready-for-review PR when all required local evidence exists. If required runtime verification is unavailable because of environment limitations, it may create only a draft PR that clearly lists the unverified checks.

## Scope

### In Scope

- New ticket-scoped `to-pr` command and routing.
- Required fresh implementation agent per phase.
- Separate fresh read-only review agents.
- Durable `TO-PR.md` execution journal and interruption recovery.
- Baseline capture and isolation from pre-existing dirty-worktree changes.
- Focused phase verification, runtime verification, and final repository verification.
- Bounded phase repair and one bounded review-repair cycle.
- Verified phase commits and separate review-fix commits.
- Normal branch push and pull request creation.
- Ready-versus-draft PR rules.
- Explicit halt and escalation policy.
- Metadata validation and conformance tests.

### Out of Scope

- Creating or approving `SPEC.md` or `PLAN.md`.
- Merging pull requests.
- Deploying or shipping to production.
- Automatically resolving merge conflicts or non-fast-forward pushes.
- Monitoring or repairing remote CI after pull request creation.
- Rewriting or squashing phase commit history.
- Automatically stashing, discarding, or committing unrelated user changes.
- Supporting hosts that cannot dispatch fresh agents.
- Autonomous changes to approved scope, acceptance criteria, public APIs, persistence schemas, production dependencies, or security posture.

## Constraints

- Invocation of `wf to-pr` is the human approval signal for the current specification and plan; no separate approval metadata is required.
- `SPEC.md` and `PLAN.md` identities must be recorded at start. Any later content change blocks the run until the human invokes the command again.
- Every phase must leave the repository in a working state and produce objective verification evidence before commit.
- A phase may derive missing or stale verification commands from repository conventions, but it may not weaken a specified check after failure.
- Phase repair permits at most three attempts and stops earlier when the same failure repeats without a new diagnosis.
- Required review findings receive one automatic repair cycle followed by one fresh re-review.
- Pre-existing failures may be tolerated only when the final failure signature is demonstrably unchanged and unrelated.
- Existing dirty changes may remain, but the command must never stage baseline changes. A phase that needs a path already modified at baseline must block.
- Git staging must use explicit ticket-owned paths or equivalent patch-level isolation; broad staging commands are forbidden.
- Push must be a normal non-force push. Divergence blocks the run.
- Hosts without fresh-agent orchestration must refuse `to-pr` cleanly.

## Domain Language

- **Phase agent:** A fresh implementation agent assigned exactly one plan phase.
- **Repair attempt:** A targeted correction by the active phase agent after a failed phase check.
- **Independent reviewer:** A fresh agent that reviews the aggregate ticket diff and cannot edit code.
- **Required finding:** A critical or required review issue that blocks pull request creation.
- **Optional finding:** A non-blocking review observation recorded in the pull request.
- **Baseline changes:** Uncommitted repository changes present before `to-pr` starts.
- **Ticket-owned changes:** Changes introduced by the autonomous run and safe to stage and commit.
- **Delivered to review:** A pull request has been created. This does not mean CI passed, the ticket merged, or the change deployed.

## Dependencies

- Agent host support for dispatching fresh implementation and review agents.
- Git branch suitable for a normal push.
- GitHub pull request creation capability.
- Repository-defined build, test, lint, typecheck, and runtime commands where applicable.

## Risks

- Verification proxies may pass while behavior remains incorrect. Mitigate with acceptance-criterion mapping, runtime evidence, diff integrity checks, and independent review.
- Dirty-worktree overlap can mix user and agent work. Block whenever a ticket phase needs a baseline-modified path.
- Agent-written tests can encode the implementation mistake. Require pre-change evidence where practical and review tests before production code.
- Repeated repairs can consume unbounded resources. Enforce the retry budget and repeated-diagnosis stop.
- Fresh phase agents may repeat repository discovery. Persist concise phase results and decisions in repository files.
- Pull request creation can be mistaken for successful delivery. Use explicit delivered-to-review terminology and preserve CI limitations.

## Rollout Strategy

Implement the command as an opt-in workflow route. Preserve every existing command unchanged. Add static contract tests and manual conformance scenarios before using `to-pr` on production work.

## Open Questions

- Exact host-neutral interface used to dispatch fresh agents.
- Exact `TO-PR.md` schema and machine-readable state representation.
- How the coordinator identifies and stages ticket-owned hunks when a touched file also changes after baseline capture.
- Pull request title/body composition and repository PR-template integration.
- Whether successful PR creation automatically invokes existing `wf complete` semantics or records a separate delivered-to-review state.

## Raw Context

The design draws limited inspiration from Ralph-style execution: fresh contexts, filesystem-backed memory, bounded retries, and deterministic completion signals. Unlike an open-ended Ralph loop, `wf to-pr` executes a finite, human-approved phase list through explicit resumable states.

