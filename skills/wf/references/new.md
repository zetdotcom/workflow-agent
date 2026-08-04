# `wf new`

Create a new change folder.

## Steps

1. Ask user for:
   - Ticket number, Jira-style (for example, `PROJ-123`)
   - Short description for slug suffix (for example, `auth-refactor`)
   - Combine as `PROJ-123-auth-refactor`
2. Bootstrap `.workflow/changes/` if it does not exist.
3. Create:

   ```text
   .workflow/changes/<slug>/
   ├── CONTEXT.md
   ├── STATUS.md
   ├── 1.draft/
   ├── 2.todo/
   ├── 3.in-progress/
   └── 4.done/
   ```

4. Create `CONTEXT.md` from `references/context-template.md`. Set title and actual `created` and `updated` dates.
5. Create `STATUS.md`:

   ```markdown
   ---
   updated: YYYY-MM-DD
   ---
   # <Human-Readable Name>

   ## Progress: 0/0 done

   ### In Progress

   ### Todo

   ### Done
   ```

6. Report created path and suggest: `wf discover` to flesh out context, or add raw notes to `CONTEXT.md` first.

## Rules

- Do not create tickets; `wf breakdown` owns ticket creation.
- Keep bootstrap lightweight.
- If target slug exists, stop and ask whether user wants existing change instead. Do not overwrite it.
