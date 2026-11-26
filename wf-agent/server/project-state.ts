import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { ChatError, type ChatProvider } from "./chat-model.js";

export async function projectState(repository: string) {
  const marker = join(repository, ".git");
  const info = await lstat(marker).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (!info) return new ProjectState(repository, repository);
  const git = (args: string[]) => promisify(execFile)("git", args, { cwd: repository, windowsHide: true });
  const common = info.isDirectory() ? await realpath(marker) : await realpath(resolve(repository, (await git(["rev-parse", "--git-common-dir"])).stdout.trimEnd()));
  let worktrees: string[] = [];
  if (existsSync(join(common, "worktrees"))) {
    const { stdout } = await git(["worktree", "list", "--porcelain", "-z"]);
    worktrees = stdout.split("\0").filter(field => field.startsWith("worktree ")).map(field => physicalPath(field.slice(9)));
  }
  return new ProjectState(repository, common, undefined, worktrees);
}

// Resolve the existing portion too when creating a state directory through a symlink.
function physicalPath(path: string): string {
  try { return realpathSync(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path === dirname(path)) throw error;
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new ChatError(422, "The private board state path contains a broken symbolic link.");
    return join(physicalPath(dirname(path)), basename(path));
  }
}

function contains(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

export class ProjectState {
  readonly checkoutKey: string;
  readonly projectKey: string;
  private roots: string[];
  constructor(private repository: string, project: string,
    private stateHome = process.env.XDG_STATE_HOME || (process.platform === "win32" && process.env.LOCALAPPDATA) || join(homedir(), ".local", "state"),
    worktrees: string[] = []) {
    this.checkoutKey = createHash("sha256").update(repository).digest("hex");
    this.projectKey = createHash("sha256").update(project).digest("hex");
    this.roots = [repository, basename(project) === ".git" ? dirname(project) : project, ...worktrees];
  }

  location(...parts: string[]) {
    return this.external(resolve(this.stateHome, "wf-agent", ...parts), "XDG_STATE_HOME");
  }

  checkProviderHome(provider: ChatProvider, workflow: boolean) {
    if (provider === "codex") this.external(resolve(this.repository, process.env.CODEX_HOME || join(homedir(), ".codex")), "CODEX_HOME");
    if (provider === "claude") {
      const cwd = workflow ? this.repository : this.location(this.checkoutKey, "providers", "claude");
      this.external(resolve(cwd, process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude")), "CLAUDE_CONFIG_DIR");
    }
  }

  private external(candidate: string, variable: string) {
    const path = physicalPath(candidate);
    if (this.roots.some(root => contains(root, path))) {
      throw new ChatError(422, "Set " + variable + " outside this project and its worktrees for private chat data.");
    }
    return path;
  }
}
