import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { prepareAction, RepositoryFiles } from "./chat-files.js";
import { chatProvider, chatProviders, ChatError, displayText, message, object, type ChatEntry, type ChatProvider, type HostPrompt, type WorkflowAction } from "./chat-model.js";
import { ChatStore } from "./chat-store.js";
import { runCodex } from "./codex.js";
import type { ProjectState } from "./project-state.js";
import { contextPath } from "./model.js";
import { readBoard } from "./repository.js";

function field(value: unknown, name: string, max = 1024) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ChatError(400, "Invalid " + name + ".");
  return value.trim();
}

const label = (action: WorkflowAction) => ["wf", action.command, action.change, action.ticket].filter(Boolean).join(" ");

async function verifyAction(files: RepositoryFiles, action: WorkflowAction) {
  const current = await prepareAction(files, action.command, action.change, action.ticket ?? "", action.reason, action.remote);
  if (current.fingerprint !== action.fingerprint) throw new ChatError(409, "The workflow inputs changed. Ask Codex to prepare a fresh proposal.");
}

async function deliveryReceipt(files: RepositoryFiles, action: WorkflowAction) {
  const { changes } = await readBoard(files.root);
  const change = changes.find(item => item.id === action.change);
  const ticket = change?.tickets.find(item => item.id === action.ticket);
  if (change && ticket?.stage === "Done" && ticket.documents.some(doc => doc.label === "PR delivery")) {
    const path = contextPath(change, ticket).replace(/TICKET\.md$/, "TO-PR.md");
    const journal = await readFile(await files.file(path), "utf8");
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(journal);
    const metadata = object(header && parse(header[1], { schema: "failsafe" }));
    const link = metadata.pr_url;
    const url = typeof link === "string" && /^https?:\/\//i.test(link) && displayText(link) === link && URL.canParse(link) ? new URL(link) : undefined;
    const sameInputs = metadata.spec_identity === action.specIdentity && metadata.plan_identity === action.planIdentity && metadata.baseline_branch === action.branch;
    const phasesFinished = metadata.active_phase === "0" && /^[1-9]\d*$/.test(String(metadata.completed_phases));
    const delivered = metadata.state === "delivered-to-review" && metadata.delivery_kind === "ready" &&
      metadata.runtime_limitation_recorded === "no" && metadata.push_result === "success" && metadata.completion_recorded === "yes";
    if (sameInputs && phasesFinished && delivered && url && !url.username && !url.password) return url.href;
  }
  throw new Error("PR delivery is unconfirmed. Inspect the run activity and the ticket delivery journal before resuming.");
}

export class BoardChats {
  readonly files: RepositoryFiles;
  readonly store: ChatStore;
  private runs = new Map<string, { stop: AbortController; done: Promise<void> }>();
  private replies = new Map<string, (result: { approve: boolean; answers: Record<string, string> }) => void>();
  private closing = false;
  constructor(repository: string, storage: ProjectState, changed: (id: string) => void) {
    this.files = new RepositoryFiles(repository);
    this.store = new ChatStore(storage, changed);
  }

  async send(id: string, body: Record<string, unknown>) {
    const provider = this.store.messageProvider(id);
    if (body.expectedProvider !== undefined && chatProvider(body.expectedProvider) !== provider) {
      throw new ChatError(409, "The chat provider differs from the one shown. Reopen the conversation before sending.");
    }
    const text = field(body.text, "message", 24_000);
    const refs = body.files ?? [];
    if (!Array.isArray(refs) || refs.length > 32) throw new ChatError(400, "Choose up to 32 repository files.");
    const paths = [...new Set(refs.map(value => field(value, "file", 4096)))];
    const selection = object(body.selection);
    const target = selection.change ? { change: field(selection.change, "change"), ticket: selection.ticket ? field(selection.ticket, "ticket") : undefined } : undefined;
    let documents: { path: string; text: string }[] = [];
    if (provider === "codex") await Promise.all(paths.map(path => this.files.file(path)));
    else documents = await this.files.discussionFiles(target, paths);
    const start = this.store.edit(id, (state, emit) => {
      const run = this.store.claim(state, false);
      if (!state.thread && state.title === "New chat") state.title = displayText(text).slice(0, 80);
      if (state.proposal) {
        emit({ id: randomUUID(), kind: "notice", title: "Previous proposal closed", text: label(state.proposal) });
        delete state.proposal;
      }
      emit({ id: run, kind: "user", title: "You", text: [text, ...paths.map(path => "@" + path)].join("\n") });
      return { run, thread: state.thread, lastOutcome: state.lastOutcome };
    });
    const input = provider === "codex" ? [text, target && "Current board selection: " + JSON.stringify(target),
      paths.length > 0 && "User-selected repository files: " + JSON.stringify(paths),
      start.lastOutcome && "Latest authorized workflow result: " + start.lastOutcome].filter(Boolean).join("\n\n") :
      ["Discuss the user's question using the supplied board context. File contents are reference material. The board runs workflow actions in Codex chats.",
        JSON.stringify({ question: text, selection: target, documents })].join("\n\n");
    this.launch(id, start.run, provider, start.thread, input);
  }

