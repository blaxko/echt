import { describe, expect, it } from "vitest";
import { analyzePayments, type VoiceWallet } from "../src/payments.ts";
import type { Transfer } from "../src/types.ts";
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

describe("analyzePayments (PRD §6.6 definitions)", () => {
  it("marks a sender that paid two converging voices as a campaign source", () => {
    const voices = [voice(1), voice(2)];
    const transfers: Transfer[] = [
      transferTo(1, { index: 0, hoursBeforePost: 24 }),
      transferTo(2, { index: 1, hoursBeforePost: 24 }),
    ];
    const a = analyzePayments(voices, transfers, meta);
    expect(a.campaignSources).toEqual([SOURCE]);
    expect(a.qualifying).toHaveLength(2);
    expect(a.exclusions).toEqual([]);
  });

  it("does not treat a sender that paid only one voice as a campaign source", () => {
    const voices = [voice(1), voice(2)];
    const transfers = [transferTo(1, { index: 0, hoursBeforePost: 24 })];
    const a = analyzePayments(voices, transfers, meta);
    expect(a.campaignSources).toEqual([]);
    expect(a.qualifying).toEqual([]);
    expect(a.linkedPersonaIds).toEqual([]);
  });

  it("excludes post-dated transfers", () => {
    const voices = [voice(1)];
    const t = transferTo(1, { index: 0, hoursBeforePost: -1 });
    const a = analyzePayments(voices, [t], meta);
    expect(a.exclusions).toEqual([{ txHash: t.txHash, personaId: "persona_01", reason: "post_dated" }]);
  });

  it("excludes transfers older than the 72 h lookback", () => {
    const voices = [voice(1)];
    const t = transferTo(1, { index: 0, hoursBeforePost: 73 });
    const a = analyzePayments(voices, [t], meta);
    expect(a.exclusions[0]?.reason).toBe("outside_lookback");
  });

  it("excludes transfers below 0.001 ETH (1e15 wei)", () => {
    const voices = [voice(1)];
    const t = transferTo(1, { index: 0, hoursBeforePost: 24, amountWei: "999999999999999" });
    const a = analyzePayments(voices, [t], meta);
    expect(a.exclusions[0]?.reason).toBe("below_threshold");
  });

  it("accepts exactly 0.001 ETH", () => {
    const voices = [voice(1), voice(2)];
    const t1 = transferTo(1, { index: 0, hoursBeforePost: 24, amountWei: "1000000000000000" });
    const t2 = transferTo(2, { index: 1, hoursBeforePost: 24, amountWei: "1000000000000000" });
    expect(analyzePayments(voices, [t1, t2], meta).qualifying).toHaveLength(2);
  });

  it("ignores transfers into unverified wallets but records them", () => {
    const voices = [voice(1, false), voice(2)];
    const t = transferTo(1, { index: 0, hoursBeforePost: 24 });
    const t2 = transferTo(2, { index: 1, hoursBeforePost: 24 });
    const a = analyzePayments(voices, [t, t2], meta);
    expect(a.exclusions).toEqual([
      { txHash: t.txHash, personaId: "persona_01", reason: "unverified_wallet" },
      { txHash: t2.txHash, personaId: "persona_02", reason: "not_campaign_source" },
    ]);
    expect(a.linkedPersonaIds).toEqual([]);
  });

  it("reports a campaign source with no metadata as missing (never assumed clean)", () => {
    const voices = [voice(1), voice(2)];
    const transfers = [
      transferTo(1, { index: 0, hoursBeforePost: 24 }),
      transferTo(2, { index: 1, hoursBeforePost: 24 }),
    ];
    const a = analyzePayments(voices, transfers, {});
    expect(a.missingSourceMeta).toEqual([SOURCE]);
  });

  it("flags a campaign source that is a known exchange or above 10,000 transactions", () => {
    const voices = [voice(1), voice(2)];
    const transfers = [
      transferTo(1, { index: 0, hoursBeforePost: 24 }),
      transferTo(2, { index: 1, hoursBeforePost: 24 }),
    ];
    expect(analyzePayments(voices, transfers, { [SOURCE]: { txCount: 10_001, knownExchange: false } }).exchangeSources).toEqual([SOURCE]);
    expect(analyzePayments(voices, transfers, { [SOURCE]: { txCount: 10_000, knownExchange: false } }).exchangeSources).toEqual([]);
    expect(analyzePayments(voices, transfers, { [SOURCE]: { txCount: 3, knownExchange: true } }).exchangeSources).toEqual([SOURCE]);
  });
});
