import { createHash, randomUUID } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { execFile } from "node:child_process";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { ChatError, displayText, type BoardSelection, type WorkflowAction } from "./chat-model.js";
import { contextPath } from "./model.js";
import { readBoard } from "./repository.js";
import { readPublicPage } from "./repository-text.js";

const git = promisify(execFile);

function outside(path: string) {
  return !path || path === ".." || path.startsWith(".." + sep) || isAbsolute(path) || path.split(sep).some(part => part.toLowerCase() === ".git");
}

export class RepositoryFiles {
  private index?: { expires: number; paths: Promise<string[]> };
  constructor(readonly root: string) {}

  async file(name: string) {
    if (!name || name.includes("\0") || isAbsolute(name) || (process.platform === "win32" && name.includes(":")) ||
        name.split(/[/\\]/).some(part => part === ".." || part.toLowerCase() === ".git")) throw new ChatError(400, "Choose a file inside this repository: " + name);
    const path = await realpath(resolve(this.root, name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") throw new ChatError(404, "File no longer exists: " + name);
      if (error.code === "ELOOP") throw new ChatError(400, "Cannot follow a circular link: " + name);
      throw error;
    });
    if (outside(relative(this.root, path)) || !(await stat(path)).isFile()) throw new ChatError(400, "Choose a regular file inside this repository: " + name);
    return path;
  }

  private async scan() {
    const paths: string[] = [];
    const dirs = [""];
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const entries = await readdir(join(this.root, dir), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      for (const entry of entries) {
        if (entry.name.toLowerCase() === ".git") continue;
        const path = dir ? dir + "/" + entry.name : entry.name;
        if (entry.isDirectory()) dirs.push(path);
        else if (entry.isFile()) paths.push(path);
        else if (entry.isSymbolicLink()) {
          try { await this.file(path); paths.push(path); }
          catch (error) { if (!(error instanceof ChatError)) throw error; }
        }
      }
    }
    return paths;
  }

  async search(query: string, selected = "") {
    if (!this.index || this.index.expires < Date.now()) {
      const index = { expires: Infinity, paths: this.scan() };
      this.index = index;
      index.paths.then(() => { index.expires = Date.now() + 5_000; }, () => { if (this.index === index) this.index = undefined; });
    }
    const term = query.toLowerCase();
    const folder = selected.slice(0, selected.lastIndexOf("/") + 1);
    const rank = (path: string) => (path === selected ? -8 : folder && path.startsWith(folder) ? -4 : 0)
      + (basename(path).toLowerCase() === term ? 0 : basename(path).toLowerCase().startsWith(term) ? 1 : 2);
    return (await this.index.paths).filter(path => path.toLowerCase().includes(term))
      .sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b)).slice(0, 30);
  }

  private async bytes(name: string, offset: number, length: number) {
    const handle = await open(await this.file(name), "r");
    try {
      const page = Buffer.alloc(length);
      let used = 0;
      while (used < length) {
        const { bytesRead } = await handle.read(page, used, length - used, offset + used);
        if (bytesRead === 0) break;
        used += bytesRead;
      }
      const bytes = page.subarray(0, used);
      if (bytes.includes(0)) throw new ChatError(400, "Binary file: " + name);
      const size = (await handle.stat()).size;
      return { bytes, nextOffset: offset + used < size ? offset + used : null };
    } finally { await handle.close(); }
  }

  async read(name: string, offset = 0, signal?: AbortSignal) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new ChatError(400, "Invalid file offset.");
    const handle = await open(await this.file(name), "r");
    try { return await readPublicPage(handle, name, offset, signal); }
    finally { await handle.close(); }
  }

  async discussionFiles(selection: BoardSelection | undefined, attachments: string[]) {
    const paths = new Set<string>();
    if (selection) {
      const board = await readBoard(this.root);
      const change = board.changes.find(item => item.id === selection.change);
      const ticket = change?.tickets.find(item => item.id === selection.ticket);
      const archive = board.archive.find(item => "archived " + item.folder === selection.change);
      if (change && (!selection.ticket || ticket)) paths.add(contextPath(change, ticket));
      else if (archive && !selection.ticket) paths.add(".workflow/archive/" + archive.folder + "/SUMMARY.md");
      else throw new ChatError(409, "The selected board item has moved. Reopen it before sending.");
    }
    for (const path of attachments) paths.add(path);
    const documents: { path: string; text: string }[] = [];
    let remaining = 96 * 1024;
    for (const path of paths) {
      const { bytes, nextOffset } = await this.bytes(path, 0, remaining + 1);
      if (bytes.length > remaining || nextOffset !== null) throw new ChatError(413, "The selected files exceed 96 KiB at " + path + ". Choose smaller files.");
      if (!isUtf8(bytes)) throw new ChatError(400, "Choose a UTF-8 text file: " + path);
      remaining -= bytes.length;
      documents.push({ path, text: displayText(bytes.toString("utf8")) });
    }
    return documents;
  }
}

