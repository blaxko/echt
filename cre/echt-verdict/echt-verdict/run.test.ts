import { describe, expect, it } from "bun:test";
import { decodeAbiParameters } from "viem";
import T1 from "../../../scenarios/T1-coordinated.json";
import T2 from "../../../scenarios/T2-unrelated.json";
import {
  decide,
  encodeVerdict,
  parseRunRequest,
  parseTxlist,
  lookbackStart,
  sourceMetaFrom,
  toTransfers,
  txlistUrl,
  VERDICT_TUPLE,
  type RunRequest,
  type TxlistRow,
} from "./run.ts";

// Builds the run request from a real TESTNET scenario file. Test-only postBlock: the real one is
// filled from RPC once the post time has passed.
type Scenario = typeof T1;
const TEST_POST_BLOCK = 12_000_000;

function requestFor(scenario: Scenario, overrides: Partial<RunRequest> = {}): RunRequest {
  const postedAt = new Map(scenario.input.posts.map((p) => [p.personaId, p.postedAt]));
  return parseRunRequest({
    runId: scenario.input.runId,
    symbol: scenario.input.tokenSymbol,
    pinnedToBlock: 12_100_000,
    extractionFailed: false,
    knownExchanges: [],
    voices: scenario.input.voices.map((v) => ({
      personaId: v.personaId,
      wallet: v.wallet,
      verified: v.attestation.method === "signed_challenge",
      postBlock: TEST_POST_BLOCK,
      postedAtMs: Date.parse(postedAt.get(v.personaId) ?? ""),
      disclosedByPostId: null,
    })),
    ...overrides,
  });
}

// Etherscan-shaped rows for every TESTNET payment in both scenarios. Both scenarios read the same rows.
function paymentRows(): TxlistRow[] {
  const walletOf = new Map([...T1.input.voices, ...T2.input.voices].map((v) => [v.personaId, v.wallet]));
  const payments = [...T1.input.payments, ...T2.input.payments];
  return payments.map((p, i) => ({
    hash: p.txHash,
    blockNumber: String(p.blockNumber),
    transactionIndex: String(i),
    from: T1.input.campaignSource,
    to: walletOf.get(p.personaId) ?? "",
    value: "2000000000000000",
    timeStamp: String(p.blockTimestamp),
    isError: "0",
  }));
}

const transfers = toTransfers(paymentRows());
const SOURCE = T1.input.campaignSource.toLowerCase();
const sourceMeta = { [SOURCE]: { txCount: 6, knownExchange: false } };

describe("payment verdict on the real TESTNET scenarios", () => {
  it("T1: five linked voices, no disclosure, BLOCK", () => {
    const decision = decide(requestFor(T1 as Scenario), transfers, sourceMeta, false);
    expect(decision.verdict).toBe("BLOCK");
    expect(decision.reasons).toEqual(["THRESHOLD_MET"]);
    expect(decision.linkedPersonaIds).toEqual(["persona_01", "persona_02", "persona_03", "persona_04", "persona_05"]);
  });

  it("T2: one payment is not a campaign source, so nothing is linked and the verdict is ELIGIBLE", () => {
    const decision = decide(requestFor(T2 as Scenario), transfers, sourceMeta, false);
    expect(decision.verdict).toBe("ELIGIBLE");
    expect(decision.reasons).toEqual(["NO_QUALIFYING_PATTERN"]);
    expect(decision.linkedPersonaIds).toEqual([]);
    expect(decision.analysis.exclusions.map((e) => e.reason)).toContain("not_campaign_source");
  });

  it("a missing source lookup forces REVIEW, never ELIGIBLE", () => {
    const decision = decide(requestFor(T1 as Scenario), transfers, {}, false);
    expect(decision.verdict).toBe("REVIEW");
    expect(decision.reasons).toEqual(["PROVIDER_FAILED"]);
  });

  it("a failed voice lookup forces REVIEW", () => {
    const decision = decide(requestFor(T1 as Scenario), transfers, sourceMeta, true);
    expect(decision.verdict).toBe("REVIEW");
    expect(decision.reasons).toEqual(["PROVIDER_FAILED"]);
  });

  it("a disclosed link does not count toward BLOCK", () => {
    const request = requestFor(T1 as Scenario);
    const disclosed = {
      ...request,
      voices: request.voices.map((v) => (["persona_01", "persona_02", "persona_03"].includes(v.personaId) ? { ...v, disclosedByPostId: "post_persona_01" } : v)),
    };
    const decision = decide(disclosed, transfers, sourceMeta, false);
    expect(decision.verdict).toBe("ELIGIBLE");
    expect(decision.linkedPersonaIds).toHaveLength(5);
  });

  it("T1 and T2 read disjoint wallet sets", () => {
    const t1 = new Set(T1.input.voices.map((v) => v.wallet.toLowerCase()));
    expect(T2.input.voices.filter((v) => t1.has(v.wallet.toLowerCase()))).toEqual([]);
  });
});

