import { cp } from "node:fs/promises";

// Use the same release's skill when the board is installed from its npm tarball.
await cp(new URL("../../skills/wf/", import.meta.url), new URL("../dist/skills/wf/", import.meta.url), { recursive: true });
