import { describe, expect, it } from "vitest";
import { decideRun, type RunInput } from "../src/index.ts";

// Synthetic: five voices paid from one source, two unpaid. Test addresses only.
const SOURCE = "0xaa00000000000000000000000000000000000001";
const wallet = (n: number) => `0x${String(n).padStart(40, "0")}`;
const T0 = Date.parse("2026-10-28T16:00:00Z");

function input(overrides: Partial<RunInput> = {}): RunInput {
  return {
    runId: "t1-test",
    symbol: "ETH",
    pinnedToBlock: 100,
    extractionFailed: false,
    providerFailed: false,
    voices: Array.from({ length: 7 }, (_, i) => ({
      personaId: `persona_0${i + 1}`,
      wallet: wallet(i + 1),
      verified: true,
      postedAtMs: T0 + i * 60_000,
      disclosed: false,
    })),
    transfers: Array.from({ length: 5 }, (_, i) => ({
      txHash: `0x${String(i + 1).padStart(64, "0")}` as `0x${string}`,
      blockNumber: 10 + i,
      transactionIndex: 0,
      from: SOURCE,
      to: wallet(i + 1) as `0x${string}`,
      amountWei: "2000000000000000",
      timestamp: new Date(T0 - 12 * 3_600_000 + i * 60_000).toISOString(),
      provenance: "TESTNET" as const,
    })),
    sourceMeta: { [SOURCE]: { txCount: 6, knownExchange: false } },
    ...overrides,
  };
}

describe("decideRun", () => {
  it("BLOCKs five undisclosed linked voices and records the evidence", () => {
    const d = decideRun(input());
    expect(d.verdict).toBe("BLOCK");
    expect(d.reasons).toEqual(["THRESHOLD_MET"]);
    expect(d.linkedPersonaIds).toHaveLength(5);
    expect(d.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic: the same input gives the same hash", () => {
    expect(decideRun(input()).evidenceHash).toBe(decideRun(input()).evidenceHash);
  });

  it("a changed amount changes the transfers section and the hash", () => {
    const base = decideRun(input());
    const tampered = input();
    tampered.transfers = tampered.transfers.map((t, i) => (i === 0 ? { ...t, amountWei: "2000000000000001" } : t));
    const changed = decideRun(tampered);
    expect(changed.evidenceHash).not.toBe(base.evidenceHash);
    expect(changed.sectionHashes.transfers).not.toBe(base.sectionHashes.transfers);
    expect(changed.sectionHashes.voices).toBe(base.sectionHashes.voices);
  });

  it("a provider fault is REVIEW, never ELIGIBLE", () => {
    const d = decideRun(input({ providerFailed: true }));
    expect(d.verdict).toBe("REVIEW");
    expect(d.reasons).toEqual(["PROVIDER_FAILED"]);
  });

  it("a disclosed link does not count toward BLOCK", () => {
    const voices = input().voices.map((v, i) => (i < 3 ? { ...v, disclosed: true } : v));
    const d = decideRun(input({ voices }));
    expect(d.verdict).toBe("ELIGIBLE");
  });

  it("one payment is not a campaign source, so nothing is linked", () => {
    const d = decideRun(input({ transfers: input().transfers.slice(0, 1) }));
    expect(d.linkedPersonaIds).toEqual([]);
    expect(d.verdict).toBe("ELIGIBLE");
  });
});
