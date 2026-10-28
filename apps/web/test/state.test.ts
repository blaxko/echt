import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { RunRecord } from "../src/api.ts";
import { finalState, isRealEnvelope } from "../src/state.ts";

// The test-only envelope is synthetic. It proves the state logic, and it is never shown on screen.
const testEnvelope = JSON.parse(readFileSync(new URL("./fixtures/ryo-ok-TEST-ONLY.json", import.meta.url), "utf8")) as { status: string };

function record(overrides: { verdict?: RunRecord["verdict"]; marketGate?: string; market?: Record<string, string> }): RunRecord {
  const { market, ...rest } = overrides;
  return {
    scenario: "T2", label: "", verdictTx: null, runId: "r", pinnedToBlock: 1, policyVersion: "echt-policy@2",
    verdict: "ELIGIBLE", reasons: ["NO_QUALIFYING_PATTERN"], linkedPersonaIds: [], marketGate: "PASS", finalAction: "OPEN_PRACTICE_POSITION",
    proposal: { side: "long", sizeUsd: 400, stopPct: 0.08, symbol: "ETH", rationale: "" }, voices: [], provider: { status: "ok" },
    inputs: {}, evidence: {}, evidenceHash: "0x00", sectionHashes: {}, cre: "", dryRun: false,
    market: { status: "UNAVAILABLE", tool: "analyze_token", symbol: "ETH", code: "", message: "", traceId: "", source: "scenarios/fixtures/x.json", ...market },
    ...rest,
  } as unknown as RunRecord;
}

describe("OPEN_PRACTICE_POSITION gate", () => {
  it("opens only with ELIGIBLE, a passing gate and a real ok envelope", () => {
    expect(finalState(record({ market: { status: "ok" } }))).toBe("OPEN_PRACTICE_POSITION");
  });

  it("never opens on the test-only envelope, even when it says ok", () => {
    expect(testEnvelope.status).toBe("ok");
    expect(finalState(record({ market: { status: "ok", source: "apps/web/test/fixtures/ryo-ok-TEST-ONLY.json" } }))).toBe("ELIGIBLE_NO_POSITION");
    expect(isRealEnvelope({ status: "ok", source: "scenarios/fixtures/ryo-TEST.json" } as RunRecord["market"])).toBe(false);
  });

  it("stays no-position while RYO is UNAVAILABLE, even if the gate says PASS", () => {
    expect(finalState(record({ marketGate: "PASS", market: { status: "UNAVAILABLE" } }))).toBe("ELIGIBLE_NO_POSITION");
  });

  it("BLOCK and REVIEW never open a position", () => {
    expect(finalState(record({ verdict: "BLOCK", market: { status: "ok" } }))).toBe("BLOCK");
    expect(finalState(record({ verdict: "REVIEW", market: { status: "ok" } }))).toBe("REVIEW");
  });

  it("IDLE with no record", () => {
    expect(finalState(null)).toBe("IDLE");
  });
});
