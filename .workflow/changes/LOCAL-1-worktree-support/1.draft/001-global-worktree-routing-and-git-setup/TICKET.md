---
created: 2026-08-10
updated: 2026-08-10
---

# 001 — Global Worktree Routing and Git Setup

## Summary

**Goal:** Let users opt into a safe Git worktree from any workflow invocation and continue the original operation in the selected worktree.

**Scope:** Add global `--worktree` and natural-language intent handling; guide users through new-branch, existing-branch, or detached-snapshot selection; safely create or reuse a sibling worktree; and preserve normal workflow command behavior after setup. Package installation is excluded from this ticket.

**Acceptance Criteria:**
- [ ] `--worktree` is recognized as a global modifier regardless of command, including `wf new <description> --worktree`, without changing behavior when worktree mode is not requested.
- [ ] Equivalent natural-language worktree requests enter the same setup flow before normal command dispatch.
- [ ] Setup offers a new branch, an available existing branch, or a detached snapshot, recommending a new branch from the current branch and explaining detached behavior.
- [ ] New branches and detached snapshots can start from the current branch, `main`, or a validated user-supplied ref.
- [ ] Existing branch occupancy, registered worktrees, and target-path collisions are inspected before mutation; reuse requires explicit confirmation and nothing is overwritten.
- [ ] New worktrees use a safe sibling path derived from repository name and sanitized branch or ref, with deterministic collision handling.
- [ ] Cancellation and failed validation leave no new branch or worktree behind.
- [ ] After successful selection, the original workflow command continues under existing lifecycle rules with all subsequent operations explicitly targeting the selected worktree.
- [ ] Missing workflow metadata at the selected ref is reported and handled without mutating the original working tree.

**Testing Required:**
- [ ] Verify explicit modifier and natural-language routing across representative commands, including `new` and a ticket-scoped command.
- [ ] Verify new-branch creation from current, `main`, and another valid ref.
- [ ] Verify existing-branch selection, detached creation, matching-worktree reuse, occupied branch, invalid ref, directory collision, cancellation, and invocation outside a Git repository.
- [ ] Verify original command continuation occurs only in the selected worktree and existing behavior remains unchanged without worktree intent.

**Risk:** high

**Dependencies:** None.

## Technical Deep-Dive

> ⚠️ VERIFY: Assumptions below are directional. Validate against actual code before implementing.

**Context:** Workflow routing and shared contracts live in `skills/wf/SKILL.md`; command behavior lives in individual references. Existing instructions recognize commands but have no global pre-dispatch modifier stage. Agent tools cannot persist a process-level working directory, so continuation must carry the selected path into every subsequent operation.

**Suggested Approach:** Add a global pre-dispatch rule that detects and removes `--worktree` from the command payload or recognizes equivalent natural language, then loads a dedicated worktree setup reference before the normal command reference. Inspect repository root, current ref, branches, `git worktree list --porcelain`, and target path before offering exact choices. Define conservative sanitization for sibling directory names. Use non-destructive `git worktree add` forms for new branches, existing branches, and detached refs. Confirm reuse only when an existing registered worktree matches user intent. Preserve the original command and execute its normal workflow after setup using explicit worktree-scoped tool paths.

**Files Likely Affected:**
- `skills/wf/SKILL.md`
- `skills/wf/references/worktree.md` (new)

**Edge Cases / Gotchas:**
- Invocation may start in a repository subdirectory, linked worktree, or detached checkout; resolve common repository identity and current state explicitly.
- `main` may not exist, and a named ref may be remote-only or ambiguous.
- Git cannot normally check out one branch in multiple worktrees; present safe alternatives instead of forcing it.
- Existing directory and sanitized-name collisions must not be treated as reusable worktrees without registration and target validation.
- Selected refs may not contain uncommitted `.workflow/` metadata from the caller's tree.
- Partial Git failures must be reported without destructive cleanup or conflict resolution.
