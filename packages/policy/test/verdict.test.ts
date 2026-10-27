import { describe, expect, it } from "vitest";
import { marketGate, type MarketFacts } from "../src/market.ts";
import { judgePayment, type PaymentJudgement } from "../src/verdict.ts";
import { analyzePayments, type VoiceWallet } from "../src/payments.ts";
import { SOURCE, transferTo } from "./builders.ts";

const BASE = Date.parse("2026-10-29T12:00:00Z");
const voice = (n: number, verified = true): VoiceWallet => ({
  personaId: `persona_${String(n).padStart(2, "0")}`,
  wallet: `0x${(0x1000 + n).toString(16).padStart(40, "0")}`,
  verified,
  postedAtMs: BASE + n * 60_000,
  disclosedByPostId: null,
});
const meta = { [SOURCE]: { txCount: 42, knownExchange: false } };

/** Build a verdict from voices and the list of persona numbers that received a transfer. */
function judge(
  voices: VoiceWallet[],
  paidNumbers: number[],
  opts: { extractionFailed?: boolean; provider?: "ok" | "failed" | "inconsistent" } = {},
): PaymentJudgement {
  const transfers = paidNumbers.map((n, i) => transferTo(n, { index: i, hoursBeforePost: 36 }));
  const analysis = analyzePayments(voices, transfers, meta);
  const linked = analysis.linkedPersonaIds.map((personaId) => {
    const v = voices.find((x) => x.personaId === personaId);
    return { personaId, disclosed: v?.disclosedByPostId !== null && v?.disclosedByPostId !== undefined };
  });
  return judgePayment({
    extractionFailed: opts.extractionFailed ?? false,
    provider: opts.provider ?? "ok",
    analysis,
    linked,
    minVerifiedVoices: 3,
  });
}

const all = (count: number, verified = true) =>
  Array.from({ length: count }, (_, i) => voice(i + 1, verified));

describe("judgePayment: every row of PRD §6.6 and §10.2", () => {
  it("BLOCK: 5 linked, none disclosed → THRESHOLD_MET (T1)", () => {
    expect(judge(all(7), [1, 2, 3, 4, 5])).toEqual({ verdict: "BLOCK", reasons: ["THRESHOLD_MET"] });
  });

  it("BLOCK needs 3 undisclosed linked voices, not 2", () => {
    expect(judge(all(7), [1, 2]).verdict).toBe("ELIGIBLE");
    expect(judge(all(7), [1, 2, 3]).verdict).toBe("BLOCK");
  });

  it("ELIGIBLE + DISCLOSED_CAMPAIGN: 3 or more linked, all disclosed (T3)", () => {
    const voices = all(7).map((v, i) => (i < 5 ? { ...v, disclosedByPostId: `post_${i}` } : v));
    expect(judge(voices, [1, 2, 3, 4, 5])).toEqual({
      verdict: "ELIGIBLE",
      reasons: ["DISCLOSED_CAMPAIGN"],
    });
  });

  it("ELIGIBLE + NO_QUALIFYING_PATTERN: one linked voice (T2)", () => {
    expect(judge(all(7), [1])).toEqual({ verdict: "ELIGIBLE", reasons: ["NO_QUALIFYING_PATTERN"] });
  });

  it("disclosed linked voices do not count toward BLOCK", () => {
    const voices = all(7).map((v, i) => (i < 3 ? { ...v, disclosedByPostId: "post_x" } : v));
    // 5 linked: 3 disclosed, 2 undisclosed → not BLOCK
    expect(judge(voices, [1, 2, 3, 4, 5]).verdict).toBe("ELIGIBLE");
  });

  it("REVIEW INSUFFICIENT_VERIFIED_WALLETS: only 2 verified (T4)", () => {
    const voices = [voice(1), voice(2), ...all(7).slice(2).map((v) => ({ ...v, verified: false }))];
    expect(judge(voices, [1, 2, 3, 4, 5]).verdict).toBe("REVIEW");
    expect(judge(voices, [1, 2, 3, 4, 5]).reasons).toEqual(["INSUFFICIENT_VERIFIED_WALLETS"]);
  });

  it("REVIEW PROVIDER_FAILED on a failed provider (T5)", () => {
    expect(judge(all(7), [1, 2, 3, 4, 5], { provider: "failed" })).toEqual({
      verdict: "REVIEW",
      reasons: ["PROVIDER_FAILED"],
    });
  });

  it("REVIEW PROVIDER_INCONSISTENT on a consensus failure", () => {
    expect(judge(all(7), [1, 2, 3, 4, 5], { provider: "inconsistent" })).toEqual({
      verdict: "REVIEW",
      reasons: ["PROVIDER_INCONSISTENT"],
    });
  });

  it("REVIEW EXTRACTION_FAILED when a converging post failed extraction", () => {
    expect(judge(all(7), [1, 2, 3, 4, 5], { extractionFailed: true })).toEqual({
      verdict: "REVIEW",
      reasons: ["EXTRACTION_FAILED"],
    });
  });

  it("REVIEW EXCHANGE_SOURCE when a campaign source is a known exchange", () => {
    const voices = all(7);
    const analysis = analyzePayments(voices, [1, 2, 3, 4, 5].map((n, i) => transferTo(n, { index: i, hoursBeforePost: 36 })), {
      [SOURCE]: { txCount: 1, knownExchange: true },
    });
    const linked = analysis.linkedPersonaIds.map((personaId) => ({ personaId, disclosed: false }));
    expect(judgePayment({ extractionFailed: false, provider: "ok", analysis, linked, minVerifiedVoices: 3 })).toEqual({
      verdict: "REVIEW",
      reasons: ["EXCHANGE_SOURCE"],
    });
  });
});

describe("marketGate (PRD §6.6 final action input, FR4.4)", () => {
  const env = (over: Partial<Extract<MarketFacts, { kind: "envelope" }>>): MarketFacts => ({
    kind: "envelope",
    status: "ok",
    dataMode: "live",
    verdict: "bullish",
    primarySectionsAvailable: true,
    ...over,
  });

  it("PASS when ok or partial, primary sections available, verdict not bearish", () => {
    expect(marketGate(env({}))).toBe("PASS");
    expect(marketGate(env({ status: "partial", verdict: "neutral" }))).toBe("PASS");
  });

  it("FAIL when the deterministic verdict is bearish", () => {
    expect(marketGate(env({ verdict: "bearish" }))).toBe("FAIL");
  });

  it("UNAVAILABLE when status is unavailable, data_mode simulated, sections missing, or verdict null", () => {
    expect(marketGate(env({ status: "unavailable" }))).toBe("UNAVAILABLE");
    expect(marketGate(env({ dataMode: "simulated" }))).toBe("UNAVAILABLE");
    expect(marketGate(env({ primarySectionsAvailable: false }))).toBe("UNAVAILABLE");
    expect(marketGate(env({ verdict: null }))).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE for every RYO failure kind (§10.2)", () => {
    for (const failure of ["http_429", "http_503", "mcp_is_error", "rest_error", "key_missing"] as const) {
      expect(marketGate({ kind: "failed", failure })).toBe("UNAVAILABLE");
    }
  });
});
