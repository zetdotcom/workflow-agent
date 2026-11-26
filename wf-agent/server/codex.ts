import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { message, object, type ChatEntry, type WorkflowAction } from "./chat-model.js";
import { boardInstructions, boardTools, type ProviderCallbacks } from "./provider-runtime.js";

type Fields = Record<string, unknown>;
const string = (value: unknown) => typeof value === "string" ? value : "";
const printable = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";

function executable() {
  if (process.platform === "win32") {
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
      if (!dir) continue;
      const native = join(dir, "codex.exe");
      if (existsSync(native)) return [native];
      const npmEntry = join(dir, "node_modules", "@openai", "codex", "bin", "codex.js");
      if (existsSync(npmEntry)) return [process.execPath, npmEntry];
    }
  }
  return ["codex"];
}

class Connection {
  private next = 0;
  private requests = new Map<number, { resolve: (result: Fields) => void; reject: (error: Error) => void }>();
  private child;
  private exited: Promise<void>;
  private closing?: Promise<void>;
  private failure?: Error;
  constructor(cwd: string, private receive: (method: string, params: Fields, request: boolean) => Promise<unknown>, private failed: (error: Error) => void) {
    const [bin, ...prefix] = executable();
    this.child = spawn(bin, [...prefix, "app-server", "--listen", "stdio://"], { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // stderr may include private host diagnostics. User-visible errors come from the protocol.
    this.child.stderr.resume();
    this.child.stdin.on("error", error => this.fail(error));
    this.child.once("error", error => this.fail(new Error("Could not start local Codex. Install the Codex CLI and sign in. " + error.message)));
    this.exited = new Promise(resolve => this.child.once("close", (code, signal) => {
      this.fail(new Error("Codex app-server stopped (" + (signal ?? code) + ")."));
      resolve();
    }));
    createInterface({ input: this.child.stdout, crlfDelay: Infinity }).on("line", line => {
      void this.line(line).catch(error => this.fail(error));
    });
  }
  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    for (const request of this.requests.values()) request.reject(error);
    this.requests.clear();
    this.failed(error);
  }
  private async line(line: string) {
    const packet = object(JSON.parse(line));
    if (typeof packet.method === "string") {
      const isRequest = packet.id !== undefined;
      try {
        const result = await this.receive(packet.method, object(packet.params), isRequest);
        if (isRequest) this.send({ id: packet.id, result });
      } catch (error) {
        if (!isRequest) throw error;
        this.send({ id: packet.id, error: { code: -32603, message: message(error) } });
      }
    } else if (typeof packet.id === "number") {
      const pending = this.requests.get(packet.id);
      if (!pending) return;
      this.requests.delete(packet.id);
      if (packet.error) pending.reject(new Error(string(object(packet.error).message) || "Codex rejected the request."));
      else pending.resolve(object(packet.result));
    }
  }
  send(packet: Fields) {
    if (this.failure) throw this.failure;
    this.child.stdin.write(JSON.stringify(packet) + "\n");
  }
  async call(method: string, params: Fields) {
    const id = ++this.next;
    let timer: NodeJS.Timeout | undefined;
    try {
      return await new Promise<Fields>((resolve, reject) => {
        this.requests.set(id, { resolve, reject });
        timer = setTimeout(() => reject(new Error("Codex timed out on " + method + ".")), 60_000);
        this.send({ id, method, params });
      });
    } finally { clearTimeout(timer); this.requests.delete(id); }
  }
  close() { return this.closing ??= this.finish(); }
  private async finish() {
    this.child.stdin.end();
    const timer = setTimeout(() => this.child.kill("SIGKILL"), 3_000);
    try { await this.exited; } finally { clearTimeout(timer); }
  }
}

async function workflowSkill(rpc: Connection, repository: string) {
  const result = await rpc.call("skills/list", { cwds: [repository] });
  for (const group of Array.isArray(result.data) ? result.data : []) {
    const skills = object(group).skills;
    if (!Array.isArray(skills)) continue;
    const skill = skills.map(object).find(item => item.name === "wf" && item.enabled === true && string(item.path));
    if (skill) return string(skill.path);
  }
  throw new Error("Install and enable the wf skill in local Codex to run this workflow.");
}

function publicItem(item: Fields, complete: boolean): Omit<ChatEntry, "id"> | undefined {
  const status = string(item.status) || (complete ? "completed" : "started");
  switch (item.type) {
    case "agentMessage":
      if (complete && string(item.text)) return { kind: "assistant", title: "Codex", text: string(item.text) };
      break;
    case "reasoning":
      if (complete && Array.isArray(item.summary) && item.summary.length) return { kind: "decision", title: "Decision summary", text: item.summary.map(string).join("\n") };
      break;
    case "plan": return { kind: "decision", title: "Plan", text: string(item.text) };
    case "commandExecution": return { kind: "tool", title: "Command · " + status, text: [item.command, item.aggregatedOutput, typeof item.exitCode === "number" ? "Exit " + item.exitCode : ""].filter(Boolean).join("\n") };
    case "fileChange": return { kind: "diff", title: "File edits · " + status, text: (Array.isArray(item.changes) ? item.changes : []).map(change => [object(change).path, object(change).diff].join("\n")).join("\n") };
    case "mcpToolCall": return { kind: "tool", title: [item.server, item.tool, status].join(" · "), text: [printable(item.arguments), printable(item.error ?? item.result)].filter(Boolean).join("\n") };
    case "dynamicToolCall": return { kind: "tool", title: string(item.tool) + " · " + status, text: [printable(item.arguments), ...(Array.isArray(item.contentItems) ? item.contentItems.map(part => string(object(part).text)) : [])].filter(Boolean).join("\n") };
    case "collabAgentToolCall": return { kind: "tool", title: "Agent " + string(item.tool) + " · " + status, text: printable(item.agentsStates ?? item.receiverThreadIds) };
    case "webSearch": case "imageView": return { kind: "tool", title: string(item.type) + " · " + status, text: string(item.path ?? item.query) };
  }
}

async function hostRequest(method: string, p: Fields, ask: ProviderCallbacks["prompt"]) {
  const id = crypto.randomUUID();
  if (method === "item/tool/requestUserInput" && Array.isArray(p.questions)) {
    if (p.questions.some(value => object(value).isSecret)) throw new Error("A secret must be configured directly in Codex.");
    const questions = p.questions.map(value => {
      const q = object(value);
      return { id: string(q.id), question: string(q.question), options: Array.isArray(q.options) ? q.options.map(o => string(object(o).label)) : [] };
    });
    const { answers } = await ask({ id, title: "Codex has a question", detail: "", questions });
    return { answers: Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, { answers: [value] }])) };
  }
  if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval" || method === "item/permissions/requestApproval") {
    const detail = [p.command, p.cwd, p.reason, p.grantRoot, printable(p.permissions ?? p.additionalPermissions), printable(p.networkApprovalContext)].filter(Boolean).join("\n");
    const { approve } = await ask({ id, title: "Codex permission request", detail });
    if (method === "item/permissions/requestApproval") return { permissions: approve ? p.permissions : {}, scope: "turn" };
    return { decision: approve ? "accept" : "decline" };
  }
  if (method === "mcpServer/elicitation/request" && p.mode === "form") {
    const schema = object(p.requestedSchema);
    const fields = Object.entries(object(schema.properties));
    if (fields.some(([name, value]) => /password|secret|credential|token/i.test(name) || object(value).format === "password")) {
      throw new Error("Configure private credentials directly in the MCP server.");
    }
    const questions = fields.map(([name, value]) => {
      const spec = object(value);
      return { id: name, question: string(spec.title) || name, optional: !Array.isArray(schema.required) || !schema.required.includes(name),
        options: Array.isArray(spec.enum) ? spec.enum.map(String) : spec.type === "boolean" ? ["true", "false"] : [] };
    });
    const answer = await ask({ id, title: "Request from " + string(p.serverName), detail: string(p.message), questions: questions.length ? questions : undefined });
    if (!answer.approve) return { action: "decline", content: null, _meta: null };
    const content = Object.fromEntries(fields.filter(([name]) => Object.hasOwn(answer.answers, name)).map(([name, value]) => {
      const type = object(value).type;
      const text = answer.answers[name];
      if (type === "string") return [name, text];
      const parsed: unknown = JSON.parse(text);
      if (type === "array" ? !Array.isArray(parsed) : typeof parsed !== (type === "integer" ? "number" : type)) throw new Error("Invalid value for " + name + ".");
      return [name, parsed];
    }));
    return { action: "accept", content, _meta: null };
  }
  if (method === "mcpServer/elicitation/request") throw new Error("This MCP server requires verification in its host: " + string(p.serverName));
  throw new Error("Unsupported Codex request: " + method);
}

