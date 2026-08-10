---
created: 2026-08-10
updated: 2026-08-10
---

# Worktree Support

## Problem Statement

Workflow Agent currently operates only in the caller's working tree. Users who want isolated branches and dependencies must create and enter Git worktrees manually before invoking `wf`.

## Goal

Let users request an isolated Git worktree from any workflow invocation, either through `--worktree` or an equivalent natural-language instruction, then continue the requested operation inside that worktree.

## Current State

Workflow commands resolve and mutate workflow state in the current project directory. The skill preserves unrelated worktree changes during implementation but does not create, select, or initialize worktrees.

## Desired State

- Treat `--worktree` as a global execution modifier rather than a command.
- Recognize natural-language requests to perform workflow work in a worktree.
- For commands such as `wf new <description> --worktree`, set up the worktree before running normal command behavior there.
- Ask what the worktree should use: a new branch, an available existing branch, or a detached snapshot.
- Recommend creating a new branch from the current branch. For a new branch, ask for its name and whether it starts from the current branch, `main`, or another ref.
- For an existing branch, explain that Git cannot normally check out a branch already active in another worktree. If unavailable, offer a new branch from it, a detached snapshot, or cancellation.
- For a detached snapshot, ask whether to use the current branch, `main`, or another ref and explain that commits will not belong to a branch unless one is created later.
- Create worktrees as sibling directories named `<repository>-<sanitized-branch-or-ref>`.
- If a matching branch or worktree exists, show it and ask whether to reuse it; never overwrite it.
- Before setup finishes, ask whether packages should be installed.
- When installation is requested, infer the package manager from repository lockfiles, show the proposed install command, and require confirmation before running it. If multiple lockfiles exist, ask which package manager to use. If none exist, report that installation was skipped.
- After worktree setup and optional package installation finish, continue the original `wf` command in the selected worktree.

## Scope

### In Scope

- Global `--worktree` parsing and natural-language intent handling.
- Interactive worktree mode, source ref, branch, reuse, and package-install decisions.
- Safe sibling worktree creation and command continuation in the resulting directory.
- Package-manager detection from lockfiles.
- User documentation and behavioral verification scenarios.

### Out of Scope

- Creating worktrees by default when not requested.
- Assigning one mandatory worktree per change, ticket, phase, or invocation.
- Automatic deletion or pruning of worktrees and branches.
- Overwriting existing worktrees or branches.
- Installing packages without explicit confirmation of the detected command.

## Constraints

- Worktree support must remain optional and available across all `wf` commands.
- Existing command references and lifecycle semantics must continue to apply after changing execution directory.
- Git operations must preserve user changes and avoid destructive conflict resolution.
- Prompts must use exact available choices when ambiguity exists.
- The interaction should use plain language such as "start from" rather than requiring users to understand Git's base-ref terminology.

## Dependencies

- Git repository with worktree support.
- Agent tools capable of running Git commands, asking questions, and changing working directory for subsequent operations.
- Recognizable package-manager lockfile when automatic install-command detection is requested.

## Risks

- Creating from the wrong base ref can isolate work from expected commits; always confirm branch and base.
- Branch or directory collisions can target unintended work; inspect both and require reuse confirmation.
- Detached work can produce unreachable commits if users misunderstand its branchless state; explain it before creation and report detached status afterward.
- Workflow metadata created only in an uncommitted source tree may not exist at the selected base ref; setup behavior must account for repository state before command continuation.
- Package installation can execute lifecycle scripts; show the exact command and require confirmation.
- Agent skill instructions cannot persist a process-level working directory, so every subsequent tool operation must explicitly target the selected worktree.

## Rollout Strategy

Ship as opt-in skill behavior. Document explicit and natural-language invocation examples. Verify creation, reuse, cancellation, invalid refs, collisions, and each supported package-manager lockfile before recommending broad use.

## Open Questions

- Whether explicit branch/source command-line options are worthwhile in addition to the simple interactive flow.
- Exact sanitization rules for branch or ref names used in sibling directory names.
- Which lockfiles and install commands should be recognized initially.

## Raw Context

Requested behavior: Workflow Agent should understand worktrees and create one when requested naturally or through `--worktree`. The flag should be globally available, including `wf new <description> --worktree`. Worktree creation is never implicit. Worktrees live beside the repository. Existing matches may be reused only after confirmation. Setup asks whether to install packages; an opted-in install is detected from lockfiles, displayed, and separately confirmed.

Discovery clarified that users may want a new branch based on the current branch or `main`, an available existing branch, or a detached snapshot of current, `main`, or another ref. Keep detached snapshots in scope. Recommend a new branch from current while presenting all modes. Use plain-language prompts and explain detached behavior. Name sibling directories from repository plus sanitized branch or ref. Ask which package manager to use when lockfiles conflict; skip installation when no lockfile is recognized. Continue the original workflow command after setup succeeds.