describe("request validation", () => {
  it("refuses a scenario whose postBlock is not filled yet", () => {
    const request = { ...requestFor(T1 as Scenario) };
    expect(() => parseRunRequest({ ...request, voices: [{ ...request.voices[0], postBlock: null }] })).toThrow("postBlock");
  });

  it("refuses a postBlock after the pinned block", () => {
    const request = requestFor(T1 as Scenario);
    expect(() => parseRunRequest({ ...request, pinnedToBlock: 1 })).toThrow("after pinnedToBlock");
  });

  it("refuses a bad wallet address", () => {
    expect(() =>
      parseRunRequest({ runId: "r", symbol: "ETH", pinnedToBlock: 10, extractionFailed: false, knownExchanges: [], voices: [{ personaId: "persona_01", wallet: "0x12", verified: true, postBlock: 1, postedAtMs: 1, disclosedByPostId: null }] }),
    ).toThrow("wallet");
  });
});

describe("Etherscan rows", () => {
  it("builds the txlist URL with every parameter encoded", () => {
    const url = txlistUrl("https://api.etherscan.io/v2/api", 11155111, "0xabc", 10, 20, "key 1");
    expect(url).toBe("https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=0xabc&startblock=10&endblock=20&page=1&offset=10000&sort=asc&apikey=key%201");
  });

  it("starts the lookback 72 h (21600 blocks) before the post, never below zero", () => {
    expect(lookbackStart(100_000)).toBe(78_400);
    expect(lookbackStart(5)).toBe(0);
  });

  it("treats 'No transactions found' as empty and NOTOK as an error", () => {
    expect(parseTxlist({ status: "0", message: "No transactions found", result: [] })).toEqual({ ok: true, rows: [] });
    expect(parseTxlist({ status: "0", message: "NOTOK", result: "Invalid API Key" })).toEqual({ ok: false, error: "etherscan: NOTOK" });
  });

  it("drops failed calls and sorts by block and index", () => {
    const rows: TxlistRow[] = [
      { hash: "0x2", blockNumber: "5", transactionIndex: "1", from: "0xA", to: "0xB", value: "1", timeStamp: "1700000000", isError: "0" },
      { hash: "0x1", blockNumber: "5", transactionIndex: "0", from: "0xA", to: "0xB", value: "1", timeStamp: "1700000000", isError: "1" },
      { hash: "0x3", blockNumber: "4", transactionIndex: "9", from: "0xA", to: "0xB", value: "1", timeStamp: "1700000000", isError: "0" },
    ];
    expect(toTransfers(rows).map((t) => t.txHash)).toEqual(["0x3", "0x2"]);
  });

  it("maps no source meta to an empty record, so the policy reports missing meta", () => {
    expect(sourceMetaFrom([SOURCE], [undefined], [])).toEqual({});
  });
});

describe("verdict encoding", () => {
  it("encodes a Verdict that decodes back to the decision", () => {
    const request = requestFor(T1 as Scenario);
    const decision = decide(request, transfers, sourceMeta, false);
    const [verdict] = decodeAbiParameters(VERDICT_TUPLE, encodeVerdict(request, decision, request.voices.length));
    expect(verdict.paymentVerdict).toBe(2);
    expect(verdict.convergingCount).toBe(7);
    expect(verdict.linkedCount).toBe(5);
    expect(verdict.pinnedToBlock).toBe(12_100_000n);
    expect(verdict.personaIdHashes).toHaveLength(5);
  });
});
