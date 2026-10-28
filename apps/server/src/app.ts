import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { POLICY_VERSION } from "@echt/policy";
import { buildRunPayload, type ScenarioFile } from "./run-payload.ts";
import { runCreSimulation, type SimulationOptions, type SimulationOutcome } from "./cre-run.ts";

// Blocks behind the head to pin the run to. CLAUDE.md §8: pin at least 12 blocks behind the head.
const PIN_DEPTH = 20;
const SCENARIO_FILES: Record<string, string> = { T1: "T1-coordinated.json", T2: "T2-unrelated.json" };
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface RunDeps {
  repoRoot: string;
  loadScenario: (name: string) => Promise<ScenarioFile | null>;
  latestBlock: () => Promise<number>;
  simulate: (options: SimulationOptions) => Promise<SimulationOutcome>;
  now: () => number;
}

export function createApp(deps: RunDeps) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok", policyVersion: POLICY_VERSION }));

  // Dry by default: a simulation with no broadcast. Pass ?broadcast=true to write the verdict on Sepolia.
  app.post("/api/runs/:scenario", async (c) => {
    const name = c.req.param("scenario");
    const scenario = await deps.loadScenario(name);
    if (!scenario) return c.json({ error: `unknown scenario ${name}` }, 404);

    const broadcast = c.req.query("broadcast") === "true";
    const pinnedToBlock = (await deps.latestBlock()) - PIN_DEPTH;
    let payload: ReturnType<typeof buildRunPayload>;
    try {
      payload = buildRunPayload(scenario, pinnedToBlock, deps.now());
    } catch (error) {
      return c.json({ error: (error as Error).message }, 409);
    }

    const dir = await mkdtemp(join(tmpdir(), "echt-run-"));
    const payloadPath = join(dir, "payload.json");
    await writeFile(payloadPath, JSON.stringify(payload));
    const outcome = await deps.simulate({ repoRoot: deps.repoRoot, payloadPath, broadcast });

    return c.json(
      {
        scenario: name,
        pinnedToBlock,
        broadcast,
        label: "Chainlink CRE · local simulation",
        exitCode: outcome.exitCode,
        logs: outcome.logs,
        result: outcome.result,
      },
      outcome.result ? 200 : 502,
    );
  });

  return app;
}

async function loadScenario(name: string): Promise<ScenarioFile | null> {
  const file = SCENARIO_FILES[name];
  if (!file) return null;
  return JSON.parse(await readFile(join(REPO_ROOT, "scenarios", file), "utf8")) as ScenarioFile;
}

async function latestBlock(): Promise<number> {
  const rpc = process.env.SEPOLIA_RPC_URL;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL must be set");
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const body = (await res.json()) as { result: string };
  return Number(BigInt(body.result));
}

export const app = createApp({
  repoRoot: REPO_ROOT,
  loadScenario,
  latestBlock,
  simulate: runCreSimulation,
  now: () => Date.now(),
});
