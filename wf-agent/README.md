# wf-agent

`wf-agent` opens a read-only Kanban board for the current repository. It reads `.workflow/`, including uncommitted changes, and updates the board as tickets move. Use the `wf` skill to edit tickets and advance their workflow. [Skill installation](../README.md#install-the-wf-skill)

## Build and launch

With Node.js 22.12 or newer, run these commands from the root of the workflow-agent checkout.

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

## Verify

From the workflow-agent checkout root, install the test browser and run the app suite.

```sh
npm run test:browser:install --prefix wf-agent
npm test --prefix wf-agent
```

The suite checks stage derivation, CLI errors, live ticket moves with details open, and archiving in disposable repositories. See the [board requirements](docs/kanban-board-prd.md) for supported platforms and release checks.
