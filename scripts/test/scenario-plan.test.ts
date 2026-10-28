import { describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  checkPostTiming,
  PAID_SETS,
  PERSONA_COUNT,
  paidNumbers,
  personaId,
  scenarioWallets,
  voiceNumbers,
} from "../scenario-plan.ts";

// Test-only wallets: keys derived from fixed labels, never used for any transfer.
const testWallets = Array.from({ length: PERSONA_COUNT }, (_, i) => {
  const n = i + 1;
  const account = privateKeyToAccount(keccak256(toHex(`echt-test-persona-${n}`)));
  return { id: personaId(n), address: account.address.toLowerCase() };
});

describe("scenario persona sets", () => {
  it("T1 and T2 voice sets do not overlap", () => {
    const t1 = new Set(voiceNumbers("T1"));
    const overlap = voiceNumbers("T2").filter((n) => t1.has(n));
    expect(overlap).toEqual([]);
  });

  it("T1 and T2 read disjoint wallet addresses", () => {
    const t1 = scenarioWallets("T1", testWallets).map((w) => w.address);
    const t2 = scenarioWallets("T2", testWallets).map((w) => w.address);
    expect(t1).toHaveLength(7);
    expect(t2).toHaveLength(7);
    expect(t1.filter((a) => t2.includes(a))).toEqual([]);
  });

  it("T1 uses personas 01–07 and T2 uses personas 08–14", () => {
    expect(scenarioWallets("T1", testWallets).map((w) => w.id)).toEqual([
      "persona_01", "persona_02", "persona_03", "persona_04", "persona_05", "persona_06", "persona_07",
    ]);
    expect(scenarioWallets("T2", testWallets).map((w) => w.id)).toEqual([
      "persona_08", "persona_09", "persona_10", "persona_11", "persona_12", "persona_13", "persona_14",
    ]);
  });

  it("every paid persona is a voice of its own scenario", () => {
    for (const scenario of Object.keys(PAID_SETS)) {
      const voices = new Set(voiceNumbers(scenario));
      for (const n of paidNumbers(scenario)) expect(voices.has(n)).toBe(true);
    }
  });

  it("T2 pays exactly one of its seven personas", () => {
    expect(paidNumbers("T2")).toEqual([8]);
  });

  it("refuses an unknown scenario", () => {
    expect(() => voiceNumbers("T9")).toThrow("unknown scenario T9");
  });

  it("refuses a payment to a persona that is not a voice of the scenario", () => {
    const saved = PAID_SETS.T2 as readonly number[];
    try {
      PAID_SETS.T2 = [1]; // persona_01 belongs to T1
      expect(() => paidNumbers("T2")).toThrow("not one of its voices");
    } finally {
      PAID_SETS.T2 = saved;
    }
  });
});

describe("post timing", () => {
  const H = 3_600_000;
  const pay = (personaId: string, hours: number) => ({ personaId, blockTimestampMs: Date.parse("2026-10-28T04:00:00Z") + hours * H });
  const post = (personaId: string, ms: number) => ({ personaId, postedAtMs: ms });
  const at = (iso: string) => Date.parse(iso);

  it("accepts posts 8–14 h after payment, all inside one 6 h window", () => {
    const payments = [pay("persona_01", 0), pay("persona_02", 0.1)];
    const posts = [post("persona_01", at("2026-10-28T12:00:00Z")), post("persona_02", at("2026-10-28T12:30:00Z"))];
    expect(checkPostTiming(payments, posts)).toEqual([]);
  });

  it("rejects a post less than 8 h after its payment", () => {
    const errors = checkPostTiming([pay("persona_01", 0)], [post("persona_01", at("2026-10-28T06:00:00Z"))]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("must be 8–14 h");
  });

  it("rejects a post more than 14 h after its payment", () => {
    const errors = checkPostTiming([pay("persona_01", 0)], [post("persona_01", at("2026-10-28T19:00:00Z"))]);
    expect(errors[0]).toContain("must be 8–14 h");
  });

  it("rejects posts spread over more than 6 h", () => {
    const posts = [post("persona_06", at("2026-10-28T10:00:00Z")), post("persona_07", at("2026-10-28T16:30:00Z"))];
    expect(checkPostTiming([], posts)).toEqual([expect.stringContaining("must fit inside 6 h")]);
  });

  it("treats a 6 h span as valid (boundary)", () => {
    const posts = [post("persona_06", at("2026-10-28T10:00:00Z")), post("persona_07", at("2026-10-28T16:00:00Z"))];
    expect(checkPostTiming([], posts)).toEqual([]);
  });
});
