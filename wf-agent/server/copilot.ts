import type { CopilotSession, SessionOptionsBase } from "@microsoft/copilot-sdk";

const runtimeHelp = "Could not start GitHub Copilot. Reinstall wf-agent with its platform dependencies and try again.";
const authHelp = "GitHub Copilot needs an authenticated account with Copilot access. Run gh auth login in your terminal, then retry.";

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

export async function runCopilot(directory: string, thread: string | undefined, input: string, onThread: (id: string) => void, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const { CopilotClient, RuntimeConnection } = await providerCall(import("@microsoft/copilot-sdk"), runtimeHelp);
  signal.throwIfAborted();
  const client = new CopilotClient({
    mode: "empty",
    runtime: RuntimeConnection.forSpawnedStdio({
      baseDirectory: directory, workingDirectory: directory,
      env: { ...process.env, COPILOT_CLI_PATH: "" }
    }),
    observability: { logLevel: "none" }
  });
  const options: SessionOptionsBase = {
    workingDirectory: directory,
    enableConfigDiscovery: false,
    tools: { availableTools: [] },
    permissions: { onRequest: () => ({ kind: "reject" }) }
  };
  let session: CopilotSession | undefined;
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
    session = thread
      ? await providerCall(client.resumeSession(thread, options), "GitHub Copilot could not reopen this conversation. Start a new chat to continue.")
      : await providerCall(client.createSession({ ...options, name: "Board chat" }), "GitHub Copilot could not start a conversation. Check your Copilot access and connection, then retry.");
    signal.throwIfAborted();
    if (!session.sessionId || (thread && session.sessionId !== thread)) throw new Error("GitHub Copilot returned an unexpected session. Start a new chat to continue.");
    onThread(session.sessionId);
    signal.throwIfAborted();
    const reply = await providerCall(session.sendAndWait({ prompt: input }, 5 * 60_000), "GitHub Copilot could not complete the reply. Check your connection and Copilot access, then retry.");
    signal.throwIfAborted();
    const text = reply?.data?.content;
    if (typeof text !== "string" || !text.trim() || reply?.data.toolRequests?.length) throw new Error("GitHub Copilot did not return a complete text reply. Retry your message.");
    return text;
  } catch (error) {
    if (signal.aborted) throw new Error("GitHub Copilot chat stopped.");
    throw error;
  } finally {
    signal.removeEventListener("abort", interrupt);
    if (!await (interrupted ?? close(false))) throw new Error("GitHub Copilot could not stop its local runtime. Check the board process before retrying.");
  }
}
