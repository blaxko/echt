import { describe, expect, it } from "vitest";
import { evaluate, severity, type EvaluationInput } from "../src/evaluate.ts";
import { bullishPost, persona, SOURCE, t1Input, transferTo } from "./builders.ts";
import { POLICY_CONFIG } from "../src/policy.config.ts";

describe("evaluate: scenario-level outcomes (PRD §10.1)", () => {
  it("T1 coordinated → BLOCK, NO_POSITION, THRESHOLD_MET", () => {
    const r = evaluate(t1Input());
    expect(r).toMatchObject({
      status: "DECIDED",
      paymentVerdict: "BLOCK",
      reasonCodes: ["THRESHOLD_MET"],
      marketGate: "PASS",
      finalAction: "NO_POSITION",
    });
  });

  it("T1 with live market PASS still does not open a position", () => {
    expect(evaluate(t1Input())).toMatchObject({ finalAction: "NO_POSITION" });
  });

  it("T2 unrelated convergence → ELIGIBLE, then market decides: PASS → OPEN_PRACTICE_POSITION", () => {
    const input = t1Input({ transfers: [transferTo(1, { index: 0, hoursBeforePost: 11 })] });
    expect(evaluate(input)).toMatchObject({
      paymentVerdict: "ELIGIBLE",
      reasonCodes: ["NO_QUALIFYING_PATTERN"],
      marketGate: "PASS",
      finalAction: "OPEN_PRACTICE_POSITION",
    });
  });

  it("T2 with RYO unavailable → NO_POSITION, MARKET_UNAVAILABLE (PRD §10.1 market-gate case)", () => {
    const input = t1Input({
      transfers: [transferTo(1, { index: 0, hoursBeforePost: 11 })],
      market: { kind: "failed", failure: "http_429" },
    });
    expect(evaluate(input)).toMatchObject({
      paymentVerdict: "ELIGIBLE",
      marketGate: "UNAVAILABLE",
      finalAction: "NO_POSITION",
      reasonCodes: ["NO_QUALIFYING_PATTERN", "MARKET_UNAVAILABLE"],
    });
  });

  it("T5 provider down → REVIEW · PROVIDER_FAILED, never ELIGIBLE", () => {
    expect(evaluate(t1Input({ provider: "failed" }))).toMatchObject({
      paymentVerdict: "REVIEW",
      reasonCodes: ["PROVIDER_FAILED"],
      finalAction: "NO_POSITION",
    });
  });

  it("returns IDLE without deciding when there is no convergence", () => {
    const full = t1Input();
    const fewer = { ...full, posts: full.posts.slice(0, 4), extractions: full.extractions.slice(0, 4) };
    expect(evaluate(fewer)).toEqual({ status: "IDLE" });
  });

  it("opens a $400 practice long at the -8% stop when every gate passes", () => {
    const r = evaluate(t1Input({ transfers: [] }));
    expect(r).toMatchObject({
      paymentVerdict: "ELIGIBLE",
      proposal: { side: "long", sizeUsd: 400, stopPct: 0.08 },
      finalAction: "OPEN_PRACTICE_POSITION",
    });
  });
});

describe("evaluate: failure safety", () => {
  it("a provider failure never yields ELIGIBLE, and any failure never yields OPEN_PRACTICE_POSITION", () => {
    const cleanTransfers = [transferTo(1, { index: 0, hoursBeforePost: 11 })];
    const providerFailures: Partial<EvaluationInput>[] = [{ provider: "failed" }, { provider: "inconsistent" }];
    for (const f of providerFailures) {
      const r = evaluate(t1Input({ ...f, transfers: cleanTransfers }));
      if (r.status === "DECIDED") expect(r.paymentVerdict).toBe("REVIEW");
    }
    const anyFailure: Partial<EvaluationInput>[] = [
      ...providerFailures,
      { market: { kind: "failed", failure: "key_missing" } },
      { extractions: [] }, // no extraction for any post: converge to IDLE, never a decision
    ];
    for (const f of anyFailure) {
      const r = evaluate(t1Input({ ...f, transfers: cleanTransfers }));
      if (r.status === "DECIDED") expect(r.finalAction).toBe("NO_POSITION");
    }
  });

  it("removing any qualifying transfer from T1 never increases severity (PRD §11 F6)", () => {
    const base = evaluate(t1Input());
    if (base.status !== "DECIDED") throw new Error("T1 must decide");
    const transfers = t1Input().transfers;
    for (let i = 0; i < transfers.length; i++) {
      const reduced = evaluate(t1Input({ transfers: transfers.filter((_, j) => j !== i) }));
      if (reduced.status !== "DECIDED") throw new Error("reduced T1 must decide");
      expect(severity(reduced.paymentVerdict)).toBeLessThanOrEqual(severity(base.paymentVerdict));
    }
  });
});

describe("evaluate: convergence details", () => {
  it("counts a disclosure that appears only in a follow-up post and cites it", () => {
    const base = t1Input();
    const follow = bullishPost(1, 30, true); // persona_01 later says #ad, no token/bullish needed for disclosure
    const r = evaluate({
      ...base,
      posts: [...base.posts, follow.post],
      extractions: [...base.extractions, follow.extraction],
    });
    if (r.status !== "DECIDED") throw new Error("expected a decision");
    expect(r.linkedVoices.find((v) => v.personaId === "persona_01")).toMatchObject({
      disclosed: true,
      disclosedByPostId: follow.post.id,
    });
  });

  it("uses the RiskLimits from the input over the defaults", () => {
    const r = evaluate(t1Input({ transfers: [], riskLimits: { maxPositionUsd: 250, stopPct: 0.08, riskBudgetUsd: 32 } }));
    expect(r).toMatchObject({ proposal: { sizeUsd: 250 } });
  });

  it("flags RISK_LIMIT when a stop percentage is out of range", () => {
    const r = evaluate(t1Input({ transfers: [], riskLimits: { maxPositionUsd: 400, stopPct: 0, riskBudgetUsd: 32 } }));
    expect(r).toMatchObject({ finalAction: "NO_POSITION", reasonCodes: ["NO_QUALIFYING_PATTERN", "RISK_LIMIT"] });
  });

  it("exposes the policy version and the default position parameters", () => {
    expect(POLICY_CONFIG.policyVersion).toBe("echt-policy@2");
    expect(POLICY_CONFIG.practice).toEqual({ maxPositionUsd: 400, stopPct: 0.08, riskBudgetUsd: 32 });
    expect(persona(1, true).handle).toBe("@echt_persona_01");
    expect(SOURCE).toMatch(/^0x[0-9a-f]{40}$/);
  });
});
