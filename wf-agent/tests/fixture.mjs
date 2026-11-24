import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export async function fixture(t) {
  const scratch = fileURLToPath(new URL("../.local/test-runs/", import.meta.url));
  await mkdir(scratch, { recursive: true });
  const path = await mkdtemp(join(scratch, "repo-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
