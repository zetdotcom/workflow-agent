---
created: 2026-08-10
updated: 2026-08-10
---

# 003 — Documentation and Conformance Verification

## Summary

**Goal:** Make worktree behavior discoverable and provide repeatable evidence that routing, Git safety, installation, and distribution contracts remain aligned.

**Scope:** Update public documentation with explicit and natural-language examples, user choices, safety behavior, and package installation consent. Add lightweight automated checks for static contracts and reproducible Git scenarios where practical, plus a manual scenario checklist for agent interactions that cannot be automated reliably.

**Acceptance Criteria:**
- [ ] Public documentation explains opt-in worktree behavior, explicit and natural-language invocation, branch and detached choices, sibling naming, reuse confirmation, and command continuation.
- [ ] Documentation explains package-manager detection, multiple-lockfile choice, exact-command confirmation, lifecycle-script risk, and skip/failure behavior.
- [ ] Repeated public examples and compatibility claims remain consistent across maintained documentation surfaces.
- [ ] Automated verification checks that referenced workflow files exist and installation exposes the new worktree instructions.
- [ ] Disposable Git-repository checks cover practical creation, reuse, invalid-ref, occupancy, and path-collision command recipes without touching user repositories.
- [ ] A manual conformance checklist covers prompt choices, cancellation, detached warnings, package-manager cases, and original-command continuation.
- [ ] Verification instructions are documented and runnable without undocumented project tooling.

**Testing Required:**
- [ ] Run all added automated checks from a clean temporary environment and record successful results.
- [ ] Execute the manual conformance checklist for explicit modifier and natural-language flows.
- [ ] Verify development installation and documented installation paths include the new reference files.
- [ ] Review public documentation examples against final behavior from tickets `001` and `002`.

**Risk:** low

**Dependencies:** `001` — Global Worktree Routing and Git Setup; `002` — Confirmed Dependency Installation.

## Technical Deep-Dive

> ⚠️ VERIFY: Assumptions below are directional. Validate against actual code before implementing.

**Context:** Public workflow behavior is described in `README.md`, `llms.txt`, `index.html`, and `presentation.html`. Development installation symlinks the complete `skills/wf` directory, so new references should distribute automatically. The repository currently has no package manifest, CI workflow, or automated test harness; agent prompt adherence cannot be fully proved through shell tests.

**Suggested Approach:** Update only documentation surfaces that actively describe commands or feature capabilities, keeping examples synchronized. Add a small repository-native verification mechanism that checks reference integrity and exercises Git worktree command recipes in temporary repositories. Keep agent interaction coverage as a precise manual scenario matrix, separating what static or shell checks can prove from prompt-following behavior that requires an agent run.

**Files Likely Affected:**
- `README.md`
- `llms.txt`
- `index.html`
- `presentation.html` if it advertises workflow capabilities affected by this change
- `install.sh` only if verification exposes a distribution issue
- New verification files under `scripts/` or `tests/`

**Edge Cases / Gotchas:**
- Tests must create all repositories and worktrees under disposable temporary paths and clean them without touching existing user state.
- Static checks cannot guarantee an agent follows confirmation prompts or keeps subsequent tool calls scoped to the selected worktree.
- Documentation must not promise package managers, flags, or sanitization behavior beyond what tickets `001` and `002` implement.
- HTML documentation may duplicate prose and examples that are easier to overlook than Markdown sources.
