// Runs the CRE verdict workflow with `cre workflow simulate` and reads its result.
// Local simulation only: the label is "Chainlink CRE · local simulation" (CLAUDE.md §9).

import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface SimulationOutcome {
  logs: string[];
  result: Record<string, unknown> | null;
  exitCode: number | null;
}

/**
 * Pulls the user log lines and the workflow result out of the CLI output. The result is printed as
 * a JSON string literal after the "Workflow Simulation Result:" header, so it is decoded twice.
 */
export function parseSimulationOutput(text: string): { logs: string[]; result: Record<string, unknown> | null } {
  const lines = text.split(/\r?\n/);
  const logs = lines.filter((l) => l.includes("[USER LOG]")).map((l) => l.slice(l.indexOf("[USER LOG]") + "[USER LOG]".length).trim());
  const header = lines.findIndex((l) => l.includes("Workflow Simulation Result:"));
  if (header === -1) return { logs, result: null };
  const next = lines.slice(header + 1).find((l) => l.trim().length > 0);
  if (!next) return { logs, result: null };
  try {
    const decoded = JSON.parse(next.trim()) as unknown;
    return { logs, result: typeof decoded === "string" ? (JSON.parse(decoded) as Record<string, unknown>) : null };
  } catch {
    return { logs, result: null };
  }
}

export interface SimulationOptions {
  repoRoot: string;
  payloadPath: string;
  broadcast: boolean;
  /** Called with each output line as the CLI prints it, so the run log can stream. */
  onLine?: (line: string) => void;
}

/**
 * Starts `cre workflow simulate` in the workflow project. The root `.env` supplies the Etherscan key
 * and the CRE writer key. `--skip-type-checks` is needed because the generated tsconfig rejects the
 * policy package's `.ts` import suffixes (DECISIONS.md, D11).
 */
export function runCreSimulation(options: SimulationOptions): Promise<SimulationOutcome> {
  const cwd = resolve(options.repoRoot, "cre", "echt-verdict");
  const args = [
    "workflow", "simulate", "echt-verdict",
    "-e", "..\\..\\.env",
    "-T", "staging-settings",
    "--http-payload", options.payloadPath,
    "--trigger-index", "0",
    "--non-interactive",
    "--skip-type-checks",
  ];
  if (options.broadcast) args.push("--broadcast");

  return new Promise((resolvePromise, reject) => {
    const child = spawn("cre", args, { cwd, shell: process.platform === "win32" });
    let stdout = "";
    let pending = "";
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) options.onLine?.(line);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({ ...parseSimulationOutput(stdout), exitCode });
    });
  });
}
