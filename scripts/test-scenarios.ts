// pnpm test:scenarios. Runs every scenarios/T*.json offline and prints an expected-vs-actual table.
// Exits non-zero on any FAIL. PENDING rows (scenarios waiting on the RYO phase) do not fail the run, and are never PASS.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkScenario, formatTable, type RecordedRun, type Row, type ScenarioFile } from "./scenario-check.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCENARIOS = join(ROOT, "scenarios");
const read = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8").trim()) as T;

const files = readdirSync(SCENARIOS).filter((f) => /^T\d+-.*\.json$/.test(f)).sort();
const rows: Row[] = files.map((f) => {
  const scenario = read<ScenarioFile>(join(SCENARIOS, f));
  const runPath = join(SCENARIOS, "runs", `${scenario.id}.json`);
  const run = existsSync(runPath) ? read<RecordedRun>(runPath) : null;
  return checkScenario(scenario, run);
});

console.log(formatTable(rows));
const failed = rows.filter((r) => r.status === "FAIL");
const pending = rows.filter((r) => r.status === "PENDING");
console.log(`\n${rows.length - failed.length - pending.length} PASS, ${failed.length} FAIL, ${pending.length} PENDING`);
process.exitCode = failed.length > 0 ? 1 : 0;
