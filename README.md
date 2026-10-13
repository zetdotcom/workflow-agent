# workflow-agent

Unified workflow skill for AI coding agents. Persists active change context, tickets, plans, reviews, and progress, then distills terminal changes into searchable historical summaries so work and rationale survive across sessions.

```text
new -> discover -> breakdown -> specify? -> plan -> implement -> complete -> archive
                                        \-> optional reviews -/
```

## Usage

Invoke `wf` without arguments for an interactive menu, use a command directly, or describe what you want in natural language.

```text
wf
wf new
wf discover
wf breakdown
wf specify PYE-1123 001
wf plan PYE-1123 001
wf plan-review PYE-1123 001
wf implement PYE-1123 001 phase 1
wf impl-review PYE-1123 001
wf complete PYE-1123 001
wf archive PYE-1123
wf status archived
wf status archived PYE-1123
wf status
wf status PYE-1123 001
wf plan PYE-1123 001 --worktree
```

Add `--worktree` anywhere in any `wf` invocation, or ask naturally (for example, “plan LOCAL-1 001 in a separate worktree”). Worktree mode is always opt-in. Before normal command dispatch, agent offers:

- New branch from current commit (recommended), local `main`, or another validated ref.
- Available existing local branch.
- Detached snapshot, with warning that later commits do not belong to a branch.

New worktrees are siblings named `<repository>-<sanitized-branch-or-ref>`. Registered matching worktrees can be reused only after confirmation; occupied branches and path collisions are never overwritten. After setup, every workflow operation targets selected worktree explicitly. If selected ref lacks `.workflow/`, ticket commands stop instead of falling back to original tree; `wf new` may create metadata normally.

Setup then offers optional dependency installation. Root lockfiles map to frozen commands: `npm ci`, `pnpm install --frozen-lockfile`, Yarn `--frozen-lockfile` or `--immutable` based on declared Yarn major, and `bun install --frozen-lockfile`. Multiple managers require a choice. Agent shows exact command and directory, warns that lifecycle scripts may run, and asks again before execution. Declines and absent lockfiles continue without install; missing executables or failed commands require explicit continue/stop choice.

## Storage

Workflow data lives in the project being managed:

```text
.workflow/
├── changes/
│   └── PROJ-123-auth-refactor/
│       ├── CONTEXT.md
│       ├── STATUS.md
│       ├── 1.draft/
│       │   └── 001-remove-old-deposit/
│       │       ├── TICKET.md
│       │       └── SPEC.md
│       ├── 2.todo/
│       ├── 3.in-progress/
│       └── 4.done/
└── archive/
    └── 2026-12-05-PROJ-122-earlier-change/
        └── SUMMARY.md
```

Ticket directories move between numbered folders as their status changes. Directory location is source of truth; `STATUS.md` provides a concise progress view.

Files appear only when needed:

```text
001-remove-old-deposit/
├── TICKET.md       # Goal, scope, delivery criteria, risk, technical context
├── SPEC.md         # Optional confirmed user stories, scenarios, protected behaviors, exclusions
├── PLAN.md         # Detailed phased implementation plan and specification verification mapping
├── PLAN-BRIEF.md   # Concise human review of changes, data flow, decisions, and risks
├── PROGRESS.md     # Phase results, verification, deviations, and PR feedback
└── REVIEWS.md      # Plan and implementation reviews
```

Breakdown creates only `TICKET.md`. `wf specify` optionally creates or updates `SPEC.md` after the user confirms the ticket's behavior. Planning creates both `PLAN.md` and `PLAN-BRIEF.md`. Progress and review files are created lazily when first needed.

`SPEC.md` is ticket-scoped and just-in-time: large changes do not require every ticket's scenarios up front. It owns detailed user stories, observable GIVEN/WHEN/THEN scenarios, protected existing behavior, and explicit exclusions. When present, planning maps every scenario and protected behavior to verification; implementation records observed evidence; review and completion require full coverage. Material behavior changes return through `wf specify` for confirmation. Ticket splitting leaves deletion, parent retention, or narrowing of the original ticket to the user's instruction—no extra lifecycle state is introduced.

