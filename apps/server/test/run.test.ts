import { describe, expect, it } from "vitest";
import { createApp, type RunDeps } from "../src/app.ts";
import { buildRunPayload, type ScenarioFile } from "../src/run-payload.ts";
import { parseSimulationOutput } from "../src/cre-run.ts";

// Test-only scenario: synthetic persona IDs and addresses. Not the real TESTNET files.
const ADDRESS = "0x78A911C5EAc77756A2AA52734c6491fa777F722E";
function scenario(overrides: { postBlock?: number | null; postedAt?: string } = {}): ScenarioFile {
  return {
    id: "T1",
    provenance: "TESTNET",
    input: {
      runId: "t1-coordinated",
      tokenSymbol: "ETH",
      campaignSource: "0xaA9FE8c47cBFD12E1D6109b7c825c5b478A7B25c",
      voices: [{ personaId: "persona_01", wallet: ADDRESS, attestation: { method: "signed_challenge" } }],
      posts: [{ personaId: "persona_01", postedAt: overrides.postedAt ?? "2026-10-28T16:00:00Z", postBlock: overrides.postBlock === undefined ? 12_009_900 : overrides.postBlock }],
    },
  };
}

const AFTER_POST = Date.parse("2026-10-28T17:00:00Z");
const BEFORE_POST = Date.parse("2026-10-28T12:00:00Z");

describe("buildRunPayload", () => {
  it("builds the workflow payload from a due, filled scenario", () => {
    const payload = buildRunPayload(scenario(), 12_009_980, AFTER_POST);
    expect(payload).toEqual({
      runId: "t1-coordinated",
      symbol: "ETH",
      pinnedToBlock: 12_009_980,
      extractionFailed: false,
      knownExchanges: [],
      voices: [{ personaId: "persona_01", wallet: ADDRESS.toLowerCase(), verified: true, postBlock: 12_009_900, postedAtMs: AFTER_POST - 3_600_000, disclosedByPostId: null }],
    });
  });

  it("refuses a post that is still in the future", () => {
    expect(() => buildRunPayload(scenario(), 12_009_980, BEFORE_POST)).toThrow("still in the future");
  });

  it("refuses a scenario whose postBlock is not filled", () => {
    expect(() => buildRunPayload(scenario({ postBlock: null }), 12_009_980, AFTER_POST)).toThrow("not filled yet");
  });

  it("refuses a pinned block before the posts", () => {
    expect(() => buildRunPayload(scenario(), 12_000_000, AFTER_POST)).toThrow("before the posts");
  });

  it("marks an unattested voice as unverified", () => {
    const s = scenario();
    s.input.voices[0]!.attestation = { method: "unverified_claim" };
    expect(buildRunPayload(s, 12_009_980, AFTER_POST).voices[0]!.verified).toBe(false);
  });
});

describe("parseSimulationOutput", () => {
  it("reads the user log lines and the workflow result", () => {
    const text = [
      "2026-10-28T05:20:28Z [SIMULATION] Running trigger trigger=http-trigger@1.0.0-alpha",
      "2026-10-28T05:20:33Z [USER LOG] run t1: payment verdict BLOCK (THRESHOLD_MET)",
      "✓ Workflow Simulation Result:",
      "\"{\\\"runId\\\":\\\"t1\\\",\\\"verdict\\\":\\\"BLOCK\\\"}\"",
      "",
    ].join("\n");
    const parsed = parseSimulationOutput(text);
    expect(parsed.logs).toEqual(["run t1: payment verdict BLOCK (THRESHOLD_MET)"]);
    expect(parsed.result).toEqual({ runId: "t1", verdict: "BLOCK" });
  });

  it("returns a null result when the simulation printed none", () => {
    expect(parseSimulationOutput("✗ failed to parse HTTP trigger payload").result).toBeNull();
  });
});

describe("POST /api/runs/:scenario", () => {
  function deps(overrides: Partial<RunDeps> = {}): RunDeps {
    return {
      repoRoot: "/unused",
      loadScenario: async (name) => (name === "T1" ? scenario() : null),
      latestBlock: async () => 12_010_000,
      simulate: async () => ({ logs: ["run t1: payment verdict BLOCK"], result: { verdict: "BLOCK" }, exitCode: 0 }),
      now: () => AFTER_POST,
      ...overrides,
    };
  }

  it("404s on an unknown scenario", async () => {
    const res = await createApp(deps()).request("/api/runs/T9", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("409s and never simulates when the scenario is not ready", async () => {
    let called = false;
    const app = createApp(deps({ loadScenario: async () => scenario({ postBlock: null }), simulate: async () => { called = true; return { logs: [], result: null, exitCode: 0 }; } }));
    const res = await app.request("/api/runs/T1", { method: "POST" });
    expect(res.status).toBe(409);
    expect(called).toBe(false);
  });

  it("simulates without broadcasting by default, and labels the result as a local simulation", async () => {
    let seen: { broadcast: boolean; pinned: number } | null = null;
    const app = createApp(deps({ simulate: async (o) => { seen = { broadcast: o.broadcast, pinned: 0 }; return { logs: [], result: { verdict: "BLOCK" }, exitCode: 0 }; } }));
    const res = await app.request("/api/runs/T1", { method: "POST" });
    const body = (await res.json()) as { label: string; pinnedToBlock: number; broadcast: boolean; result: { verdict: string } };
    expect(res.status).toBe(200);
    expect(seen).toEqual({ broadcast: false, pinned: 0 });
    expect(body.label).toBe("Chainlink CRE · local simulation");
    expect(body.pinnedToBlock).toBe(12_009_980);
    expect(body.result.verdict).toBe("BLOCK");
  });

  it("broadcasts only when asked", async () => {
    let broadcast = false;
    const app = createApp(deps({ simulate: async (o) => { broadcast = o.broadcast; return { logs: [], result: {}, exitCode: 0 }; } }));
    await app.request("/api/runs/T1?broadcast=true", { method: "POST" });
    expect(broadcast).toBe(true);
  });
});

