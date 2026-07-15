# workflow-agent

A ticket-lifecycle workflow system for AI coding agents. Gives your agent structured project management — from initiative discovery through implementation to completion.

```
init → breakdown → plan → plan-review → implement → impl-review → complete
```

## Why

AI agents are great at coding but lose track of larger projects. They forget context between sessions, skip steps, and can't resume interrupted work. workflow-agent solves this by giving your agent a filesystem-based ticket system it can read and update autonomously.

## How It Works

Your codebase gets a `.workflow/` directory:

```
.workflow/
├── inits/
│   └── auth-refactor/
│       ├── SPEC.md              # Initiative scope & goals
│       ├── STATUS.md            # Progress tracker
│       ├── 1.backlog/           # Tickets not yet started
│       │   └── 002-jwt-rotation.md
│       ├── 2.ready/            # Planned, ready to implement
│       ├── 3.in-progress/      # Currently being worked on
│       └── 4.done/             # Completed & archived
```

Each ticket is a markdown file containing summary, acceptance criteria, technical deep-dive, implementation plan, and review notes — all managed by the agent through natural language commands.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| `wf-new-init` | "new init", "create initiative" | Bootstraps initiative folder structure |
| `wf-discover` | "discover", "flesh out spec" | Interviews you to build a complete SPEC.md before breakdown |
| `wf-breakdown` | "breakdown", "create tickets" | Interviews you, splits scope into deployable tickets |
| `wf-plan` | "plan NNN" | Explores codebase, writes implementation plan into ticket |
| `wf-plan-review` | "review plan NNN" | Checks plan for completeness, risks, feasibility |
| `wf-implement` | "implement NNN" | Executes the plan, writes code, runs tests |
| `wf-impl-review` | "review impl NNN" | Reviews code changes against plan + acceptance criteria |
| `wf-complete` | "done NNN", "complete NNN" | Verifies all AC met, archives ticket |
| `wf-status` | "status", "progress" | Read-only progress overview |
| `wf-how-to` | "how does workflow work" | Explains the system to new users |

## Install

### Skills CLI (recommended)

Repository already uses supported catalog layout: `skills/<skill-name>/SKILL.md`.

Install all workflow skills from this repo:

```bash
npx skills add <owner>/workflow-agent --skill '*'
```

Install globally for Zed / Cline / Warp and other agents that support global skills:

```bash
npx skills add <owner>/workflow-agent --skill '*' -g
```

Install only for Zed:

```bash
npx skills add <owner>/workflow-agent --skill '*' -a zed
```

Notes:
- `--skill '*'` matters here because repo contains multiple skills.
- Without it, `skills` CLI may prompt for selection instead of installing whole workflow set.
- After publishing repo to GitHub, replace `<owner>` with your GitHub account or org.

### Manual install

```bash
git clone https://github.com/YOUR_USER/workflow-agent.git
cd workflow-agent
./install.sh
```

This symlinks all skills to `~/.agents/skills/`. Use `--force` to overwrite existing skills.

To customize the install location:

```bash
AGENTS_SKILLS_DIR=/path/to/skills ./install.sh
```

### Cursor / Windsurf / Other Editors

These skills work as system prompts or custom instructions in any AI-powered editor:

1. **As rules/instructions**: Copy the content of any `SKILL.md` into your editor's custom instructions or rules file (e.g., `.cursorrules`, `.windsurfrules`)

2. **As context files**: Reference the SKILL.md files directly in your prompt or context configuration

3. **Key adaptation points**:
   - Replace tool-specific references (e.g., `TodoWrite`) with equivalents in your editor
   - The `.workflow/` directory structure is editor-agnostic — works anywhere
   - Trigger phrases work as natural language in any chat interface

The core workflow (folders + markdown tickets) requires no specific tooling — any agent that can read/write files can use it.

## For AI Agents

> This section is optimized for LLM consumption.

### System Overview

workflow-agent is a filesystem-based ticket lifecycle system. Tickets are markdown files that move between status folders (`1.backlog/` → `2.ready/` → `3.in-progress/` → `4.done/`). Each initiative lives under `.workflow/inits/<slug>/`.

### When to Invoke Each Skill

- User wants to **start a new project/epic** → `wf-new-init`
- User wants to **flesh out a spec before breakdown** → `wf-discover`
- User wants to **break work into tickets** → `wf-breakdown`
- User wants to **plan a specific ticket** → `wf-plan`
- User wants to **review a plan before coding** → `wf-plan-review`
- User wants to **write code for a ticket** → `wf-implement`
- User wants to **review implementation** → `wf-impl-review`
- User wants to **mark work as done** → `wf-complete`
- User wants to **check progress** → `wf-status`
- User wants to **understand the system** → `wf-how-to`

### Ticket File Format

```markdown
# NNN - Title

## Summary
Brief description of what this ticket delivers.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Deep-Dive
Implementation context, affected files, dependencies.

## Implementation Plan
<!-- Written by wf-plan -->

## Review Notes
<!-- Written by wf-plan-review and wf-impl-review -->
```

### Conventions

- Ticket numbers are zero-padded 3 digits: `001`, `002`, etc.
- Each ticket should be independently deployable (1-3 days of work)
- STATUS.md tracks overall progress per initiative
- Moving files between folders = changing status

## License

MIT
