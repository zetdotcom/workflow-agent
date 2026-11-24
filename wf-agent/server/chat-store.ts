import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ChatError, displayText, type ChatEntry, type ChatSummary, type ChatView, type HostPrompt, type WorkflowAction } from "./chat-model.js";

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
  constructor(private repository: string, private changed: (id: string) => void) {}

  private database() {
    if (this.db) return this.db;
    const base = process.env.XDG_STATE_HOME || (process.platform === "win32" && process.env.LOCALAPPDATA) || join(homedir(), ".local", "state");
    const directory = join(base, "wf-agent", createHash("sha256").update(this.repository).digest("hex"));
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(join(directory, "chats.sqlite"));
    try {
      db.exec(`PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated INTEGER NOT NULL, state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS entries (chat TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(chat, id));`);
    } catch (error) { db.close(); throw error; }
    this.db = db;
    return db;
  }

  list(): ChatSummary[] {
    return this.database().prepare("SELECT id,title,updated FROM chats ORDER BY updated DESC,rowid DESC").all() as unknown as ChatSummary[];
  }

  create() {
    const state: ChatState = { id: randomUUID(), title: "New chat", updated: Date.now() };
    this.database().prepare("INSERT INTO chats VALUES(?,?,?,?)").run(state.id, state.title, state.updated, JSON.stringify(state));
    this.changed(state.id);
    return state.id;
  }

  private read(id: string): ChatState {
    const row = this.database().prepare("SELECT state FROM chats WHERE id=?").get(id);
    if (!row) throw new ChatError(404, "Chat not found in this repository.");
    return JSON.parse(String(row.state));
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
    const { title, updated, proposal, prompt } = state;
    const rows = this.database().prepare("SELECT value FROM entries WHERE chat=? ORDER BY rowid").all(id);
    return { id, title, updated, proposal, prompt, running: Boolean(state.run), entries: rows.map(row => JSON.parse(String(row.value))) };
  }

  // State transitions and their activity entries commit together, including across board windows/processes.
  edit<T>(id: string, operation: (state: ChatState, emit: (entry: ChatEntry) => void) => T): T {
    const db = this.database();
    db.exec("BEGIN IMMEDIATE");
    let result: T;
    try {
      const state = this.read(id);
      result = operation(state, entry => {
        const value = { ...entry, title: displayText(entry.title), text: displayText(entry.text) };
        db.prepare("INSERT INTO entries VALUES(?,?,?) ON CONFLICT(chat,id) DO UPDATE SET value=excluded.value")
          .run(id, entry.id, JSON.stringify(value));
      });
      state.updated = Date.now();
      db.prepare("UPDATE chats SET title=?,updated=?,state=? WHERE id=?").run(state.title, state.updated, JSON.stringify(state), id);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    this.changed(id);
    return result;
  }

  claim(state: ChatState, workflow: boolean) {
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
