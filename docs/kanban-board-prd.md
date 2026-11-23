# Local Kanban board for workflow-agent

## Phase 1 goal

A developer can open a read-only Kanban board from the terminal, see where work stands in the current repository, and inspect a change or ticket without hunting through Markdown files. All edits and lifecycle actions happen through the existing workflow.

## Phase 1 technology

Use TypeScript for the local Node.js process and the React interface. Node.js reads and watches `.workflow` and derives the board state from the ticket folders. React displays that state and renders the change and ticket details. Revisit the runtime if profiling identifies a bottleneck or a concrete platform requirement calls for a change.

## Launch and data source

The `wf-agent` command reads the local `.workflow` folder in the repository where the developer invokes it, including uncommitted changes. If the folder is missing, the command exits with a message that identifies the repository it checked and the folder it expected. An empty `.workflow` folder opens an empty board.

## Board

The Changes view opens by default. Each card shows the change ID, title, a short goal preview, and ticket progress, such as “1 of 3 done.” The app reads each ticket’s stage from its folder and uses those stages to place the change card.

| Column | When a change appears there |
| --- | --- |
| Draft | The change has no tickets, or all its tickets are drafts. |
| To Do | At least one ticket is To Do, and none are In Progress or Done. |
| In Progress | Any ticket is In Progress, or some tickets are Done and others remain. |
| Done | The change has at least one ticket and every ticket is Done. |

The Changes / Tickets toggle beside the board heading switches to a board of individual tickets from every unarchived change. Both ticket boards place tickets in their actual workflow stages, including Done. Each ticket card shows its number, title, and a parent change ID that links to the scoped board.

The board updates automatically when local workflow files change. Moving a ticket moves its card to the updated stage and keeps its details open.

## Change and ticket details

Opening a change card shows a board of its tickets. The heading shows the change ID and title, with a Back to changes link and a Change details action for the full goal and status. A change without tickets displays an empty board with a “No tickets yet” message.

Opening a ticket shows its goal, scope, and delivery criteria. The spec, plan, progress log, and reviews each have an expandable section when the corresponding file exists. Closing the panel returns to the board it was opened from. Each board view has its own URL and survives a refresh.

## Archive

Archiving a change in `wf` removes its card from the board. A separate Archive page lists archived changes newest first, showing the name, change ID, and archive date. Selecting an entry opens its saved archive summary.

## Success criterion

A developer can leave the board open beside their terminal, run `wf`, see a change advance, and inspect the ticket behind that progress.

## Supported platforms

Phase 1 supports macOS, Windows, and Linux. Verify both behaviors on each platform before release:

- Launching the app from a repository opens that repository’s board in the default browser.
- With a change’s details open, move its last unfinished ticket into `4.done/`. The card moves to Done automatically and the details stay open.

## Future work

Scheduled ticket runs should work with the terminal and browser closed. If the computer is awake at the scheduled time, the run starts then. If the computer sleeps through that time, the run starts when it wakes. The UI should show the actual start time. Scheduling belongs to a later phase.
