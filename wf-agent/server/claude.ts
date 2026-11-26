import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { object } from "./chat-model.js";
import { boardMcp, claudeActivity, claudePermission, claudeTools, verifyClaudeTools } from "./claude-tools.js";
import { boardInstructions, type ProviderTurn } from "./provider-runtime.js";

type Fields = Record<string, unknown>;

function executable() {
  if (process.platform !== "win32") return "claude";
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const native = join(directory, "claude.exe");
    if (existsSync(native)) return native;
    const npmBinary = join(directory, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(npmBinary)) return npmBinary;
  }
  return "claude.exe";
}

function argumentsFor(turn: ProviderTurn, id: string) {
  const workflow = turn.workflow;
  const tools = claudeTools(turn);
  const permissions = workflow ? {
    ask: ["Edit", "Write", "Bash", "Agent"],
    ...(workflow.action.command === "status" && { deny: ["Read(./.git)", "Read(./.git/**)", "Read(./**/.git/**)"] })
  } : { deny: ["Read(//**)"] };
  return [
    "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
    "--safe-mode", "--restricted", "--disable-slash-commands", "--strict-mcp-config",
    "--settings", JSON.stringify({ disableAllHooks: true, permissions }),
    "--mcp-config", JSON.stringify({ mcpServers: workflow ? {} : { wfboard: { type: "sdk", name: "wfboard" } } }),
    "--tools", workflow ? tools.join(",") : "", "--permission-mode", workflow ? "default" : "dontAsk",
    ...(workflow ? ["--permission-prompt-tool", "stdio", "--add-dir", workflow.skillDirectory] : ["--allowedTools", ...tools]),
    "--system-prompt", workflow
      ? "Carry out the authorized workflow using the supplied wf skill and repository instructions. Honor each board permission decision. For to-pr, dispatch a fresh general-purpose agent for each implementation or repair and a fresh Explore agent for independent read-only review. Await their results."
      : boardInstructions,
    turn.thread && !workflow ? "--resume" : "--session-id", id
  ];
}

function nativeFailure(result: Fields, stderr: string, resume: boolean) {
  // Native diagnostics can contain account and host details. Only public failure classes leave this adapter.
  const detail = [stderr, result.result, ...(Array.isArray(result.errors) ? result.errors : [])].join("\n");
  if (/unknown option|unrecognized option/i.test(detail)) return new Error("Update Claude Code to a version that supports restricted board chats.");
  if (result.api_error_status === 401 || /not logged in|authentication[_ ]error|invalid api key|please (?:run \/login|log in|sign in)/i.test(detail)) {
    return new Error("Claude Code needs authentication. Run `claude auth login` in your terminal, then retry.");
  }
  if (result.api_error_status === 403) return new Error("Claude Code denied access. Check `claude auth status` and your model access.");
  if (result.api_error_status === 429) return new Error("Claude Code reached its usage limit. Check your plan and retry later.");
  if (resume && /no conversation found|(?:conversation|session).*(?:not found|does not exist)/i.test(detail)) {
    return new Error("Claude Code could not find this saved session. Start a new chat.");
  }
  return new Error("Claude Code could not complete the request. Check your Claude Code connection and retry.");
}

function stopProcessTree(child: ChildProcessWithoutNullStreams, force: boolean) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const utility = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const cleanup = spawn(utility, ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
    cleanup.once("error", () => child.kill("SIGKILL"));
    return;
  }
  try { process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
}

