import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { stages, type ArchivedChange, type Board, type Change, type Stage, type Ticket } from "./model.js";

const stageFolders = ["1.draft", "2.todo", "3.in-progress", "4.done"];
const documents = [
  ["SPEC.md", "Specification"], ["PLAN-BRIEF.md", "Plan brief"], ["PLAN.md", "Plan"],
  ["PROGRESS.md", "Progress"], ["REVIEWS.md", "Reviews"], ["TO-PR.md", "PR delivery"]
] as const;

async function info(path: string) {
  return lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
}

async function directories(path: string) {
  const stat = await info(path);
  if (!stat) return [];
  if (!stat.isDirectory()) throw new Error("Expected a directory at " + path);
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

export async function checkWorkflow(repository: string) {
  const root = join(repository, ".workflow");
  if (!(await info(root))?.isDirectory()) {
    throw new Error("Could not find a .workflow directory in " + repository + ". Run wf-agent from the repository containing your workflow.");
  }
  return root;
}

async function markdown(path: string, optional = false) {
  const stat = await info(path);
  if (!stat && optional) return undefined;
  if (!stat?.isFile()) throw new Error("Expected a Markdown file at " + path);
  const source = (await readFile(path, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const header = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  return { body: source.slice(header?.[0].length ?? 0).trim(), header: header?.[1] };
}

function title(body: string, id: string) {
  return /^#\s+(.+?)\s*$/m.exec(body)?.[1] ?? id;
}

function section(body: string, heading: string) {
  const lines = body.split("\n");
  const start = lines.findIndex(line => line.trim().toLowerCase() === "## " + heading.toLowerCase());
  if (start === -1) return "";
  const result: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    result.push(line);
  }
  return result.join("\n").trim();
}

function ticketFields(body: string) {
  const fields = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of section(body, "Summary").split("\n")) {
    const match = /^\s*\*\*([^*]+?):\*\*\s*(.*)$/.exec(line);
    if (match) {
      current = [match[2]];
      fields.set(match[1], current);
    } else {
      current?.push(line);
    }
  }
  const field = (name: string) => fields.get(name)?.join("\n").trim() ?? "";
  return { goal: field("Goal"), scope: field("Scope"), criteria: field("Acceptance Criteria") };
}

async function ticket(path: string, id: string, stage: Stage): Promise<Ticket> {
  const { body } = (await markdown(join(path, "TICKET.md")))!;
  const available = [];
  for (const [file, label] of documents) {
    const doc = await markdown(join(path, file), true);
    if (doc) available.push({ label, markdown: doc.body });
  }
  return {
    id, title: title(body, id).replace(/^\d+\s+[—–-]\s+/, ""), stage, ...ticketFields(body),
    documents: [{ label: "Full ticket", markdown: body }, ...available]
  };
}

function changeStage(tickets: Ticket[]): Stage {
  if (tickets.length && tickets.every(item => item.stage === "Done")) return "Done";
  if (tickets.some(item => item.stage === "In Progress" || item.stage === "Done")) return "In Progress";
  if (tickets.some(item => item.stage === "To Do")) return "To Do";
  return "Draft";
}

async function change(path: string, id: string): Promise<Change> {
  const { body } = (await markdown(join(path, "CONTEXT.md")))!;
  const tickets: Ticket[] = [];
  for (const [index, folder] of stageFolders.entries()) {
    const parent = join(path, folder);
    for (const name of await directories(parent)) {
      tickets.push(await ticket(join(parent, name), name, stages[index]));
    }
  }
  tickets.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  return { id, title: title(body, id), goal: section(body, "Goal"), stage: changeStage(tickets), tickets };
}

async function archived(path: string, folder: string): Promise<ArchivedChange> {
  const { body, header } = (await markdown(join(path, "SUMMARY.md")))!;
  const meta = parse(header ?? "") as Record<string, unknown> | null;
  if (typeof meta?.change !== "string" || typeof meta.archived !== "string" || typeof meta.outcome !== "string") {
    throw new Error("Missing archive metadata in " + join(path, "SUMMARY.md"));
  }
  return { folder, id: meta.change, title: title(body, meta.change), date: meta.archived, outcome: meta.outcome, summary: body };
}

export async function readBoard(repository: string): Promise<Board> {
  const root = await checkWorkflow(repository);
  const changes: Change[] = [];
  const archive: ArchivedChange[] = [];
  for (const id of await directories(join(root, "changes"))) changes.push(await change(join(root, "changes", id), id));
  for (const id of await directories(join(root, "archive"))) archive.push(await archived(join(root, "archive", id), id));
  archive.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { repository: basename(repository), changes, archive };
}
