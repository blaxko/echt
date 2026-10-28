import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { evidenceBytes, POLICY_VERSION, type JsonValue } from "@echt/policy";
import { buildRunPayload, type ScenarioFile } from "./run-payload.ts";
import { runCreSimulation, type SimulationOptions, type SimulationOutcome } from "./cre-run.ts";
import { makeRealPersistence } from "./chain-record.ts";
import type { PersistOutcome } from "./run-record.ts";
import type { RunPayload } from "./run-payload.ts";

// Blocks behind the head to pin the run to. CLAUDE.md §8: pin at least 12 blocks behind the head.
const PIN_DEPTH = 20;
const SCENARIO_FILES: Record<string, string> = { T1: "T1-coordinated.json", T2: "T2-unrelated.json" };
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface RunDeps {
  repoRoot: string;
  loadScenario: (name: string) => Promise<ScenarioFile | null>;
  loadRecord: (name: string) => Promise<Record<string, unknown> | null>;
  latestBlock: () => Promise<number>;
  simulate: (options: SimulationOptions) => Promise<SimulationOutcome>;
  now: () => number;
  /** Persona IDs the extraction read as disclosed for this scenario. */
  loadDisclosed?: (name: string) => Promise<ReadonlySet<string>>;
  /** Called after a broadcast run finishes. Writes scenarios/runs/<scenario>.json only if the chain agrees. */
  persist?: (scenario: string, payload: RunPayload, result: Record<string, unknown>) => Promise<PersistOutcome>;
}

interface RunState {
  id: string;
  scenario: string;
  logs: string[];
  status: "running" | "done" | "failed";
  result: Record<string, unknown> | null;
  listeners: Set<() => void>;
}

export function createApp(deps: RunDeps) {
  const app = new Hono();
  const runs = new Map<string, RunState>();
  let nextId = 1;

  const notify = (run: RunState) => run.listeners.forEach((fn) => fn());

  app.get("/api/health", (c) => c.json({ status: "ok", policyVersion: POLICY_VERSION }));

  // The stored run record the dashboard shows: a dry run until a real verdict replaces it.
  app.get("/api/runs/:scenario/record", async (c) => {
    const record = await deps.loadRecord(c.req.param("scenario"));
    return record ? c.json(record) : c.json({ error: "no record for this scenario yet" }, 404);
  });

  // FR8.2: the exact canonical bytes of the evidence snapshot.
  app.get("/api/runs/:scenario/evidence.json", async (c) => {
    const record = await deps.loadRecord(c.req.param("scenario"));
    if (!record) return c.json({ error: "no record for this scenario yet" }, 404);
    return new Response(evidenceBytes(record.evidence as Record<string, JsonValue>), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  });

  // Dry by default: a simulation with no broadcast. Pass ?broadcast=true to write the verdict on Sepolia.
  // Refusals (unknown scenario, unfilled or future posts) happen before any CRE call and return 404/409.
  app.post("/api/runs/:scenario", async (c) => {
    const name = c.req.param("scenario");
    const scenario = await deps.loadScenario(name);
    if (!scenario) return c.json({ error: `unknown scenario ${name}` }, 404);

    const broadcast = c.req.query("broadcast") === "true";
    const pinnedToBlock = (await deps.latestBlock()) - PIN_DEPTH;
    let payload: ReturnType<typeof buildRunPayload>;
    try {
      const disclosed = deps.loadDisclosed ? await deps.loadDisclosed(name) : new Set<string>();
      payload = buildRunPayload(scenario, pinnedToBlock, deps.now(), disclosed);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 409);
    }

    const run: RunState = { id: `run-${nextId++}`, scenario: name, logs: [], status: "running", result: null, listeners: new Set() };
    runs.set(run.id, run);
    run.logs.push(`pinned to block ${pinnedToBlock}${broadcast ? ", broadcast on" : ", simulation only"}`);

    void (async () => {
      try {
        const dir = await mkdtemp(join(tmpdir(), "echt-run-"));
        const payloadPath = join(dir, "payload.json");
        await writeFile(payloadPath, JSON.stringify(payload));
        const outcome = await deps.simulate({
          repoRoot: deps.repoRoot,
          payloadPath,
          broadcast,
          onLine: (line) => {
            if (line.trim()) {
              run.logs.push(line);
              notify(run);
            }
          },
        });
        run.result = outcome.result;
        run.status = outcome.result ? "done" : "failed";
        run.logs.push(outcome.result ? "workflow finished" : `workflow failed (exit ${outcome.exitCode})`);
        if (outcome.result && broadcast && deps.persist) {
          const saved = await deps.persist(name, payload, outcome.result);
          run.logs.push(saved.written ? "verdict read back from EchtVerdicts; record written" : `record not written: ${saved.reason}`);
        }
      } catch (error) {
        run.status = "failed";
        run.logs.push(`run error: ${(error as Error).message}`);
      }
      notify(run);
    })();

    return c.json({ id: run.id, scenario: name, pinnedToBlock, broadcast, label: "Chainlink CRE · local simulation" }, 202);
  });

  // Server-sent events: every log line so far, then each new line, then a done event.
  app.get("/api/runs/:id/events", (c) => {
    const run = runs.get(c.req.param("id"));
    if (!run) return c.json({ error: "unknown run" }, 404);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let sent = 0;
        const send = () => {
          while (sent < run.logs.length) {
            controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify(run.logs[sent])}\n\n`));
            sent++;
          }
          if (run.status !== "running") {
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status: run.status, result: run.result })}\n\n`));
            run.listeners.delete(send);
            controller.close();
          }
        };
        run.listeners.add(send);
        send();
      },
      cancel() {
        run.listeners.clear();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  });

  app.get("/api/runs/:id", (c) => {
    const run = runs.get(c.req.param("id"));
    return run ? c.json({ id: run.id, scenario: run.scenario, status: run.status, result: run.result }) : c.json({ error: "unknown run" }, 404);
  });

  return app;
}

async function loadScenario(name: string): Promise<ScenarioFile | null> {
  const file = SCENARIO_FILES[name];
  if (!file) return null;
  return JSON.parse(await readFile(join(REPO_ROOT, "scenarios", file), "utf8")) as ScenarioFile;
}

async function loadDisclosed(name: string): Promise<ReadonlySet<string>> {
  try {
    const file = JSON.parse((await readFile(join(REPO_ROOT, "scenarios", "extractions", `${name}.json`), "utf8")).replace(/^\uFEFF/, "")) as { results: { personaId: string; extraction: { disclosure_detected: boolean } | null }[] };
    return new Set(file.results.filter((r) => r.extraction?.disclosure_detected).map((r) => r.personaId));
  } catch {
    return new Set();
  }
}

async function loadRecord(name: string): Promise<Record<string, unknown> | null> {
  if (!/^T\d$/.test(name)) return null;
  try {
    return JSON.parse((await readFile(join(REPO_ROOT, "scenarios", "runs", `${name}.json`), "utf8")).replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
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
  loadRecord,
  loadDisclosed,
  latestBlock,
  simulate: runCreSimulation,
  now: () => Date.now(),
  persist: makeRealPersistence(REPO_ROOT).persist,
});
