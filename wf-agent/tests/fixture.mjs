import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { delimiter, join } from "node:path";

export async function fixture(t) {
  const scratch = fileURLToPath(new URL("../.local/test-runs/", import.meta.url));
  await mkdir(scratch, { recursive: true });
  const path = await mkdtemp(join(scratch, "repo-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

export function commitWorkflowFixture(repository) {
  execFileSync("git", ["init", "--quiet"], { cwd: repository });
  execFileSync("git", ["add", ".workflow"], { cwd: repository });
  execFileSync("git", ["-c", "user.name=Board Test", "-c", "user.email=board@example.test", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "test: create planned tickets"], { cwd: repository });
  const remote = join(repository, ".git", "board-test-remote.git");
  execFileSync("git", ["init", "--bare", "--quiet", remote], { cwd: repository });
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: repository });
}

export async function peerEnvironment(t) {
  const program = fileURLToPath(new URL("codex-fixture.mjs", import.meta.url));
  const state = await fixture(t);
  const bin = join(state, "bin");
  const windows = join(bin, "node_modules", "@openai", "codex", "bin");
  await mkdir(windows, { recursive: true });
  await writeFile(join(windows, "package.json"), '{"type":"module"}');
  await copyFile(program, join(windows, "codex.js"));
  const entry = join(bin, "codex");
  await writeFile(entry, "#!/usr/bin/env node\n" + await readFile(program, "utf8"));
  await chmod(entry, 0o755);
  const calls = join(state, "calls.jsonl");
  await writeFile(calls, "");
  return { XDG_STATE_HOME: state, WF_TEST_CALLS: calls, PATH: bin + delimiter + process.env.PATH };
}