Ticket-scoped commands accept change IDs, ticket IDs, work item IDs, or slug fragments. They search `.workflow/changes/` file/folder names first, then file contents when needed. A unique change ID prefix such as `PYE-1123` can address `PYE-1123-change-deposit`; a unique work item ID can address its ticket directly, for example `wf status PYE-11391`.

Implementation plans are comprehensive and divided into independently verifiable vertical behavior slices. `PLAN.md` is implementation source of truth. `PLAN-BRIEF.md` gives humans a concise explanation of main changes, architecture/data flow, decisions, risks, rollout, testing, and review questions. Implementation records failing-before evidence when meaningful, focused checks, and a direct runtime smoke result for runnable surfaces. Use `wf implement PYE-1123 001 phase 3` to execute or resume one phase.

`done` means implementation completed; PR may be ready for review, ready to merge, merged, or receiving feedback. PR feedback can update code and ticket notes while ticket remains done. Explicit reopening moves it back to in-progress.

`wf archive` accepts any active change and records an explicit outcome: `completed`, `cancelled`, `superseded`, or `closed-incomplete`. It synthesizes actual outcome, lasting decisions, current invariants, stable code entry points, limits, verification, and references into one dated `SUMMARY.md`. Before mutation it previews the complete summary and every source path to be removed; cancellation changes nothing. After confirmation, it creates the archive record, removes the active change, and validates metadata. Detailed tickets, plans, reviews, and progress remain available through Git history rather than being copied into the archive.

Planning searches relevant archive summaries after codebase exploration, using verified paths, components, symbols, and domain terms. `wf status archived` lists records; `wf status archived <change>` or an ordinary status lookup with no active match opens one record.

## Commands

| Command | Purpose |
|---|---|
| `wf new` | Create a change and its workflow structure |
| `wf discover` | Turn raw context into a structured change definition |
| `wf breakdown` | Propose and create independently deployable tickets |
| `wf specify` | Optionally draft and confirm a ticket's behavior specification |
| `wf plan` | Explore code and write a detailed phased implementation plan |
| `wf plan-review` | Optionally review a plan before coding |
| `wf implement` | Execute and verify one implementation phase at a time |
| `wf impl-review` | Optionally review code against plan and acceptance criteria |
| `wf complete` | Mark a verified ticket done |
| `wf archive` | Distill an active change into a dated historical summary, then remove its active workspace after confirmation |
| `wf status` | Ask for change, then show scoped progress and next action |

## Install

### Skills CLI

```bash
npx skills add zetdotcom/workflow-agent --skill wf
```

Install globally:

```bash
npx skills add zetdotcom/workflow-agent --skill wf -g
```

### Development Symlink

Clone repository, then run:

```bash
./install.sh
```

Installer symlinks `skills/wf` to `~/.agents/skills/wf`. Edits in this repository become globally available immediately. Use `./install.sh --force` to replace an existing installation.

Custom destination:

```bash
AGENTS_SKILLS_DIR=/path/to/skills ./install.sh
```

## Skill Layout

```text
skills/wf/
├── SKILL.md
├── scripts/
│   └── validate-workflow.sh
└── references/
    ├── new.md
    ├── discover.md
    ├── breakdown.md
    ├── specify.md
    ├── plan.md
    ├── plan-review.md
    ├── implement.md
    ├── impl-review.md
    ├── complete.md
    ├── status.md
    ├── archive.md
    ├── archive-summary-template.md
    ├── worktree.md
    ├── context-template.md
    ├── ticket-template.md
    ├── spec-template.md
    ├── plan-template.md
    ├── plan-brief-template.md
    ├── progress-template.md
    └── reviews-template.md
```

`SKILL.md` owns routing and shared workflow contracts. Command references own operation-specific instructions; templates own generated file structure. The bundled validator provides a deterministic metadata feedback loop. All references resolve one level from the skill entry point.

## Compatibility

Works with agents supporting Agent Skills, filesystem tools, question/choice prompts, Git command execution, and explicit command working directories. Package-manager executable is needed only when optional dependency installation is confirmed.

## Verification

Run `./scripts/verify.sh` for Agent Skills structure, development-install exposure, workflow metadata validation, and disposable Git worktree recipes. Agent routing and behavioral scenarios live in `tests/manual-skill-conformance.md`; worktree prompt cases remain in `tests/manual-worktree-conformance.md`.

## License

MIT
