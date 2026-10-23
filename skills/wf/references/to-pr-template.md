---
created: YYYY-MM-DD
updated: YYYY-MM-DD
state: preflight
spec_identity: <git-object-id>
plan_identity: <git-object-id>
baseline_head: <git-commit-id>
baseline_branch: <branch-name>
baseline_paths_fingerprint: <path-set-fingerprint>
active_phase: 0
completed_phases: 0
phase_attempts: 0
review_cycle: 0
delivery_kind: none
runtime_limitation_recorded: no
browser_verification: not-applicable
completion_recorded: no
push_result: none
---

# Autonomous Ticket-to-PR Run

## State Contract

The execution states are `preflight`, `phase-N`, `final-verification`, `review`,
`review-repair`, `delivery`, `blocked`, and `delivered-to-review`.

Legal forward transitions are:

```text
preflight -> phase-1 -> ... -> final-verification -> review
review -> review-repair -> final-verification
review -> delivery -> delivered-to-review
```

`blocked` is reachable from every active state. A resumed run uses the last
durable state and the completed phase-commit ledger; it never repeats a
committed phase or creates a duplicate pull request.

## Phase Commit Ledger

| Phase | Commit | Verification |
|---|---|---|
| 1 | `<commit-id>` | `<exact command and result>` |

## Baseline Ownership

- Staged paths: `<path-set>`
- Unstaged paths: `<path-set>`
- Untracked paths: `<path-set>`
- Ticket-owned metadata exceptions: `<path-set>`

## Review And Delivery

- Required findings: `<count>`
- Optional findings: `<count>`
- Verification limitations: `<none or explicit limitations>`
- Browser verification: `not-applicable`, or exact `playwright-cli` commands,
  target URL, and observed results for the final aggregate implementation
- Runtime limitation recorded: `yes` only when draft delivery remains
  necessary because a required runtime check is unavailable; otherwise `no`
- Blocker: `<none or exact human action>`
- Pull request URL: `<url after delivery>`
- Delivery kind: `none`, `ready`, or `draft`
- Push result: `<none, success, or exact failure>`
- Completion recorded: `yes` or `no`
