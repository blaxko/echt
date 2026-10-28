import { describe, expect, it } from "vitest";
import { buildRecord, persistRealRun, type PersistOptions, type Readback, type RunRecord } from "../src/run-record.ts";
import type { RunPayload } from "../src/run-payload.ts";

// Test-only data: synthetic wallets and a synthetic source. Nothing here is a real transfer.
const SOURCE = "0xaa00000000000000000000000000000000000001";
const wallet = (n: number) => `0x${String(n).padStart(40, "0")}`;
const POST = Date.parse("2026-10-28T16:00:00Z");
const TX = `0x${"ab".repeat(32)}`;

const payload: RunPayload = {
  runId: "t1-test",
  symbol: "ETH",
  pinnedToBlock: 100,
  extractionFailed: false,
  knownExchanges: [],
  voices: [1, 2, 3, 4, 5].map((n) => ({
    personaId: `persona_0${n}`,
    wallet: wallet(n),
    verified: true,
    postBlock: 90,
    postedAtMs: POST,
    disclosedByPostId: null,
  })),
};
const transfers = [1, 2, 3, 4, 5].map((n) => ({
  txHash: `0x${String(n).padStart(64, "0")}` as `0x${string}`,
  blockNumber: 10 + n,
  transactionIndex: 0,
  from: SOURCE as `0x${string}`,
  to: wallet(n) as `0x${string}`,
  amountWei: "2000000000000000",
  timestamp: new Date(POST - 12 * 3_600_000).toISOString(),
  provenance: "TESTNET" as const,
}));
const sourceMeta = { [SOURCE]: { txCount: 5, knownExchange: false } };
const market = { status: "UNAVAILABLE", tool: "analyze_token", symbol: "ETH", code: "VALIDATION_FAILED", message: "x", traceId: "t", source: "f" };
const proposal = { side: "long", sizeUsd: 400, stopPct: 0.08, symbol: "ETH", rationale: "r" };
const buildInputs = { transfers, sourceMeta, payments: [], personas: {}, market, proposal };

// What the CRE workflow would have returned for this payload, computed with the same policy code.
const expected = buildRecord({ scenario: "T1", label: "x", cre: "x", dryRun: false, payload, transfers, sourceMeta, providerFailed: false, payments: [], personas: {}, market, verdictTx: TX, pinNote: "", proposal });
const creResult = { verdict: expected.verdict, evidenceHash: expected.evidenceHash, txHash: TX, linkedPersonaIds: expected.linkedPersonaIds };
const goodReadback: Readback = { evidenceHash: expected.evidenceHash as `0x${string}`, paymentVerdict: 2, pinnedToBlock: 100, linkedCount: 5 };

function options(overrides: Partial<PersistOptions> = {}) {
  const written: { scenario: string; record: RunRecord }[] = [];
  const opts: PersistOptions = {
    scenario: "T1",
    payload,
    result: creResult,
    buildInputs,
    readVerdict: async () => goodReadback,
    writeRecord: async (scenario, record) => { written.push({ scenario, record }); },
    ...overrides,
  };
  return { opts, written };
}

describe("persistRealRun", () => {
  it("writes a TESTNET record with the verdict tx and the chain read-back", async () => {
    const { opts, written } = options();
    const outcome = await persistRealRun(opts);
    expect(outcome.written).toBe(true);
    expect(written).toHaveLength(1);
    const record = written[0]!.record as Record<string, unknown>;
    expect(record.label).toBe("TESTNET · CRE local simulation");
    expect(record.dryRun).toBe(false);
    expect(record.verdictTx).toBe(TX);
    expect(record.pinnedToBlock).toBe(100);
    expect(record.evidenceHash).toBe(expected.evidenceHash);
    expect(record.readback).toEqual({ source: "EchtVerdicts.getVerdict", ...goodReadback });
  });

  it("writes nothing when the broadcast returned no transaction hash", async () => {
    const { opts, written } = options({ result: { ...creResult, txHash: null } });
    const outcome = await persistRealRun(opts);
    expect(outcome.written).toBe(false);
    expect(written).toHaveLength(0);
  });

  it("writes nothing when the CRE evidence hash differs from the server's recomputation", async () => {
    const { opts, written } = options({ result: { ...creResult, evidenceHash: `0x${"11".repeat(32)}` } });
    const outcome = await persistRealRun(opts);
    expect(outcome).toMatchObject({ written: false });
    expect(written).toHaveLength(0);
  });

  it("writes nothing when getVerdict does not return the same evidence", async () => {
    const { opts, written } = options({ readVerdict: async () => ({ ...goodReadback, evidenceHash: `0x${"22".repeat(32)}` as `0x${string}` }) });
    const outcome = await persistRealRun(opts);
    expect(outcome).toMatchObject({ written: false, reason: "getVerdict evidence hash does not match" });
    expect(written).toHaveLength(0);
  });

  it("writes nothing when getVerdict disagrees on the verdict code", async () => {
    const { opts, written } = options({ readVerdict: async () => ({ ...goodReadback, paymentVerdict: 0 }) });
    expect((await persistRealRun(opts)).written).toBe(false);
    expect(written).toHaveLength(0);
  });
});
