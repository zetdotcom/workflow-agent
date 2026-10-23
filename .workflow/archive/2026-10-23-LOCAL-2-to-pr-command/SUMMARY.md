---
change: LOCAL-2-to-pr-command
created: 2026-10-21
updated: 2026-10-23
archived: 2026-10-23
outcome: completed
---

# Autonomous Ticket-to-PR Workflow

## Outcome

Delivered the opt-in `wf to-pr` workflow contract for executing an approved
ticket through fresh-agent phase implementation, bounded repair, final
verification, independent review, safe Git delivery, and pull-request
creation. The implementation is committed as `989b09d` and proposed in draft
PR #1. Pull-request delivery remains distinct from CI success, merge,
deployment, or production completion.

## Current Behavior And Invariants

- `wf to-pr <change> <ticket>` requires approved `SPEC.md`, `PLAN.md`, and
  `PLAN-BRIEF.md`, plus fresh-agent dispatch and pull-request creation
  capabilities.
- `TO-PR.md` is the durable execution journal for approved input identities,
  baseline ownership, phase commits, verification, review, blockers, and
  delivery metadata.
- Every implementation phase uses a fresh agent, bounded repair, objective
  evidence, explicit staging, and an append-only commit before progression.
- Existing dirty work is preserved; overlap with ticket-owned paths blocks
  execution rather than triggering stash, reset, rebase, broad staging, or
  conflict resolution.
- Aggregate changes receive final verification and a fresh read-only review.
  Required findings use bounded append-only repair and re-review.
- Browser-runnable changes prefer `playwright-cli`. Observed failures enter
  bounded repair and block PR creation if unresolved. Unavailable browser
  verification permits only a draft PR with explicit human checks.
- Delivery uses a normal non-force push and records `delivered-to-review`;
  resume must not duplicate commits or pull requests.

## Lasting Decisions

### Filesystem-backed orchestration state

- **Decision:** Persist autonomous execution in ticket-scoped `TO-PR.md`
  rather than conversational state.
- **Rationale:** Durable identities, phase ledgers, ownership, and delivery
  metadata make interruption recovery auditable and deterministic.
- **Alternatives rejected:** Conversation-only memory and implicit inference
  from Git history.
- **Revisit when:** A host-neutral workflow runtime provides stronger
  transactional state without reducing repository portability.

### Append-only safety model

- **Decision:** Use explicit ticket-owned staging, immutable phase commits,
  separate repair commits, and normal non-force push.
- **Rationale:** This protects unrelated user work and makes autonomous
  changes reviewable and recoverable.
- **Alternatives rejected:** Stash/reset workflows, broad staging, rebasing,
  amending, squashing, force-pushing, or automatic conflict resolution.
- **Revisit when:** Git can prove safe hunk ownership and transactional
  recovery across mixed baseline edits.

### Qualified browser verification

- **Decision:** Prefer `playwright-cli` for browser flows, repair observed
  failures, and use draft delivery when browser verification is unavailable.
- **Rationale:** A missing tool is unavailable evidence, not failed behavior;
  a reproduced browser failure is actionable implementation evidence.
- **Alternatives rejected:** Blocking all work when Playwright is missing,
  substituting tests for browser evidence, or publishing known-broken behavior
  as a draft.
- **Revisit when:** Hosts provide a universal browser-verification capability
  with equivalent evidence.

## Codebase Map

- `skills/wf/SKILL.md` — routes `wf to-pr` and defines shared autonomous
  delivery invariants.
- `skills/wf/references/to-pr.md` — canonical preflight, state machine, phase,
  verification, review, safety, recovery, and delivery contract.
- `skills/wf/references/to-pr-template.md` — generated durable journal
  structure.
- `skills/wf/scripts/validate-workflow.sh` — validates journal lifecycle,
  state counters, delivery metadata, and contradictory combinations.
- `tests/static-contracts.sh` — protects routing, safety, browser, review, and
  distribution contracts.
- `tests/workflow-validation.sh` — exercises valid and invalid journal and
  lifecycle combinations in temporary local directories.
- `tests/manual-skill-conformance.md` — records host-dependent and end-to-end
  conformance scenarios.
- `README.md` and `llms.txt` — canonical user and machine-readable command
  documentation.

## Operational Changes

- Users may invoke `wf to-pr <change> <ticket>` after approving the current
  specification and plan.
- Browser verification policy and ready-versus-draft behavior are documented
  in `README.md` and `skills/wf/references/to-pr.md`.
- The command stops at pull-request review delivery; CI follow-up, merge, and
  deployment remain outside its scope.

## Known Limits And Incomplete Work

- `playwright-cli` was unavailable for direct inspection of the changed HTML
  documentation after the final browser-policy revision. PR #1 remains draft
  and requires human browser verification.
- The final Playwright-policy revision did not receive a fresh independent
  implementation review; completion used an explicit user-approved review
  limitation.
- Real fresh-agent dispatch, interruption recovery, push rejection, and
  pull-request creation remain host-dependent manual conformance evidence.
  Deterministic tests do not create temporary GitHub repositories.

## Verification And Rollout

- `./scripts/verify.sh` passed after the final repository changes.
- `bash skills/wf/scripts/validate-workflow.sh .` passed before archival.
- `git diff --check` passed before commit.
- Commit `989b09d` was pushed to `wf-to-pr`.
- Draft PR #1 is open for human and CI review.

## References

- Commit `989b09d` — `feat(wf): add autonomous ticket-to-pr delivery`
- PR #1 — https://github.com/zetdotcom/workflow-agent/pull/1
- `README.md`
- `skills/wf/references/to-pr.md`
