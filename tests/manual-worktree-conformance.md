# Manual Worktree Conformance

Run in disposable repositories. Record prompt choices, commands, working directories, and resulting `git worktree list --porcelain` output.

## Routing And Git

- [ ] `wf new --worktree` and `wf plan CHANGE 001 --worktree` enter setup before command reference; flag position does not matter.
- [ ] Natural-language request enters same setup; no worktree intent preserves old routing.
- [ ] New branch is recommended; current, local `main`, and custom ref show resolved commit before confirmation.
- [ ] Existing available branch works; occupied branch offers reuse/new branch/detached/cancel and never force-checks out.
- [ ] Detached choice warns commits have no branch, then reports detached commit.
- [ ] Matching registered worktree requires confirmation. Same-named unregistered directory is collision, not reuse.
- [ ] Invalid ref, invalid branch, cancellation, and invocation outside Git create no branch or worktree.
- [ ] Collision uses first free `-2`, `-3` sibling suffix and leaves existing paths unchanged.
- [ ] Every post-setup file operation uses selected absolute root and every Bash call uses selected working directory.
- [ ] Missing `.workflow/` stops non-`new` command without reading or writing caller tree.

## Dependency Installation

- [ ] Declining initial install question continues without package command.
- [ ] Each root lockfile maps to documented npm, pnpm, Yarn, or Bun command; nested-only lockfiles are ignored.
- [ ] Multiple managers show exact choices. Yarn 2+ declaration selects `--immutable`; absent declaration selects `--frozen-lockfile`.
- [ ] No lockfile reports skip. Reused worktree receives same install question.
- [ ] Final prompt shows exact command/path and lifecycle-script warning; declining continues without execution.
- [ ] Fake executable confirms command arguments and selected-worktree cwd.
- [ ] Missing executable or nonzero command asks continue-without-install or stop; no fallback command runs.

## Distribution

- [ ] Skills CLI project and global installs contain `references/worktree.md`.
- [ ] Public examples and package commands match final skill instructions.
