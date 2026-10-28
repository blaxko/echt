import { describe, expect, it } from "vitest";
import { sourceMetaFor } from "../src/chain-record.ts";

// Test-only addresses. No network call is made: the test only passes when no source lookup is needed.
const SOURCE = "0xaa00000000000000000000000000000000000001";
const wallet = (n: number) => `0x${String(n).padStart(40, "0")}`;
const T0 = Date.parse("2026-10-28T16:00:00Z");

const voices = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  personaId: `persona_0${n}`,
  wallet: wallet(n),
  verified: true,
  postedAtMs: T0,
  disclosedByPostId: null,
}));

const payment = (n: number) => ({
  txHash: `0x${String(n).padStart(64, "0")}` as `0x${string}`,
  blockNumber: 10 + n,
  transactionIndex: 0,
  from: SOURCE as `0x${string}`,
  to: wallet(n) as `0x${string}`,
  amountWei: "2000000000000000",
  timestamp: new Date(T0 - 12 * 3_600_000).toISOString(),
  provenance: "TESTNET" as const,
});

describe("sourceMetaFor", () => {
  it("makes no lookup when the policy finds no campaign source (one payment to a voice, like T2)", async () => {
    const meta = await sourceMetaFor(voices, [payment(1)], [], 0, 100, "unused-key");
    expect(meta).toEqual({});
  });
});
