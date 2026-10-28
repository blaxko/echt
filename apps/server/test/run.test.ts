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
      posts: [{ id: "post_persona_01", personaId: "persona_01", postedAt: overrides.postedAt ?? "2026-10-28T16:00:00Z", postBlock: overrides.postBlock === undefined ? 12_009_900 : overrides.postBlock }],
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

const RECORD = {
  evidence: { runId: "t1", verdict: "BLOCK" },
  evidenceHash: "0x00",
};

describe("server API", () => {
  function deps(overrides: Partial<RunDeps> = {}): RunDeps {
    return {
      repoRoot: "/unused",
      loadScenario: async (name) => (name === "T1" ? scenario() : null),
      loadRecord: async (name) => (name === "T1" ? RECORD : null),
      latestBlock: async () => 12_010_000,
      simulate: async (o) => {
        o.onLine?.("2026-10-28T05:20:33Z [USER LOG] run t1: payment verdict BLOCK");
        return { logs: [], result: { verdict: "BLOCK" }, exitCode: 0 };
      },
      now: () => AFTER_POST,
      ...overrides,
    };
  }

  async function waitDone(app: ReturnType<typeof createApp>, id: string) {
    for (let i = 0; i < 50; i++) {
      const body = (await (await app.request(`/api/runs/${id}`)).json()) as { status: string; result: unknown };
      if (body.status !== "running") return body;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("run did not finish");
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

  it("starts a simulation-only run, streams its log, and reports the result", async () => {
    let broadcast: boolean | null = null;
    const app = createApp(deps({ simulate: async (o) => { broadcast = o.broadcast; o.onLine?.("[USER LOG] hi"); return { logs: [], result: { verdict: "BLOCK" }, exitCode: 0 }; } }));
    const res = await app.request("/api/runs/T1", { method: "POST" });
    const started = (await res.json()) as { id: string; pinnedToBlock: number; label: string };
    expect(res.status).toBe(202);
    expect(started.pinnedToBlock).toBe(12_009_980);
    expect(started.label).toBe("Chainlink CRE · local simulation");
    const done = await waitDone(app, started.id);
    expect(done.status).toBe("done");
    expect(broadcast).toBe(false);
  });

  it("broadcasts only when asked", async () => {
    let broadcast = false;
    const app = createApp(deps({ simulate: async (o) => { broadcast = o.broadcast; return { logs: [], result: {}, exitCode: 0 }; } }));
    const started = (await (await app.request("/api/runs/T1?broadcast=true", { method: "POST" })).json()) as { id: string };
    await waitDone(app, started.id);
    expect(broadcast).toBe(true);
  });

  it("serves the stored record and its canonical evidence bytes", async () => {
    const app = createApp(deps());
    expect(((await (await app.request("/api/runs/T1/record")).json()) as { evidenceHash: string }).evidenceHash).toBe("0x00");
    const bytes = await (await app.request("/api/runs/T1/evidence.json")).text();
    expect(bytes).toBe('{"runId":"t1","verdict":"BLOCK"}');
    expect((await app.request("/api/runs/T2/record")).status).toBe(404);
  });

  it("streams run events as server-sent events", async () => {
    const app = createApp(deps());
    const started = (await (await app.request("/api/runs/T1", { method: "POST" })).json()) as { id: string };
    const text = await (await app.request(`/api/runs/${started.id}/events`)).text();
    expect(text).toContain("event: log");
    expect(text).toContain("event: done");
  });
});

describe("disclosure from extraction", () => {
  it("marks a disclosed voice with its post id, and leaves the others unmarked", () => {
    const s = scenario();
    const payload = buildRunPayload(s, 12_009_980, AFTER_POST, new Set(["persona_01"]));
    expect(payload.voices[0]!.disclosedByPostId).toBe("post_persona_01");
    expect(buildRunPayload(s, 12_009_980, AFTER_POST).voices[0]!.disclosedByPostId).toBeNull();
  });
});