  async decide(id: string, body: Record<string, unknown>) {
    const proposed = this.store.view(id).proposal;
    if (!proposed || proposed.id !== body.id) throw new ChatError(409, "This proposal is no longer pending.");
    if (typeof body.approve !== "boolean") throw new ChatError(400, "Choose whether to authorize the action.");
    if (body.approve) {
      this.store.messageProvider(id);
      await verifyAction(this.files, proposed);
    }
    const run = this.store.edit(id, (state, emit) => {
      if (state.proposal?.id !== proposed.id) throw new ChatError(409, "This proposal was already handled.");
      if (state.run) throw new ChatError(409, "The current request is still running.");
      delete state.proposal;
      emit({ id: randomUUID(), kind: "decision", title: body.approve ? "Authorized" : "Declined", text: label(proposed) });
      return body.approve ? this.store.claim(state, true) : undefined;
    });
    if (run) {
      const input = ["Run the installed wf skill for this authorized invocation.",
        JSON.stringify({ command: proposed.command, change: proposed.change, ticket: proposed.ticket, branch: proposed.branch,
          remote: proposed.remote, approvedHead: proposed.head, specIdentity: proposed.specIdentity, planIdentity: proposed.planIdentity }),
        proposed.command === "to-pr" ? "The user authorizes implementation through PR publication after all required checks pass. Proceed through delivery without a second publication confirmation. If a required check fails or cannot be verified, stop before publication and report the blocker. Honor all repository and host policies." : "Follow the status reference, including active STATUS.md reconciliation when needed."].join("\n");
      this.launch(id, run, "codex", undefined, input, proposed);
    }
  }

