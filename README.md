# workflow-agent

Unified workflow skill for AI coding agents. Persists change context, tickets, plans, reviews, and progress in the repository so work can resume across sessions.

```text
new -> discover -> breakdown -> plan -> implement -> complete
                              \-> optional reviews -/
```

## Usage

Invoke `wf` without arguments for an interactive menu, use a command directly, or describe what you want in natural language.

```text
wf
wf new
wf discover
wf breakdown
wf plan PYE-1123 001
wf plan-review PYE-1123 001
wf implement PYE-1123 001 phase 1
wf impl-review PYE-1123 001
wf complete PYE-1123 001
wf status
wf status PYE-1123 001
```

## Storage

Workflow data lives in the project being managed:

```text
.workflow/
└── changes/
    └── PROJ-123-auth-refactor/
        ├── CONTEXT.md
        ├── STATUS.md
        ├── 1.draft/
        │   └── 001-remove-old-deposit/
        │       └── TICKET.md
        ├── 2.todo/
        ├── 3.in-progress/
        └── 4.done/
```

Ticket directories move between numbered folders as their status changes. Directory location is source of truth; `STATUS.md` provides a concise progress view.

Files appear only when needed:

```text
001-remove-old-deposit/
├── TICKET.md       # Goal, scope, acceptance criteria, risk, technical context
├── PLAN.md         # Detailed phased implementation plan
├── PLAN-BRIEF.md   # Concise human review of changes, data flow, decisions, and risks
├── PROGRESS.md     # Phase results, verification, deviations, and PR feedback
└── REVIEWS.md      # Plan and implementation reviews
```

Breakdown creates only `TICKET.md`. Planning creates both `PLAN.md` and `PLAN-BRIEF.md`. Progress and review files are created lazily when first needed.

Ticket-scoped commands resolve change first, then ticket. A unique change ID prefix such as `PYE-1123` can address `PYE-1123-change-deposit`.

Implementation plans are comprehensive and divided into independently verifiable phases. `PLAN.md` is implementation source of truth. `PLAN-BRIEF.md` gives humans a concise explanation of main changes, architecture/data flow, decisions, risks, rollout, testing, and review questions. Use `wf implement PYE-1123 001 phase 3` to execute or resume one phase.

`done` means implementation completed; PR may be ready for review, ready to merge, merged, or receiving feedback. PR feedback can update code and ticket notes while ticket remains done. Explicit reopening moves it back to in-progress.

## Commands

| Command | Purpose |
|---|---|
| `wf new` | Create a change and its workflow structure |
| `wf discover` | Turn raw context into a structured change definition |
| `wf breakdown` | Propose and create independently deployable tickets |
| `wf plan` | Explore code and write a detailed phased implementation plan |
| `wf plan-review` | Optionally review a plan before coding |
| `wf implement` | Execute and verify one implementation phase at a time |
| `wf impl-review` | Optionally review code against plan and acceptance criteria |
| `wf complete` | Mark a verified ticket done |
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
└── references/
    ├── new.md
    ├── discover.md
    ├── breakdown.md
    ├── plan.md
    ├── plan-review.md
    ├── implement.md
    ├── impl-review.md
    ├── complete.md
    ├── status.md
    ├── context-template.md
    ├── ticket-template.md
    ├── plan-template.md
    ├── plan-brief-template.md
    ├── progress-template.md
    └── reviews-template.md
```

`SKILL.md` owns routing and shared workflow contracts. Command references own operation-specific instructions; templates own generated file structure. All references resolve relative to skill directory.

## Compatibility

Works with agents supporting Agent Skills and filesystem tools. Interactive selection uses agent's question/choice tool.

## License

MIT
