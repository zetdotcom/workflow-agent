---
created: 2026-08-10
updated: 2026-08-10
---

# 002 — Confirmed Dependency Installation

## Summary

**Goal:** Let users optionally install project dependencies in a selected worktree through a detected and explicitly confirmed package-manager command.

**Scope:** Extend worktree setup with an optional installation step after worktree selection. Detect supported package managers from root lockfiles, resolve multiple matches interactively, display the exact command and directory, require confirmation, and define safe behavior for skips and failures.

**Acceptance Criteria:**
- [ ] Worktree setup asks whether packages should be installed after worktree creation or reuse succeeds.
- [ ] Supported root lockfiles map to documented deterministic install commands for npm, pnpm, Yarn, and Bun.
- [ ] Multiple recognized lockfiles produce an exact package-manager choice instead of an inferred selection.
- [ ] No recognized lockfile causes installation to be skipped with a clear report.
- [ ] The exact command and selected worktree directory are shown, and a separate confirmation is required immediately before execution.
- [ ] Declining installation or command confirmation continues the original workflow command without installing packages.
- [ ] Missing executables and failed installs are reported without modifying another worktree; continuation requires an explicit user decision after failure.
- [ ] Installation is never triggered when worktree mode is not requested.

**Testing Required:**
- [ ] Verify each supported lockfile maps to the intended command and runs in the selected worktree.
- [ ] Verify multiple-lockfile selection, no-lockfile skip, declined installation, declined command confirmation, missing executable, and failed command behavior.
- [ ] Verify reused worktrees follow the same opt-in confirmation flow.
- [ ] Verify install lifecycle-script risk is disclosed before command execution.

**Risk:** medium

**Dependencies:** `001` — Global Worktree Routing and Git Setup.

## Technical Deep-Dive

> ⚠️ VERIFY: Assumptions below are directional. Validate against actual code before implementing.

**Context:** Ticket `001` introduces a dedicated global worktree setup flow and establishes the selected directory. This ticket adds dependency installation to that flow. Installation may execute package lifecycle scripts and modify lockfiles or generated files, so detection and execution need separate consent.

**Suggested Approach:** Define an explicit root-lockfile-to-command table in the worktree setup instructions. Detect all recognized lockfiles after selecting the worktree, ask the user to choose when more than one manager matches, and avoid guessing from `package.json` alone. Show the command and worktree path, warn that lifecycle scripts may run, and request final confirmation. Execute only with the selected worktree as the Bash working directory. On failure, report output and ask whether to continue the original workflow command without a successful install or stop.

**Files Likely Affected:**
- `skills/wf/references/worktree.md`
- `skills/wf/SKILL.md` if shared reference-loading rules require adjustment

**Edge Cases / Gotchas:**
- Confirm exact initial support for `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, and `bun.lockb` during planning.
- Yarn and Bun lockfile versions may require different available executables or commands.
- Monorepos can contain nested lockfiles; initial behavior should remain root-scoped unless repository conventions justify expansion.
- Frozen or clean install commands may reject stale lockfiles; failure must not silently fall back to a mutating command.
- Existing dependencies in a reused worktree do not remove the confirmation requirement.
