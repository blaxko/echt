// Builds the read-only public demo. It copies the committed run records and the saved RYO fixtures into
// the build, then runs Vite with VITE_PUBLIC_DEMO=1. The result has no server calls and no keys.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(WEB, "..", "..");
const DEMO = join(WEB, "public", "demo");

rmSync(DEMO, { recursive: true, force: true });
mkdirSync(join(DEMO, "runs"), { recursive: true });
mkdirSync(join(DEMO, "fixtures"), { recursive: true });
for (const f of readdirSync(join(REPO, "scenarios", "runs"))) {
  if (f.endsWith(".json")) cpSync(join(REPO, "scenarios", "runs", f), join(DEMO, "runs", f));
}
for (const f of readdirSync(join(REPO, "scenarios", "fixtures"))) {
  if (/^ryo-analyze_token-.*-error-retry-28oct\.json$/.test(f)) cpSync(join(REPO, "scenarios", "fixtures", f), join(DEMO, "fixtures", f));
}

const vite = join(WEB, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [vite, "build", "--outDir", "dist-public", "--emptyOutDir"], {
  cwd: WEB,
  stdio: "inherit",
  env: { ...process.env, VITE_PUBLIC_DEMO: "1" },
});
process.exit(result.status ?? 1);
