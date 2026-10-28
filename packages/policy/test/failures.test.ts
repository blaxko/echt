import { describe, expect, it } from "vitest";
import { providerOutcome } from "../src/failures.ts";
import { analyzePayments } from "../src/payments.ts";
import { bullishPost, SOURCE, t1Input, transferTo } from "./builders.ts";
import { evaluate } from "../src/evaluate.ts";

describe("provider failure mapping (PRD §10.2)", () => {
  it("maps each failure kind to ok, failed or inconsistent", () => {
    expect(providerOutcome({ kind: "ok" })).toBe("ok");
    expect(providerOutcome({ kind: "timeout" })).toBe("failed");
    expect(providerOutcome({ kind: "http_5xx" })).toBe("failed");
    expect(providerOutcome({ kind: "rows_over_limit", rows: 1001 })).toBe("failed");
    expect(providerOutcome({ kind: "consensus_failed" })).toBe("inconsistent");
  });

  it("treats 1000 rows as within the limit and 1001 as over it", () => {
    expect(providerOutcome({ kind: "rows_over_limit", rows: 1000 })).toBe("ok");
  });
});

describe("failure cases that must not produce ELIGIBLE (PRD §10.2)", () => {
  it("a transfer after the post is not qualifying", () => {
    const voices = [1, 2].map((n) => ({
      personaId: `persona_0${n}`,
      wallet: `0x${(0x1000 + n).toString(16).padStart(40, "0")}`,
      verified: true,
      postedAtMs: Date.parse("2026-10-29T12:00:00Z") + n * 60_000,
      disclosedByPostId: null,
    }));
    const transfers = [1, 2].map((n, i) => transferTo(n, { index: i, hoursBeforePost: -2 }));
    expect(analyzePayments(voices, transfers, { [SOURCE]: { txCount: 1, knownExchange: false } }).qualifying).toEqual([]);
  });

  it("the same voice posting three times counts once", () => {
    const base = t1Input();
    const extra = [bullishPost(1, 20), bullishPost(1, 40)];
    const r = evaluate({
      ...base,
      posts: [...base.posts, ...extra.map((e) => e.post)],
      extractions: [...base.extractions, ...extra.map((e) => e.extraction)],
    });
    if (r.status !== "DECIDED") throw new Error("expected a decision");
    expect(r.convergence.voices).toHaveLength(7);
  });

  it("a RYO-side failure with a provider success still reports the market as UNAVAILABLE, not PASS", () => {
    const r = evaluate(t1Input({ transfers: [], market: { kind: "failed", failure: "mcp_is_error" } }));
    if (r.status !== "DECIDED") throw new Error("expected a decision");
    expect(r.marketGate).toBe("UNAVAILABLE");
    expect(r.finalAction).toBe("NO_POSITION");
  });
});