export async function runCodex(repository: string, thread: string | undefined, input: string, action: WorkflowAction | undefined, callbacks: ProviderCallbacks, signal: AbortSignal) {
  let root = "";
  let turnId = "";
  const earlyCompletions = new Map<string, Fields>();
  let fullReply = "";
  const children = new Set<string>();
  let promptQueue = Promise.resolve();
  const ended = Promise.withResolvers<void>();
  function capture(owner: string, turn: string, item: Fields, completed: boolean) {
    if (item.type === "collabAgentToolCall" && item.tool === "spawnAgent" && Array.isArray(item.receiverThreadIds)) {
      item.receiverThreadIds.forEach(id => { if (typeof id === "string" && id !== root) children.add(id); });
    }
    const visible = publicItem(item, completed);
    if (!visible) return;
    const title = owner === root ? visible.title : "Agent · " + visible.title;
    callbacks.entry({ ...visible, id: [owner, turn, item.id].join("/"), title });
    if (owner === root && visible.kind === "assistant") fullReply = visible.text;
  }
  function complete(turn: Fields) {
    if (turn.status === "completed") ended.resolve();
    else ended.reject(new Error(string(object(turn.error).message) || "Codex turn " + turn.status + "."));
  }
  // An early transport failure can arrive while initialize/thread/start is still awaited.
  void ended.promise.catch(() => {});
  const rpc = new Connection(repository, async (method, p, request) => {
    if (method === "thread/started") {
      const t = object(p.thread);
      if (root && (t.parentThreadId === root || children.has(string(t.parentThreadId)))) children.add(string(t.id));
      return;
    }
    if (!root || (p.threadId !== root && !children.has(string(p.threadId)))) {
      if (request) throw new Error("Request is outside this board run.");
      return;
    }
    if (p.threadId === root && turnId && p.turnId && p.turnId !== turnId) return;
    if (request) {
      if (method === "item/tool/call" && !action) {
        try {
          if (p.tool === "wf_status" || p.tool === "wf_to_pr") await workflowSkill(rpc, repository);
          const result = await callbacks.projectTool(string(p.tool), object(p.arguments));
          return { success: true, contentItems: [{ type: "inputText", text: printable(result) }] };
        } catch (error) { return { success: false, contentItems: [{ type: "inputText", text: message(error) }] }; }
      }
      if (!action && method !== "item/tool/requestUserInput") throw new Error("Board discussions have read-only project tools.");
      const response = promptQueue.then(() => { signal.throwIfAborted(); return hostRequest(method, p, callbacks.prompt); }).catch(error => {
        if (!signal.aborted) callbacks.entry({ id: crypto.randomUUID(), kind: "error", title: "Codex request failed", text: message(error) });
        throw error;
      });
      promptQueue = response.then(() => {}, () => {});
      return response;
    }
    const key = [p.threadId, p.turnId].join("/");
    if (method === "item/started" || method === "item/completed") {
      capture(string(p.threadId), string(p.turnId), object(p.item), method === "item/completed");
    } else if (method === "turn/diff/updated") {
      callbacks.entry({ id: key + "/diff", kind: "diff", title: "Turn diff", text: string(p.diff) });
    } else if (method === "turn/plan/updated") {
      callbacks.entry({ id: key + "/plan", kind: "decision", title: "Run plan", text: [string(p.explanation), printable(p.plan)].filter(Boolean).join("\n") });
    } else if (method === "turn/completed" && p.threadId === root) {
      const turn = object(p.turn);
      if (!turnId) earlyCompletions.set(string(turn.id), turn);
      else if (turn.id === turnId) complete(turn);
    }
  }, error => ended.reject(error));
  const abort = () => {
    if (root && turnId) void rpc.call("turn/interrupt", { threadId: root, turnId }).catch(error => ended.reject(error));
    ended.reject(new Error("Run interrupted."));
    void rpc.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    await rpc.call("initialize", { clientInfo: { name: "wf_agent", title: "Workflow Agent", version: "0.1.0" }, capabilities: { experimentalApi: true } });
    rpc.send({ method: "initialized", params: {} });
    const params: Fields = { cwd: repository };
    const inputs: Fields[] = [{ type: "text", text: input, text_elements: [] }];
    if (action) {
      inputs.push({ type: "skill", name: "wf", path: await workflowSkill(rpc, repository) });
      params.developerInstructions = "Execute only the authorized workflow command for the identified ticket or change. Follow the installed wf skill and repository instructions. Report actual evidence, blockers and the PR URL on delivery.";
    } else {
      const config = object((await rpc.call("config/read", { cwd: repository })).config);
      const overrides: Fields = { "features.apps": false, "features.plugins": false, "features.hooks": false, "features.shell_tool": false, "features.unified_exec": false, web_search: "disabled" };
      for (const name of Object.keys(object(config.mcp_servers))) overrides["mcp_servers." + name + ".enabled"] = false;
      Object.assign(params, { developerInstructions: boardInstructions, sandbox: "read-only", approvalPolicy: "never", config: overrides });
      if (!thread) params.dynamicTools = boardTools;
    }
    const response = thread ? await rpc.call("thread/resume", { ...params, threadId: thread, excludeTurns: true }) : await rpc.call("thread/start", params);
    root = string(object(response.thread).id);
    if (!root) throw new Error("Codex did not return a thread ID.");
    callbacks.thread(root);
    await callbacks.beforeTurn();
    signal.throwIfAborted();
    const started = await rpc.call("turn/start", { threadId: root, input: inputs });
    turnId = string(object(started.turn).id);
    if (!turnId) throw new Error("Codex did not return a turn ID.");
    const completed = earlyCompletions.get(turnId);
    if (completed) complete(completed);
    await ended.promise;
    // Spawned workflow agents have independent item streams and durable histories.
    for (const childId of children) {
      let cursor: string | null = null;
      try {
        do {
          signal.throwIfAborted();
          const page = await rpc.call("thread/items/list", { threadId: childId, cursor, limit: 100 });
          if (!Array.isArray(page.data)) throw new Error("Codex returned no agent item history.");
          for (const row of page.data.map(object)) capture(childId, string(row.turnId), object(row.item), true);
          cursor = string(page.nextCursor) || null;
        } while (cursor);
      } catch (error) {
        signal.throwIfAborted();
        callbacks.entry({ id: childId + "/history", kind: "error", title: "Agent history unavailable", text: message(error) });
      }
    }
    return fullReply;
  } finally {
    signal.removeEventListener("abort", abort);
    await rpc.close();
  }
}
