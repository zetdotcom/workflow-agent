export const chatProviders = { codex: "Codex", claude: "Claude Code", copilot: "GitHub Copilot" } as const;
export type ChatProvider = keyof typeof chatProviders;

export function chatProvider(value: unknown): ChatProvider {
  if (typeof value !== "string" || !Object.hasOwn(chatProviders, value)) {
    throw new ChatError(400, "Choose Codex, Claude Code, or GitHub Copilot.");
  }
  return value as ChatProvider;
}

export interface BoardSelection {
  change: string;
  ticket?: string;
}

export interface WorkflowAction extends BoardSelection {
  id: string;
  command: "status" | "to-pr";
  reason: string;
  stage: string;
  directory: string;
  fingerprint: string;
  branch?: string;
  remote?: string;
  destinations?: string[];
  head?: string;
  specIdentity?: string;
  planIdentity?: string;
  plan?: string;
  spec?: string;
}

export interface ChatEntry {
  id: string;
  kind: "user" | "assistant" | "decision" | "tool" | "diff" | "notice" | "error";
  title: string;
  text: string;
  url?: string;
}

export interface HostPrompt {
  id: string;
  title: string;
  detail: string;
  questions?: { id: string; question: string; options: string[]; optional?: boolean }[];
}

export interface ChatSummary {
  id: string;
  provider: ChatProvider;
  title: string;
  updated: number;
}

export interface ChatView extends ChatSummary {
  running: boolean;
  entries: ChatEntry[];
  proposal?: WorkflowAction;
  prompt?: HostPrompt;
}

export class ChatError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

// Only public summaries and tool activity enter the board transcript.
export function displayText(text: string) {
  return text.replace(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g, "[redacted private key]")
    .replace(/(https?:\/\/)[^/\s?#@]+:[^/\s?#@]+@/gi, "$1[redacted]@")
    .replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, "$1 [redacted]")
    .replace(/((?:[\w.-]*(?:api[_-]?key|token|password|secret|authorization))["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi, "$1[redacted]")
    .replace(/\b(?:sk-[\w-]{12,}|gh[pousr]_[\w]{12,}|github_pat_[\w]{12,}|xox[baprs]-[\w-]+|AKIA[A-Z0-9]{16})\b/g, "[redacted]");
}