function match<T extends { id: string }>(items: T[], value: string, label: string): T {
  const exact = items.find(item => item.id === value);
  if (exact) return exact;
  const matches = value ? items.filter(item => item.id.toLowerCase().startsWith(value.toLowerCase())) : [];
  if (matches.length === 1) return matches[0];
  throw new ChatError(422, "Choose one " + label + ". Available: " + (matches.length ? matches : items).map(item => item.id).join(", "));
}

function destination(address: string) {
  if (!URL.canParse(address)) return displayText(address.replace(/^[^/@\s]+@/, ""));
  const url = new URL(address);
  url.username = ""; url.password = ""; url.search = ""; url.hash = "";
  return displayText(url.href);
}

export async function ticketPlanIdentities(files: RepositoryFiles, directory: string) {
  const paths = await Promise.all(["SPEC.md", "PLAN.md"].map(name => files.file(directory + "/" + name)));
  const { stdout } = await git("git", ["hash-object", "--", ...paths], { cwd: files.root, windowsHide: true });
  return stdout.trim().split(/\s+/);
}

export async function prepareAction(files: RepositoryFiles, command: WorkflowAction["command"], changeId: string, ticketId: string, reason: string, requestedRemote?: string): Promise<WorkflowAction> {
  const board = await readBoard(files.root);
  const base = { id: randomUUID(), command, reason: displayText(reason) };
  if (command === "status" && !ticketId) {
    if (changeId === "all" || changeId === "archived") {
      return { ...base, change: changeId, stage: changeId === "all" ? "Active changes" : "Archive",
        directory: ".workflow/" + (changeId === "all" ? "changes" : "archive"), fingerprint: changeId };
    }
    const explicit = changeId.startsWith("archived ");
    if (explicit || !board.changes.some(item => item.id.toLowerCase().startsWith(changeId.toLowerCase()))) {
      const query = changeId.replace(/^archived\s+/, "").toLowerCase();
      const records = board.archive.filter(item => [item.id, item.folder].some(name => name.toLowerCase().startsWith(query)));
      if (records.length > 1) throw new ChatError(422, "Choose one archived record: " + records.map(item => item.folder).join(", "));
      if (records.length === 1) {
        const record = records[0];
        return { ...base, change: "archived " + record.folder, stage: "Archived", directory: ".workflow/archive/" + record.folder,
          fingerprint: createHash("sha256").update(record.summary).digest("hex") };
      }
    }
  }
  const change = match(board.changes, changeId, "change");
  const ticket = ticketId || command === "to-pr" ? match(change.tickets, ticketId, "ticket in " + change.id) : undefined;
  const document = contextPath(change, ticket);
  const directory = document.slice(0, document.lastIndexOf("/"));
  const stage = (ticket ?? change).stage;
  const hash = createHash("sha256").update(document);
  const action: WorkflowAction = { ...base, change: change.id, ticket: ticket?.id, stage, directory, fingerprint: "" };
  if (command === "to-pr") {
    if (stage !== "To Do" && stage !== "In Progress") throw new ChatError(422, "This ticket is " + stage + ". A new to-pr run needs a planned To Do ticket.");
    const names = ["TICKET.md", "SPEC.md", "PLAN.md", "PLAN-BRIEF.md"];
    if (stage === "In Progress") names.push("TO-PR.md");
    for (const name of names) {
      const bytes = await readFile(await files.file(directory + "/" + name));
      if (!bytes.toString("utf8").trim()) throw new ChatError(422, name + " is empty.");
      hash.update(name).update(createHash("sha256").update(bytes).digest());
      if (name === "PLAN.md") action.plan = displayText(bytes.toString("utf8"));
      if (name === "SPEC.md") action.spec = displayText(bytes.toString("utf8"));
    }
    const reviews = ticket?.documents.find(doc => doc.label === "Reviews")?.markdown ?? "";
    const latestPlanReview = reviews.split(/^###\s+Plan Review\b/im).slice(1).at(-1)?.split(/^###\s/m)[0];
    if (latestPlanReview && /\*\*Verdict:\*\*\s*blocked\b/i.test(latestPlanReview)) throw new ChatError(422, "The latest plan review is blocked. Review REVIEWS.md before authorizing to-pr.");
    const gitValue = async (args: string[]) => (await git("git", args, { cwd: files.root, windowsHide: true })).stdout.trim();
    const [branch, head, identities, gitRoot, remotes] = await Promise.all([
      gitValue(["branch", "--show-current"]), gitValue(["rev-parse", "--verify", "HEAD"]),
      ticketPlanIdentities(files, directory), gitValue(["rev-parse", "--show-toplevel"]), gitValue(["remote"])
    ]);
    if (await realpath(gitRoot) !== files.root) throw new ChatError(422, "Run wf-agent from the Git repository root to authorize to-pr.");
    if (!branch) throw new ChatError(422, "Select the intended Git branch before authorizing to-pr.");
    if (!remotes) throw new ChatError(422, "Configure a Git remote for PR delivery before authorizing to-pr.");
    const remoteNames = remotes.split(/\r?\n/);
    const remote = requestedRemote || (remoteNames.length === 1 ? remoteNames[0] : await gitValue(["for-each-ref", "--format=%(push:remotename)", "refs/heads/" + branch]));
    if (!remoteNames.includes(remote)) throw new ChatError(422, "Ask the user which delivery remote to use: " + remoteNames.join(", "));
    const urls = await gitValue(["remote", "get-url", "--push", "--all", "--", remote]);
    action.remote = remote;
    action.destinations = urls.split(/\r?\n/).map(destination);
    [action.specIdentity, action.planIdentity] = identities;
    action.baselineHead = head;
    if (stage === "In Progress") {
      const journal = await readFile(await files.file(directory + "/TO-PR.md"), "utf8");
      const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(journal);
      const metadata = header && parse(header[1], { schema: "failsafe" });
      if (metadata?.spec_identity !== action.specIdentity || metadata?.plan_identity !== action.planIdentity || metadata?.baseline_branch !== branch ||
          typeof metadata.baseline_head !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(metadata.baseline_head)) {
        throw new ChatError(422, "The recorded to-pr run does not match this branch, specification, and plan. Review the ticket before resuming.");
      }
      try { await gitValue(["merge-base", "--is-ancestor", metadata.baseline_head, head]); }
      catch { throw new ChatError(422, "The recorded to-pr baseline is missing from this branch's history. Review the ticket before resuming."); }
      action.baselineHead = metadata.baseline_head;
    }
    action.branch = branch;
    action.head = head;
    hash.update(JSON.stringify([branch, head, remote, urls, reviews, action.specIdentity, action.planIdentity]));
  } else {
    await files.file(document);
  }
  action.fingerprint = hash.digest("hex");
  return action;
}
