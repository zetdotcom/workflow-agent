import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { CopilotSession, PermissionRequest, SessionEvent, SessionOptionsBase, Tool } from "@microsoft/copilot-sdk";
import { ChatError, displayText, object } from "./chat-model.js";
import { boardInstructions, boardToolFailure, boardTools, canWriteStatus, type ProviderTurn } from "./provider-runtime.js";

const runtimeHelp = "Could not start GitHub Copilot. Reinstall wf-agent with its platform dependencies and try again.";
const authHelp = "GitHub Copilot needs an authenticated account with Copilot access. Run gh auth login in your terminal, then retry.";
const readTools = ["view", "grep", "glob"];
const editTools = ["create", "edit"];
const shellTools = ["bash", "powershell", "read_bash", "read_powershell", "list_bash", "list_powershell", "stop_bash", "stop_powershell"];

function discussionTools(turn: ProviderTurn, owns: (id: string) => boolean): Tool[] {
  return boardTools.map(({ name, description, inputSchema }) => ({
    name, description, parameters: inputSchema, skipPermission: true, defer: "never",
    async handler(args, invocation) {
      try {
        if (!owns(invocation.sessionId)) throw new ChatError(409, "This board turn is no longer active.");
        invocation.signal?.throwIfAborted();
        const result = await turn.callbacks.projectTool(name, object(args));
        return { resultType: "success", textResultForLlm: JSON.stringify(result), skipLargeOutputProcessing: true };
      } catch (error) {
        return { resultType: "failure", textResultForLlm: boardToolFailure(error) };
      }
    }
  }));
}