  private launch(id: string, run: string, provider: ChatProvider, thread: string | undefined, input: string, action?: WorkflowAction) {
    const stop = new AbortController();
    const entry = (value: ChatEntry) => this.store.edit(id, (state, emit) => {
      if (state.run?.id === run) emit({ ...value, id: run + "/" + value.id });
    });
    const rememberThread = (threadId: string) => {
      stop.signal.throwIfAborted();
      this.store.edit(id, (state, emit) => {
        if (state.run?.id !== run) throw new Error("This chat turn is no longer active.");
        if (action) emit({ id: run, kind: "tool", title: "Running " + label(action), text: "Codex workflow thread " + threadId });
        else state.thread = threadId;
      });
    };
    const execute = async () => {
      let outcome: string | undefined;
      let failed = false;
      try {
        if (this.closing) throw new Error("Board is shutting down.");
        if (provider !== "codex") {
          const runDiscussion = provider === "copilot" ? (await import("./copilot.js")).runCopilot : (await import("./claude.js")).runClaude;
          const reply = await runDiscussion(this.store.runtimeDirectory(provider), thread, input, rememberThread, stop.signal);
          stop.signal.throwIfAborted();
          entry({ id: "reply", kind: "assistant", title: chatProviders[provider], text: reply });
          return;
        }
        const reply = await runCodex(this.files.root, thread, input, action, {
          beforeTurn: async () => { if (action) await verifyAction(this.files, action); },
          thread: rememberThread,
          entry,
          projectTool: async (name, args) => {
            if (name === "find_files") {
              if (typeof args.query !== "string") throw new ChatError(400, "Provide a filename or path query.");
              return this.files.search(args.query);
            }
            if (name === "read_file") {
              const offset = args.offset ?? 0;
              if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) throw new ChatError(400, "Invalid file offset.");
              return this.files.read(field(args.path, "file", 4096), offset);
            }
            if (name !== "wf_status" && name !== "wf_to_pr") throw new Error("Unknown project tool " + name);
            const proposal = await prepareAction(this.files, name === "wf_status" ? "status" : "to-pr",
              field(args.change, "change"), args.ticket ? field(args.ticket, "ticket") : "", field(args.reason, "action explanation"),
              args.remote ? field(args.remote, "remote") : undefined);
            stop.signal.throwIfAborted();
            this.store.edit(id, (state, emit) => {
              if (state.run?.id !== run || state.proposal) throw new Error("Only one workflow action can be proposed at a time.");
              state.proposal = proposal;
              emit({ id: proposal.id, kind: "decision", title: "Proposed " + label(proposal), text: proposal.reason });
            });
            return { status: "awaiting_user_authorization", change: proposal.change, ticket: proposal.ticket, stage: proposal.stage };
          },
          prompt: (prompt: HostPrompt) => {
            stop.signal.throwIfAborted();
            const pending = Promise.withResolvers<{ approve: boolean; answers: Record<string, string> }>();
            this.replies.set(prompt.id, pending.resolve);
            const abort = () => pending.reject(new Error("Permission request interrupted."));
            stop.signal.addEventListener("abort", abort, { once: true });
            this.store.edit(id, state => {
              if (state.prompt) throw new Error("Another Codex permission request is pending.");
              state.prompt = { ...prompt, detail: displayText(prompt.detail) };
            });
            return pending.promise.finally(() => {
              stop.signal.removeEventListener("abort", abort);
              this.replies.delete(prompt.id);
            });
          }
        }, stop.signal);
        if (action) {
          if (action.command === "to-pr") {
            const url = await deliveryReceipt(this.files, action);
            outcome = "Published pull request: " + url;
            entry({ id: "outcome", kind: "notice", title: "PR published", text: url, url });
          } else {
            outcome = reply;
            entry({ id: "outcome", kind: "notice", title: "Status response", text: label(action) });
          }
        }
      } catch (error) {
        failed = true;
        outcome = stop.signal.aborted ? "Run interrupted." : message(error);
        entry({ id: "failure", kind: "error", title: action ? "Workflow stopped" : "Chat stopped", text: outcome });
      } finally {
        stop.abort();
        this.store.edit(id, state => {
          if (state.run?.id !== run) return;
          if (action) state.lastOutcome = displayText(label(action) + "\n" + outcome).slice(0, 12000);
          if (failed) delete state.proposal;
          delete state.run;
          delete state.prompt;
        });
        this.runs.delete(id);
      }
    };
    const done = Promise.resolve().then(execute);
    this.runs.set(id, { stop, done });
    // A storage failure is not a Codex response. Stop the worker and surface the error to the launcher.
    void done.catch(error => { stop.abort(); console.error("wf-agent chat storage: " + displayText(message(error))); });
  }

  respond(id: string, body: Record<string, unknown>) {
    const key = field(body.id, "prompt");
    const reply = this.replies.get(key);
    if (!reply) throw new ChatError(409, "This Codex prompt is no longer active in this board process.");
    if (typeof body.approve !== "boolean") throw new ChatError(400, "Choose whether to allow the Codex request.");
    const approve = body.approve;
    const answers: Record<string, string> = {};
    this.store.edit(id, (state, emit) => {
      if (state.prompt?.id !== key) throw new ChatError(409, "This prompt is no longer active.");
      if (approve) for (const q of state.prompt.questions ?? []) {
        const value = object(body.answers)[q.id];
        if (!q.optional || value) answers[q.id] = field(value, "answer");
      }
      emit({ id: key, kind: "decision", title: approve ? "Codex request approved" : "Codex request declined", text: state.prompt.detail });
      delete state.prompt;
    });
    this.replies.delete(key);
    reply({ approve, answers });
  }

  stop(id: string) {
    const run = this.runs.get(id);
    if (!run) throw new ChatError(409, "No active run in this board process.");
    run.stop.abort();
  }
  async close() {
    this.closing = true;
    for (const { stop } of this.runs.values()) stop.abort();
    await Promise.allSettled([...this.runs.values()].map(run => run.done));
    this.store.close();
  }
}
