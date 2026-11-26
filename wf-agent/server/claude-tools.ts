import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { displayText, object, type HostPrompt } from "./chat-model.js";
import { boardToolFailure, boardTools, canWriteStatus, type ProviderTurn } from "./provider-runtime.js";

type Fields = Record<string, unknown>;
const readTools = ["Read", "Glob", "Grep"];
const statusTools = [...readTools, "Edit", "Write"];
const deliveryTools = [...statusTools, "Bash", "Agent", "AskUserQuestion"];
const boardManifest = boardTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
const boardNames = boardManifest.map(({ name }) => name);
const prefix = "mcp__wfboard__";

export function claudeTools(turn: ProviderTurn) {
  if (!turn.workflow) return boardNames.map(name => prefix + name);
  const action = turn.workflow.action;
  if (action.command === "to-pr") return deliveryTools;
  return action.change === "all" || action.directory.startsWith(".workflow/changes/") ? statusTools : readTools;
}

export function verifyClaudeTools(inventory: unknown, expected: string[]) {
  // Claude's startup inventory uses Task for its Agent tool.
  const names = new Set(Array.isArray(inventory) ? inventory.map(name => name === "Task" ? "Agent" : name) : []);
  if (expected.includes("Agent")) {
    if (!names.has("Agent")) throw new Error("to-pr prerequisite unavailable: fresh-agent-dispatch");
    if (!names.has("Bash")) throw new Error("to-pr prerequisite unavailable: pull-request-create");
  }
  if (names.size !== expected.length || expected.some(name => !names.has(name))) {
    throw new Error("Claude Code did not provide the tools required for this board run. Check your Claude Code version and policies.");
  }
}

// A per-process SDK MCP server runs on Claude's existing control pipe. It has no network endpoint or client credentials.
export async function boardMcp(turn: ProviderTurn, request: Fields, active: boolean) {
  const rpc = object(request.message);
  const params = object(rpc.params);
  const response = (result: Fields) => ({ mcp_response: { jsonrpc: "2.0", id: rpc.id, result } });
  const error = (code: number, message: string) => ({ mcp_response: { jsonrpc: "2.0", id: rpc.id, error: { code, message } } });
  switch (rpc.method) {
    case "initialize":
      return response({ protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "wfboard", version: "1.0.0" } });
    case "notifications/initialized":
    case "ping":
      return response({});
    case "tools/list":
      return response({ tools: boardManifest });
    case "tools/call": {
      if (!active || typeof params.name !== "string" || !boardNames.includes(params.name)) return error(-32602, "Unavailable board tool.");
      let value: unknown;
      try {
        turn.signal.throwIfAborted();
        value = await turn.callbacks.projectTool(params.name, object(params.arguments));
      } catch (cause) {
        return response({ isError: true, content: [{ type: "text", text: boardToolFailure(cause) }] });
      }
      return response({ content: [{ type: "text", text: JSON.stringify(value) }] });
    }
    default:
      return error(-32601, "Unsupported board tool method.");
  }
}

async function statusPathAllowed(turn: ProviderTurn, name: string, input: Fields) {
  const workflow = turn.workflow!;
  if (workflow.action.command !== "status") return true;
  if (name === "Edit" || name === "Write") return canWriteStatus(turn.repository, workflow.action, string(input.file_path));
  const argument = name === "Read" ? string(input.file_path) : string(input.path ?? turn.repository);
  if (!argument) return false;
  // Claude asks about reads outside its normal work directories. Status can only inspect its checkout and the installed skill.
  const path = await realpath(resolve(turn.repository, argument)).catch(() => undefined);
  return !!path && [turn.repository, workflow.skillDirectory].some(root => {
    const name = relative(root, path);
    return name !== ".." && !name.startsWith(".." + sep) && !isAbsolute(name) && !name.split(sep).some(part => part.toLowerCase() === ".git");
  });
}

const deny = (message: string) => ({ behavior: "deny", message });
const string = (value: unknown) => typeof value === "string" ? value : "";

async function answerQuestions(turn: ProviderTurn, input: Fields) {
  if (!Array.isArray(input.questions) || !input.questions.length) return deny("Claude Code supplied no questions.");
  const questions: NonNullable<HostPrompt["questions"]> = [];
  const originals: string[] = [];
  for (const [index, value] of input.questions.entries()) {
    const question = object(value);
    const label = string(question.question);
    if (!label || question.isSecret) return deny("Configure credentials in your terminal. The board accepts only public questions.");
    originals.push(label);
    const options = Array.isArray(question.options) ? question.options.map(value => displayText(string(object(value).label))) : [];
    questions.push({ id: String(index), question: displayText(label), options });
  }
  const reply = await turn.callbacks.prompt({ id: randomUUID(), title: "Claude Code has a question", detail: "", questions });
  turn.signal.throwIfAborted();
  if (!reply.approve) return deny("The user declined this question.");
  const answers = Object.fromEntries(originals.map((question, index) => [question, reply.answers[String(index)]]));
  return { behavior: "allow", updatedInput: { ...input, answers } };
}

export async function claudePermission(turn: ProviderTurn, request: Fields, active: boolean) {
  const name = string(request.tool_name);
  const input = object(request.input);
  if (!active || !turn.workflow || !claudeTools(turn).includes(name)) return deny("This operation is outside the authorized workflow.");
  turn.signal.throwIfAborted();
  if (name === "AskUserQuestion") return answerQuestions(turn, input);
  if (!await statusPathAllowed(turn, name, input)) return deny("This path is outside the authorized status scope.");
  const detail = displayText(JSON.stringify(input, null, 2));
  if (detail.length > 64_000) return deny("This operation is too large to review. Submit a smaller operation for approval.");
  const statusWrite = turn.workflow.action.command === "status" && (name === "Edit" || name === "Write");
  const reply = await turn.callbacks.prompt({ id: randomUUID(), title: "Allow Claude Code to use " + name + "?", detail }, statusWrite ? "status-write" : undefined);
  turn.signal.throwIfAborted();
  if (!reply.approve) return deny("The user declined this operation.");
  if (!await statusPathAllowed(turn, name, input)) return deny("The status target changed while approval was pending.");
  return { behavior: "allow", updatedInput: input };
}

export function claudeActivity(turn: ProviderTurn) {
  const tools = new Map<string, { title: string; text: string }>();
  return (event: Fields) => {
    const content = object(event.message).content;
    if (!Array.isArray(content)) return;
    for (const value of content) {
      const block = object(value);
      if (event.type === "assistant" && block.type === "tool_use" && typeof block.id === "string") {
        const input = object(block.input);
        const name = string(block.name).replace(/^mcp__wfboard__/, "");
        const title = (event.parent_tool_use_id ? "Agent · " : "") + name;
        const text = displayText(string(input.file_path ?? input.path ?? input.description)).slice(0, 12_000);
        tools.set(block.id, { title, text });
        turn.callbacks.entry({ id: block.id, kind: "tool", title: title + " · running", text });
      } else if (event.type === "user" && block.type === "tool_result" && typeof block.tool_use_id === "string") {
        const tool = tools.get(block.tool_use_id);
        if (!tool) continue;
        tools.delete(block.tool_use_id);
        turn.callbacks.entry({ id: block.tool_use_id, kind: "tool", title: tool.title + (block.is_error ? " · failed" : " · completed"), text: tool.text });
      }
    }
  };
}
