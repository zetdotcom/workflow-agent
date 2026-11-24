import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = join(root, ".local", "tmp");
mkdirSync(temp, { recursive: true });
const env = {
  ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp,
  PLAYWRIGHT_BROWSERS_PATH: join(root, ".local", "browsers")
};
const install = process.argv[2] === "install";
const args = install
  ? [join(root, "node_modules", "playwright-core", "cli.js"), "install", "chromium", "--only-shell", ...process.argv.slice(3)]
  : ["--test", "tests/browser.test.mjs", "tests/repository.test.mjs", "tests/chat.test.mjs"];
const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
