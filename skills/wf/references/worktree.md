# Global Worktree Setup

Prepare optional isolated execution root before normal `wf` command. Preserve normalized original command throughout this flow.

## 1. Inspect Repository

1. Verify invocation is inside Git repository with `git rev-parse --show-toplevel`. If not, stop without dispatching original command. Worktree mode requires Git; normal invocation without modifier remains unaffected.
2. Collect before mutation:
   - caller root and exact commit;
   - current symbolic branch, or detached state;
   - absolute common Git directory;
   - local `main` ref if it exists;
   - local branches;
   - `git worktree list --porcelain`.
3. Use first registered non-bare worktree as primary repository path. Its directory basename is repository name and its parent is sibling worktree parent. If no usable primary path exists, stop and report unsupported repository layout.

Use machine-readable Git commands such as:

```bash
git rev-parse --show-toplevel
git rev-parse --verify '<ref>^{commit}'
git symbolic-ref --quiet --short HEAD
git worktree list --porcelain
git check-ref-format --branch '<branch>'
```

Never parse human-oriented `git branch` or plain `git worktree list` when porcelain/ref commands are available.

## 2. Choose Mode

Use Question tool with exact available choices:

1. **New branch from current (Recommended)** - isolated branch starting at caller's exact commit.
2. **Available existing branch** - check out local branch not active in another worktree.
3. **Detached snapshot** - use exact commit without branch. Explain before selection: commits made there belong to no branch unless user creates one later.

For new branch:

1. Ask branch name and validate with `git check-ref-format --branch` before mutation.
2. If branch exists, do not overwrite. Show matching registered worktree when present and ask whether to reuse it; otherwise offer different branch name, new branch from existing branch, detached snapshot, or cancel.
3. Ask where to start: caller's exact current commit (Recommended), local `main` when it exists, or another ref.

For existing branch:

1. Offer exact local branches not active in another worktree.
2. If requested branch is active, show registered path. Offer reuse that worktree, create new branch from its exact commit, detached snapshot at its commit, or cancel. Never use force checkout.

For detached snapshot:

1. Repeat branchless-commit warning.
2. Ask source: caller's exact current commit (Recommended), local `main` when it exists, or another ref.

Resolve every selected source with `git rev-parse --verify '<ref>^{commit}'` and show resolved commit before mutation. `main` means exact local `refs/heads/main`; never silently substitute remote branch. Reject missing or ambiguous refs and ask again or cancel.

## 3. Derive Target

Derive label from branch name, or source ref for detached mode:

1. Convert ASCII uppercase to lowercase.
2. Replace each run outside `[a-z0-9._-]` with `-`.
3. Trim leading/trailing `.`, `_`, and `-` characters.
4. Use `worktree` if result is empty, `.` or `..`.

Target is sibling `<repository>-<label>`. Inspect both filesystem path and registered worktree inventory before mutation.

- If target is registered and identity matches intent, show path, branch or detached commit, and ask explicit reuse confirmation.
- Branch reuse matches full `refs/heads/<branch>`. Detached reuse matches resolved commit and detached status.
- Never reuse path based only on name. Existing unregistered directory is collision.
- For collision, choose first free deterministic suffix: `<target>-2`, then `-3`, and so on. Reinspect candidate before use.
- Never overwrite, delete, move, or force an existing path, branch, or worktree.

## 4. Confirm And Create

Show mode, source ref and resolved commit, branch when applicable, absolute target, and exact command. Ask confirmation immediately before execution.

Use non-destructive forms:

```bash
git worktree add -b '<new-branch>' '<target>' '<resolved-commit>'
git worktree add '<target>' '<existing-branch>'
git worktree add --detach '<target>' '<resolved-commit>'
```

Run from caller repository root. Never add `--force`.

On cancellation or failed validation, stop with no mutation. After command, inspect worktree inventory and target HEAD rather than assuming success. On failure:

1. Report exact failure and inspect whether target or new branch now exists.
2. Remove only artifact conclusively created by current attempt and only when ordinary non-force cleanup is safe; otherwise leave it and report exact residue.
3. Never delete pre-existing branch/path, force-remove worktree, reset, or run destructive conflict resolution.
4. Do not dispatch original command after failed setup.

## 5. Continue In Selected Root

After creation or confirmed reuse, selected absolute worktree path becomes execution root. Report path and branch or detached commit.

Before dispatching original command:

- For `new`, continue even when selected root lacks `.workflow/`; normal `new` behavior creates it.
- For any other command, if `.workflow/` is absent, report that selected ref does not contain workflow metadata and stop. Suggest a ref containing metadata or `wf new`; never copy metadata or fall back to caller tree.
- Read normal command reference only now and apply all file/Bash scoping rules from `SKILL.md`.

## 6. Offer Dependency Installation

After successful creation or confirmed reuse, ask whether to install project dependencies. Ask every time, including reused worktrees. Declining continues to metadata check and original command without running package tools.

When user opts in, inspect recognized lockfiles only at selected worktree root:

| Manager | Root lockfile | Command |
|---|---|---|
| npm | `package-lock.json` or `npm-shrinkwrap.json` | `npm ci` |
| pnpm | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| Yarn 1 | `yarn.lock` | `yarn install --frozen-lockfile` |
| Yarn 2+ | `yarn.lock` plus root `package.json` declaring `packageManager: yarn@<major>` where major is 2+ | `yarn install --immutable` |
| Bun | `bun.lock` or `bun.lockb` | `bun install --frozen-lockfile` |

Treat both npm lockfiles as one npm match and both Bun lockfiles as one Bun match. Ignore nested lockfiles. Do not infer manager from `package.json` alone. When `yarn.lock` exists but Yarn major is absent or cannot be read, use Yarn 1 command; do not guess Berry behavior.

- No recognized lockfile: report installation skipped and continue.
- One manager: select its documented command.
- Multiple managers: use Question tool with exact matched managers and commands. Never choose based on preference or lockfile timestamps.

Before execution, show exact command and absolute selected worktree directory. Warn clearly that package installation may execute project lifecycle scripts and modify generated files. Ask separate final confirmation immediately before execution.

- Declined final confirmation: continue without installation.
- Confirmed: first check selected executable is available, then run exact command with selected worktree as Bash working directory.
- Never run package commands in caller worktree and never install when worktree mode was not requested.
- Never retry with a less strict or lockfile-mutating fallback.

If executable is missing or command exits nonzero, show failure output and use Question tool to ask whether to continue original workflow command without successful installation or stop. Do not continue automatically after failure.

Package installation runs before metadata check and command dispatch.