export async function runClaude(turn: ProviderTurn): Promise<string> {
  const { callbacks, signal } = turn;
  signal.throwIfAborted();
  const resume = !turn.workflow && turn.thread !== undefined;
  const id = resume ? turn.thread! : randomUUID();
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) {
    throw new Error("The saved Claude Code session ID is invalid. Start a new chat.");
  }
  const native = spawn(executable(), argumentsFor(turn, id), {
    cwd: turn.workflow ? turn.repository : turn.directory,
    env: { ...process.env, ENABLE_TOOL_SEARCH: "false", CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
    detached: process.platform !== "win32", windowsHide: true, stdio: ["pipe", "pipe", "pipe"]
  });
  return new Promise<string>((resolve, reject) => {
    const initId = randomUUID();
    const recordActivity = claudeActivity(turn);
    let stopped = false;
    let closed = false;
    let starting = false;
    let sent = false;
    let initialized = false;
    let failed: Error | undefined;
    let spawnError: NodeJS.ErrnoException | undefined;
    let result: Fields | undefined;
    let stderr = "";
    let pending = "";
    let shutdownTimer: NodeJS.Timeout | undefined;
    const startupTimer = setTimeout(() => stop(new Error("Claude Code did not initialize. Check your Claude Code version and retry.")), 60_000);
    const interrupt = () => stop(new Error("Run interrupted."));
    signal.addEventListener("abort", interrupt, { once: true });

    function stop(error: Error) {
      if (closed || stopped) return;
      stopped = true;
      failed = error;
      clearTimeout(shutdownTimer);
      stopProcessTree(native, false);
      shutdownTimer = setTimeout(() => stopProcessTree(native, true), 3_000);
      shutdownTimer.unref();
    }
    function send(frame: Fields) {
      if (!closed && !stopped && !native.stdin.destroyed && !native.stdin.writableEnded) {
        native.stdin.write(JSON.stringify(frame) + "\n");
      }
    }
    async function frame(event: Fields) {
      if (stopped || closed || result) return;
      if (event.type === "control_response") {
        const ack = object(event.response);
        if (ack.request_id !== initId || starting) return;
        starting = true;
        clearTimeout(startupTimer);
        if (ack.subtype !== "success") throw new Error("Claude Code could not initialize the board protocol. Update Claude Code and retry.");
        await callbacks.beforeTurn();
        signal.throwIfAborted();
        if (stopped || closed) return;
        sent = true;
        // Native input is already composed. An @path or slash command in the user's text must stay literal.
        send({ type: "user", uuid: randomUUID(), message: { role: "user", content: turn.input }, client_composed: true, parent_tool_use_id: null });
      } else if (event.type === "control_request") {
        const request = object(event.request);
        const active = sent && initialized;
        let response: unknown;
        if (request.subtype === "mcp_message") {
          if (request.server_name !== "wfboard" || turn.workflow) {
            send({ type: "control_response", response: { subtype: "error", request_id: event.request_id, error: "Unknown board tool server." } });
            return;
          }
          response = await boardMcp(turn, request, active);
        } else if (request.subtype === "can_use_tool") {
          response = await claudePermission(turn, request, active);
        } else {
          send({ type: "control_response", response: { subtype: "error", request_id: event.request_id, error: "Unsupported Claude Code request." } });
          return;
        }
        send({ type: "control_response", response: { subtype: "success", request_id: event.request_id, response } });
      } else if (event.type === "system" && event.subtype === "init" && !initialized) {
        if (event.session_id !== id) throw new Error("Claude Code returned a different session. Start a new chat.");
        verifyClaudeTools(event.tools, claudeTools(turn));
        initialized = true;
        if (turn.workflow) callbacks.thread(id);
      } else if (event.type === "result" && !event.parent_tool_use_id) {
        result = event;
        native.stdin.end();
        shutdownTimer = setTimeout(() => stop(new Error("Claude Code did not finish shutting down.")), 5_000);
        shutdownTimer.unref();
      } else if (initialized && turn.workflow) {
        recordActivity(event);
      }
    }

    native.on("error", (error: NodeJS.ErrnoException) => { spawnError = error; });
    // Missing executables and early native failures close stdin before consuming the initialize request.
    native.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE" && error.code !== "ERR_STREAM_DESTROYED") stop(new Error("Claude Code could not receive the board request."));
    });
    native.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-8192); });
    native.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      pending += chunk;
      let index;
      while ((index = pending.indexOf("\n")) >= 0 && !stopped) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        if (!line.trim()) continue;
        if (line.length > 4 * 1024 * 1024) { stop(new Error("Claude Code output exceeded the board limit.")); return; }
        try {
          void frame(object(JSON.parse(line))).catch(error => stop(error));
        } catch { stop(new Error("Claude Code returned an unreadable response. Check your Claude Code version.")); }
      }
      if (pending.length > 4 * 1024 * 1024) stop(new Error("Claude Code output exceeded the board limit."));
    });
    native.once("close", code => {
      closed = true;
      clearTimeout(startupTimer);
      clearTimeout(shutdownTimer);
      signal.removeEventListener("abort", interrupt);
      try {
        // The CLI can exit on TERM before a command it launched. Reap any surviving members of its process group.
        if (stopped && process.platform !== "win32") stopProcessTree(native, true);
        if (signal.aborted) throw new Error("Run interrupted.");
        if (failed) throw failed;
        if (spawnError?.code === "ENOENT") throw new Error("Install Claude Code on PATH and run `claude auth login` in your terminal.");
        if (spawnError || code !== 0 || result?.is_error) throw nativeFailure(result ?? {}, stderr, resume);
        if (!initialized || result?.subtype !== "success" || result.is_error !== false || typeof result.result !== "string" || !result.result.trim()) {
          throw new Error("Claude Code returned no usable answer.");
        }
        if (result.session_id !== id) throw new Error("Claude Code returned a different session. Start a new chat.");
        if (!turn.workflow) callbacks.thread(id);
        resolve(result.result);
      } catch (error) { reject(error); }
    });
    send({ type: "control_request", request_id: initId, request: { subtype: "initialize" } });
  });
}
