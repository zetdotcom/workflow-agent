# wf-agent

`wf-agent` opens a local Kanban board for the current repository. It reads `.workflow/`, including uncommitted changes, and updates the board as tickets move. Its chat uses the provider you choose for the project.

## Build and launch

Use Node.js 22.13 or later on the 22.x line, or Node.js 23.4 or newer. Run these commands from the root of the workflow-agent checkout.

```sh
npm ci --prefix wf-agent
npm run build --prefix wf-agent
node wf-agent/bin/wf-agent.js
```

To view a different repository, run the launcher from the directory that contains that repository’s `.workflow/` folder.

```sh
node /absolute/path/to/workflow-agent/wf-agent/bin/wf-agent.js
```

The CLI prints a local URL and opens your default browser. Pass `--no-open` to print the URL without launching a browser. Keep the process running for live updates and press Ctrl+C to stop it.

## Chat and workflow actions

On first open, select a provider and click **Save provider**, or choose **Set up later** to browse the board. The project remembers your choice across browser visits and server restarts. To switch, open **Settings**, choose another provider, and save. **New chat** starts a conversation with the configured provider. Older transcripts show their provider. Switch back in Settings to continue one of those conversations.

| Provider | Local setup | Board capabilities |
| --- | --- | --- |
| Codex | Install the Codex CLI on your path and run `codex login`. Enable the `wf` skill for workflow actions. | Discussion, repository search and file reads, and approved `wf` actions. [Skill installation](../README.md#install-the-wf-skill) · [Codex app-server](https://developers.openai.com/codex/app-server) |
| Claude Code | Install the Claude Code CLI on your path and run `claude auth login`. The board uses safe and restricted modes, verified with CLI 2.1.332. | Discussion of the open board document and attached files. [Claude Code CLI](https://code.claude.com/docs/en/cli-reference) |
| GitHub Copilot | Sign in with `gh auth login` using a Copilot-enabled account. The board includes the Microsoft Copilot SDK and its platform runtime. | Discussion of the open board document and attached files. [Copilot SDK](https://github.com/microsoft/copilot-sdk) |

For Copilot and Claude, the board sends the text of the open change, ticket or archive record and the files you attach. Their combined limit is 96 KiB of UTF-8 text per message. The board reports a file problem before sending, so you can adjust the selection and retry.

- Ask about the open ticket or its plan. Type `@` to attach a repository file. The open ticket or change appears first, followed by matching paths across the repository, including hidden, ignored, and untracked files. Git internals and files outside the repository are excluded. Use the arrow keys and Tab to select a match. Shift+Enter inserts a newline.
- Ask for the status of a change or ticket, or ask to take a ticket to PR. Codex chooses the project tool and supplies its arguments. Inspect the target and select **Authorize and run** or **Decline**. A status run can repair stale workflow metadata.
- For `to-pr`, the preview includes the branch, delivery remote, specification, and plan. Authorization covers implementation, checks, independent review, and publication. Changed inputs require a fresh preview. The installed skill handles execution and recovery under the user’s Codex permissions. The board reports PR delivery from the completed ticket’s delivery journal.
- Consecutive calls appear together in a collapsed container labeled with their count, such as **tool calls (3)**. Select **Expand** on its right to see the list, then open any call to inspect its arguments and results. **Collapse** closes just that group.
- **Stop** interrupts an active run. **Chats** reopens the transcript. **New chat** starts an independent conversation, including while a workflow is running. Each checkout runs one authorized workflow at a time. Navigating between tickets keeps the current conversation open.

The board saves the project preference under `$XDG_STATE_HOME/wf-agent/projects` and keeps transcripts, pending proposals and board-owned runtime state in a separate directory per checkout. The default state root is `~/.local/state/wf-agent` on macOS and Linux or `%LOCALAPPDATA%\wf-agent` on Windows. Use a state location outside the project and its worktrees. Linked Git worktrees share the provider choice. Independent clones and standalone workflow directories have their own settings. Each provider handles its own credentials. A board restart preserves the transcript and marks interrupted work for inspection.

## Verify

From the workflow-agent checkout root, install the test browser and run the app suite.

```sh
npm run test:browser:install --prefix wf-agent
npm test --prefix wf-agent
```

The Playwright scenarios launch `wf-agent --no-open` from disposable repositories and drive the built app in Chromium. They cover empty and populated boards, navigation and ticket details, live updates with details open, archive browsing, and recovery after a workflow file is repaired. The repository tests also check stage derivation and CLI errors. See the [board requirements](docs/kanban-board-prd.md) for supported platforms and release checks.
