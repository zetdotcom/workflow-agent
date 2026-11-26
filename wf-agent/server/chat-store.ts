import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chatProvider, ChatError, displayText, type ChatEntry, type ChatProvider, type ChatSummary, type ChatView, type HostPrompt, type WorkflowAction } from "./chat-model.js";
import type { ProjectState } from "./project-state.js";

interface ChatState extends ChatSummary {
  thread?: string;
  run?: { id: string; pid: number; workflow: boolean };
  proposal?: WorkflowAction;
  prompt?: HostPrompt;
  lastOutcome?: string;
}

function ownerAlive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

export class ChatStore {
  private db?: DatabaseSync;
  constructor(private storage: ProjectState, private changed: (id: string) => void) {}

  runtimeDirectory(provider: ChatProvider) {
    const directory = this.storage.location(this.storage.checkoutKey, "providers", provider);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return directory;
  }

  private database() {
    if (this.db) return this.db;
    const chats = this.storage.location(this.storage.checkoutKey, "chats.sqlite");
    const settings = this.storage.location("projects", this.storage.projectKey, "settings.sqlite");
    for (const file of [chats, settings]) mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(chats);
    try {
      db.exec("PRAGMA busy_timeout = 5000");
      db.prepare("ATTACH DATABASE ? AS project").run(settings);
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated INTEGER NOT NULL, state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS entries (chat TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(chat, id));
        CREATE TABLE IF NOT EXISTS project.settings (id INTEGER PRIMARY KEY CHECK (id = 1), provider TEXT NOT NULL);`);
      if (db.prepare("PRAGMA main.user_version").get()?.user_version === 0) {
        db.exec(`UPDATE chats SET state = json_set(state, '$.provider', 'codex') WHERE json_type(state, '$.provider') IS NULL;
          PRAGMA main.user_version = 1;`);
      }
      db.exec("COMMIT");
    } catch (error) { db.close(); throw error; }
    this.db = db;
    return db;
  }

  list(): ChatSummary[] {
    return this.database().prepare("SELECT id,title,updated,json_extract(state,'$.provider') AS provider FROM chats ORDER BY updated DESC,rowid DESC").all()
      .map(row => ({ id: String(row.id), title: String(row.title), updated: Number(row.updated), provider: chatProvider(row.provider) }));
  }

  private transaction<T>(operation: (db: DatabaseSync) => T): T {
    const db = this.database();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation(db);
      db.exec("COMMIT");
      return result;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }

  provider(): ChatProvider | null {
    const row = this.database().prepare("SELECT provider FROM project.settings WHERE id=1").get();
    return row ? chatProvider(row.provider) : null;
  }

  setProvider(provider: ChatProvider, expected: ChatProvider | null) {
    this.transaction(db => {
      const current = this.provider();
      if (current === provider) return;
      if (current !== expected) throw new ChatError(409, "Project Settings changed in another window. Review the current provider and try again.");
      db.prepare("INSERT INTO project.settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider").run(provider);
    });
  }

  private configuredProvider(expected?: ChatProvider) {
    const current = this.provider();
    if (!current) throw new ChatError(409, "Set up a chat provider in project Settings first.");
    if (expected !== undefined && current !== expected) throw new ChatError(409, "This chat uses a different provider. Start a new chat or change the provider in Settings.");
    return current;
  }

  create(expected?: ChatProvider) {
    const id = this.transaction(db => {
      const state: ChatState = { id: randomUUID(), provider: this.configuredProvider(expected), title: "New chat", updated: Date.now() };
      db.prepare("INSERT INTO chats VALUES(?,?,?,?)").run(state.id, state.title, state.updated, JSON.stringify(state));
      return state.id;
    });
    this.changed(id);
    return id;
  }

  messageProvider(id: string, workflow = false) {
    const provider = this.configuredProvider(this.read(id).provider);
    this.storage.checkProviderHome(provider, workflow);
    return provider;
  }

  private read(id: string): ChatState {
    const row = this.database().prepare("SELECT state FROM chats WHERE id=?").get(id);
    if (!row) throw new ChatError(404, "Chat not found in this repository.");
    const state: ChatState = JSON.parse(String(row.state));
    chatProvider(state.provider);
    return state;
  }

  view(id: string): ChatView {
    let state = this.read(id);
    if (state.run && !ownerAlive(state.run.pid)) {
      this.edit(id, (current, emit) => {
        if (current.run && !ownerAlive(current.run.pid)) {
          delete current.run;
          delete current.prompt;
          delete current.proposal;
          emit({ id: randomUUID(), kind: "error", title: "Run interrupted", text: "The board process stopped. Review the recorded activity before starting again." });
        }
      });
      state = this.read(id);
    }
    const { title, updated, proposal, prompt, provider } = state;
    const rows = this.database().prepare("SELECT value FROM entries WHERE chat=? ORDER BY rowid").all(id);
    return { id, title, updated, provider, proposal, prompt, running: Boolean(state.run), entries: rows.map(row => JSON.parse(String(row.value))) };
  }

  // State transitions and their activity entries commit together, including across board windows/processes.
  edit<T>(id: string, operation: (state: ChatState, emit: (entry: ChatEntry) => void) => T): T {
    const result = this.transaction(db => {
      const state = this.read(id);
      const result = operation(state, entry => {
        const value = { ...entry, title: displayText(entry.title), text: displayText(entry.text) };
        db.prepare("INSERT INTO entries VALUES(?,?,?) ON CONFLICT(chat,id) DO UPDATE SET value=excluded.value")
          .run(id, entry.id, JSON.stringify(value));
      });
      state.updated = Date.now();
      db.prepare("UPDATE chats SET title=?,updated=?,state=? WHERE id=?").run(state.title, state.updated, JSON.stringify(state), id);
      return result;
    });
    this.changed(id);
    return result;
  }

  claim(state: ChatState, workflow: boolean) {
    this.configuredProvider(state.provider);
    if (state.run && ownerAlive(state.run.pid)) throw new ChatError(409, "This chat already has a running request.");
    if (workflow) {
      for (const row of this.database().prepare("SELECT state FROM chats WHERE id<>? AND json_extract(state,'$.run.workflow')=1").all(state.id)) {
        const other: ChatState = JSON.parse(String(row.state));
        if (other.run && ownerAlive(other.run.pid)) throw new ChatError(409, "Another workflow is running in this repository.");
      }
    }
    state.run = { id: randomUUID(), pid: process.pid, workflow };
    delete state.prompt;
    return state.run.id;
  }

  close() { this.db?.close(); }
}