async function permissionInScope(turn: ProviderTurn, request: PermissionRequest) {
  const workflow = turn.workflow;
  if (!workflow) return false;
  if (workflow.action.command === "to-pr") return ["shell", "write", "read", "url"].includes(request.kind);
  if (request.kind === "write") {
    const paths = [request.fileName, request.resolvedPath, ...(request.fileEdits ?? []).flatMap(edit => [edit.before?.path, edit.after?.path])];
    if (!request.fileName) return false;
    for (const path of paths) if (path && !await canWriteStatus(turn.repository, workflow.action, resolve(turn.repository, path))) return false;
    return true;
  }
  if (request.kind !== "read" || !request.path) return false;
  const permitted = (file: string) => [turn.repository, workflow.skillDirectory].some(root => {
    const name = relative(root, file);
    return name !== ".." && !name.startsWith(".." + sep) && !isAbsolute(name) && !name.split(sep).some(part => part.toLowerCase() === ".git");
  });
  let path = resolve(turn.repository, request.path);
  if (!permitted(path) || (request.resolvedPath && !permitted(resolve(turn.repository, request.resolvedPath)))) return false;
  // An absent ticket file is a normal lookup miss. Check its nearest existing ancestor without following a dangling link.
  while (permitted(path)) {
    try { return permitted(await realpath(path)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (await lstat(path).then(() => true, (error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return false; throw error; })) return false;
    const parent = dirname(path);
    if (parent === path) break;
    path = parent;
  }
  return false;
}

function permissionDetail(request: PermissionRequest, repository: string) {
  switch (request.kind) {
    case "read": return request.path;
    case "write": return [request.fileName, request.diff].filter(Boolean).join("\n");
    case "shell": return [request.resolvedWorkingDirectory || repository, request.fullCommandText].join("\n");
    case "url": {
      const url = new URL(request.url);
      return url.origin + url.pathname + (url.search ? "?…" : "");
    }
    default: return "";
  }
}

function activity(turn: ProviderTurn) {
  const calls = new Map<string, { name: string; text: string }>();
  return (event: SessionEvent) => {
    if (turn.signal.aborted) return;
    const { entry } = turn.callbacks;
    if (event.type === "tool.execution_start") {
      const { toolName: name, toolCallId: id } = event.data;
      const args = object(event.data.arguments);
      const text = [args.path, args.query, args.change, args.ticket].filter(value => typeof value === "string").join(" ");
      calls.set(id, { name, text });
      entry({ id, kind: "tool", title: name + " · started", text });
    } else if (event.type === "tool.execution_complete") {
      const id = event.data.toolCallId;
      const call = calls.get(id);
      if (call) entry({ id, kind: "tool", title: call.name + (event.data.success ? " · completed" : " · failed"), text: call.text });
      calls.delete(id);
    } else if (event.type === "subagent.started" || event.type === "subagent.completed" || event.type === "subagent.failed") {
      const state = event.type === "subagent.completed" && event.data.cancelled ? "stopped" : event.type.split(".")[1];
      entry({ id: "agent/" + event.data.toolCallId, kind: "tool", title: "Agent · " + state, text: event.data.agentName });
    }
  };
}

async function providerCall<T>(operation: Promise<T>, hint: string): Promise<T> {
  try { return await operation; }
  catch (error) {
    // SDK errors can include the runtime's stderr. Classify them without persisting host diagnostics.
    const reason = error instanceof Error ? error.message : "";
    if (/\b(?:401|403|unauthenticated|unauthorized|forbidden|entitlement)\b|token expired/i.test(reason)) throw new Error(authHelp);
    if (/\b429\b|rate.?limit|quota/i.test(reason)) throw new Error("GitHub Copilot reached its usage limit. Check your account’s usage and retry later.");
    throw new Error(hint);
  }
}

export async function runCopilot(turn: ProviderTurn): Promise<string> {
  const { directory, repository, thread, input, workflow, callbacks, signal } = turn;
  signal.throwIfAborted();
  const { CopilotClient, RuntimeConnection, createAttributedResult } = await providerCall(import("@microsoft/copilot-sdk"), runtimeHelp);
  signal.throwIfAborted();
  const cwd = workflow ? repository : directory;
  const client = new CopilotClient({
    mode: "empty",
    runtime: RuntimeConnection.forSpawnedStdio({
      baseDirectory: directory, workingDirectory: cwd,
      env: { ...process.env, COPILOT_CLI_PATH: "", COPILOT_ALLOW_ALL: "" }
    }),
    observability: { logLevel: "none" }
  });
  let session: CopilotSession | undefined;
  let active = true;
  const owns = (id: string) => active && !signal.aborted && !!id && session?.sessionId === id;
  let denied = "";
  const delivery = workflow?.action.command === "to-pr";
  const canEdit = workflow?.action.directory.startsWith(".workflow/changes/") || workflow?.action.change === "all";
  const available = delivery ? [...readTools, ...editTools, ...shellTools, "task", "list_agents", "read_agent"] : canEdit ? [...readTools, ...editTools] : readTools;
  const options: SessionOptionsBase = {
    workingDirectory: cwd, enableConfigDiscovery: false,
    instructions: { skipCustomInstructions: !workflow },
    systemMessage: { content: workflow ? "The authorized checkout root is " + JSON.stringify(repository) + ". Resolve repository-relative paths from this directory. " + (delivery
      ? "Follow the supplied wf command. Dispatch each implementation or repair to a fresh wf-implementer and the independent review to a fresh wf-reviewer. Await each native task and record its actual result."
      : "Follow the supplied wf status command. Read the workflow records and reconcile only an eligible active STATUS.md.") : boardInstructions },
    tools: workflow ? { availableTools: available.map(name => "builtin:" + name) } : {
      definitions: discussionTools(turn, owns), availableTools: boardTools.map(tool => "custom:" + tool.name)
    },
    agents: { includedBuiltinAgents: [], localDiscoveryOnly: true, definitions: delivery ? [
      { name: "wf-implementer", description: "Implement or repair one approved wf phase.", prompt: "Work only on your assigned phase and its verification. Follow the approved plan and repository instructions.", tools: [...readTools, ...editTools, ...shellTools] },
      { name: "wf-reviewer", description: "Independently review an approved wf change.", prompt: "Review the aggregate change read-only. Report required and optional findings to the coordinator for recording.", tools: readTools }
    ] : [] },
    hooks: workflow && !delivery ? { handlers: { onPreToolUse: async ({ toolName, toolArgs }) => {
      if (!editTools.includes(toolName)) return;
      const { path } = object(toolArgs);
      if (typeof path !== "string" || !await canWriteStatus(repository, workflow.action, path)) {
        denied = "The requested edit is outside the approved wf status scope.";
        return { permissionDecision: "deny", permissionDecisionReason: "This status file is outside the approved change." };
      }
    } } } : undefined,
    permissions: { mode: "manual", onRequest: async (request, caller) => {
      if (signal.aborted) return { kind: "no-result" };
      if (!caller || !owns(caller.sessionId)) return { kind: "reject" };
      if (!await permissionInScope(turn, request).catch(() => false)) {
        denied = workflow ? "GitHub Copilot's " + request.kind + " request is outside the approved workflow scope. See the run activity for the attempted operation."
          : "GitHub Copilot requested a tool outside the four board discussion tools.";
        return { kind: "reject" };
      }
      const elevated = "requestSandboxBypass" in request && request.requestSandboxBypass;
      const detail = (elevated ? "This operation requests access outside the Copilot sandbox.\n" : "") + permissionDetail(request, repository);
      let approve: boolean;
      try {
        const statusWrite = workflow?.action.command === "status" && request.kind === "write";
        ({ approve } = await callbacks.prompt({ id: crypto.randomUUID(), title: "GitHub Copilot requests " + request.kind + " access", detail: displayText(detail) }, statusWrite ? "status-write" : undefined));
      } catch {
        // Stop cancels the native request. The closing transport must not receive a late permission response.
        if (signal.aborted) return { kind: "no-result" };
        denied = "GitHub Copilot could not complete the board permission request. Retry the workflow.";
        callbacks.entry({ id: crypto.randomUUID(), kind: "error", title: "Permission request failed", text: denied });
        return { kind: "reject" };
      }
      if (signal.aborted) return { kind: "no-result" };
      if (!approve) denied = "GitHub Copilot stopped after its " + request.kind + " permission was declined.";
      if (!owns(caller.sessionId) || !await permissionInScope(turn, request).catch(() => false)) return { kind: "reject" };
      return createAttributedResult({ kind: approve ? "approve-once" : "reject" },
        { source: "human_response", responseCapability: "interactive", surface: "sdk", outcome: "prompted_user" });
    } }
  };
  const close = async (abort: boolean) => {
    // Closing the connection can supersede an in-flight abort acknowledgement.
    const [, stopped] = await Promise.allSettled([abort ? session?.abort() : undefined, client.stop()]);
    if (stopped.status === "fulfilled" && !stopped.value.length) return true;
    return client.forceStop().then(() => true, () => false);
  };
  let interrupted: Promise<boolean> | undefined;
  const interrupt = () => { interrupted = close(true); };
  signal.addEventListener("abort", interrupt, { once: true });
  try {
    await providerCall(client.start(), runtimeHelp);
    signal.throwIfAborted();
    const auth = await providerCall(client.getAuthStatus(), authHelp);
    signal.throwIfAborted();
    if (!auth.isAuthenticated) throw new Error(authHelp);
    if (workflow && thread) throw new Error("An approved Copilot workflow requires a fresh execution session.");
    session = thread
      ? await providerCall(client.resumeSession(thread, options), "GitHub Copilot could not reopen this conversation. Start a new chat to continue.")
      : await providerCall(client.createSession({ ...options, name: workflow ? "Board workflow" : "Board chat" }), "GitHub Copilot could not start a conversation. Check your Copilot access and connection, then retry.");
    signal.throwIfAborted();
    if (!session.sessionId || (thread && session.sessionId !== thread)) throw new Error("GitHub Copilot returned an unexpected session. Start a new chat to continue.");
    if (session.permissionModeResult?.mode !== "manual") throw new Error("GitHub Copilot could not enable manual permissions for this board turn. Check your Copilot policy and retry.");
    if (workflow) session.on(activity(turn));
    if (delivery) {
      await providerCall(session.rpc.tools.initializeAndValidate(), "to-pr prerequisite unavailable: fresh-agent-dispatch");
      const [{ tools }, { agents }] = await providerCall(Promise.all([session.rpc.tools.getCurrentMetadata(), session.rpc.agent.list()]), "to-pr prerequisite unavailable: fresh-agent-dispatch");
      const roles = new Set(agents.filter(agent => !agent.disableModelInvocation).map(agent => agent.name));
      if (!tools?.some(tool => tool.name === "task") || !roles.has("wf-implementer") || !roles.has("wf-reviewer")) throw new Error("to-pr prerequisite unavailable: fresh-agent-dispatch");
      if (!tools.some(tool => tool.name === "bash" || tool.name === "powershell")) throw new Error("to-pr prerequisite unavailable: pull-request-create");
    }
    await callbacks.beforeTurn();
    callbacks.thread(session.sessionId);
    signal.throwIfAborted();
    // An approved workflow can wait for a person, run verification and dispatch several workers.
    const reply = await providerCall(session.sendAndWait({ prompt: input }, workflow ? Number.MAX_SAFE_INTEGER : 5 * 60_000), "GitHub Copilot could not complete the reply. Check your connection and Copilot access, then retry.");
    signal.throwIfAborted();
    const text = reply?.data?.content;
    if (typeof text !== "string" || !text.trim() || reply?.data.toolRequests?.length) throw new Error(denied || "GitHub Copilot did not return a complete text reply. Retry your message.");
    return text;
  } catch (error) {
    if (signal.aborted) throw new Error("GitHub Copilot chat stopped.");
    throw error;
  } finally {
    active = false;
    signal.removeEventListener("abort", interrupt);
    if (!await (interrupted ?? close(false))) throw new Error("GitHub Copilot could not stop its local runtime. Check the board process before retrying.");
  }
}
