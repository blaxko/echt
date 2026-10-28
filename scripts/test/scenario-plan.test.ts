import { describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PAID_SETS, PERSONA_COUNT, paidNumbers, personaId, scenarioWallets, voiceNumbers } from "../scenario-plan.ts";

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
    const saved = PAID_SETS.T2;
    try {
      PAID_SETS.T2 = [1]; // persona_01 belongs to T1
      expect(() => paidNumbers("T2")).toThrow("not one of its voices");
    } finally {
      PAID_SETS.T2 = saved;
    }
  });
});
