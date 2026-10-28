// Real-run persistence wiring: reads the scenario files, the on-chain payments and the saved RYO fixture,
// then reads the verdict back from EchtVerdicts. Only the server touches the RPC and the file system here.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzePayments, type SourceMeta, type Transfer, type VoiceWallet } from "@echt/policy";
import { readVerdictOnChain } from "./chain-read.ts";
import type { PaymentFact, Persona, PersistOptions, Readback, RecordMarket, RunRecord } from "./run-record.ts";
import { persistRealRun } from "./run-record.ts";
import type { RunPayload } from "./run-payload.ts";

type Address = `0x${string}`;

const SCENARIO_FILES: Record<string, string> = { T1: "T1-coordinated.json", T2: "T2-unrelated.json" };
const PROPOSAL = { side: "long", sizeUsd: 400, stopPct: 0.08, symbol: "ETH", rationale: "Seven voices turned bullish on ETH inside one 6 h window" };
const LOOKBACK_BLOCKS = 21_600;
const MAX_SOURCE_LOOKUPS = 5; // matches the workflow
const ETHERSCAN = "https://api.etherscan.io/v2/api";

interface ScenarioJson {
  input: {
    campaignSource: string;
    voices: { personaId: string; wallet: string; handle: string }[];
    posts: { personaId: string; postedAt: string }[];
  };
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, "")) as T;

/**
 * How many txlist rows the campaign source has in the window the workflow reads: from the earliest voice
 * post minus the lookback, up to the pinned block. The workflow counts these rows into the evidence, so
 * the server must count the same rows, including transfers into the source itself.
 */
export async function countSourceTxs(source: string, startBlock: number, endBlock: number, apiKey: string): Promise<number> {
  const url = `${ETHERSCAN}?chainid=11155111&module=account&action=txlist&address=${source}&startblock=${startBlock}&endblock=${endBlock}&page=1&offset=10000&sort=asc&apikey=${encodeURIComponent(apiKey)}`;
  const body = (await (await fetch(url)).json()) as { status: string; message: string; result: unknown };
  if (body.status === "1" && Array.isArray(body.result)) return body.result.length;
  if (body.message === "No transactions found") return 0;
  throw new Error(`etherscan source count failed: ${body.message}`);
}

/** Which sources get a lookup, and their counts. Same rule as the workflow: only sources the policy finds. */
export async function sourceMetaFor(
  voices: VoiceWallet[],
  transfers: Transfer[],
  knownExchanges: readonly string[],
  windowStart: number,
  pinned: number,
  apiKey: string,
): Promise<Record<string, SourceMeta>> {
  const sources = analyzePayments(voices, transfers, {}).campaignSources;
  const meta: Record<string, SourceMeta> = {};
  for (const s of sources.slice(0, MAX_SOURCE_LOOKUPS)) {
    meta[s] = { txCount: await countSourceTxs(s, windowStart, pinned, apiKey), knownExchange: knownExchanges.includes(s) };
  }
  return meta;
}

export function makeRealPersistence(repoRoot: string) {
  const scenarioDir = join(repoRoot, "scenarios");
  const addressesPath = join(scenarioDir, "addresses.json");

  async function buildInputs(scenario: string, payload: RunPayload) {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) throw new Error("ETHERSCAN_API_KEY must be set to count the campaign source transactions");
    const addresses = await readJson<{ campaignSource: string; verdicts?: { address: string }; payments: Record<string, PaymentFact[]> }>(addressesPath);
    const payments: PaymentFact[] = Object.values(addresses.payments).flat();
    const wallets = new Map<string, string>();
    const personas: Record<string, Persona> = {};
    const payFacts = payments as (PaymentFact & { amountWei: string; blockNumber: number })[];
    for (const file of Object.values(SCENARIO_FILES)) {
      const s = await readJson<ScenarioJson>(join(scenarioDir, file));
      for (const v of s.input.voices) wallets.set(v.personaId, v.wallet.toLowerCase());
      for (const v of s.input.voices) {
        const post = s.input.posts.find((p) => p.personaId === v.personaId);
        personas[v.personaId] = { handle: v.handle, postedAt: post?.postedAt ?? "", provenance: "SYNTHETIC" };
      }
    }
    const source = addresses.campaignSource.toLowerCase() as Address;
    const transfers: Transfer[] = payFacts.map((p, i) => ({
      txHash: p.txHash as `0x${string}`,
      blockNumber: p.blockNumber,
      transactionIndex: i,
      from: source,
      to: (wallets.get(p.personaId) ?? "0x0") as `0x${string}`,
      amountWei: p.amountWei,
      timestamp: new Date(p.blockTimestamp * 1000).toISOString(),
      provenance: "TESTNET",
    }));
    const windowStart = Math.max(0, Math.min(...payload.voices.map((v) => v.postBlock)) - LOOKBACK_BLOCKS);
    const voices: VoiceWallet[] = payload.voices.map((v) => ({
      personaId: v.personaId,
      wallet: v.wallet,
      verified: v.verified,
      postedAtMs: v.postedAtMs,
      disclosedByPostId: v.disclosedByPostId,
    }));
    const sourceMeta = await sourceMetaFor(voices, transfers, payload.knownExchanges, windowStart, payload.pinnedToBlock, apiKey);
    const market = await readMarket(payload.symbol);
    return {
      transfers,
      sourceMeta,
      payments,
      personas,
      market,
      proposal: PROPOSAL,
      // An empty ECHT_VERDICTS_ADDRESS means "not set", so the recorded deploy address is used.
      address: (process.env.ECHT_VERDICTS_ADDRESS || addresses.verdicts?.address || "") as Address,
    };
  }

  async function readMarket(symbol: string): Promise<RecordMarket> {
    const file = `ryo-analyze_token-${symbol}-error-retry-28oct.json`;
    const body = await readJson<{ code: string; message: string; trace_id: string }>(join(scenarioDir, "fixtures", file));
    return { status: "UNAVAILABLE", tool: "analyze_token", symbol, code: body.code, message: body.message, traceId: body.trace_id, source: `scenarios/fixtures/${file}` };
  }

  return {
    async persist(scenario: string, payload: RunPayload, result: Record<string, unknown>) {
      const inputs = await buildInputs(scenario, payload);
      if (!inputs.address) throw new Error("no verdicts address: set ECHT_VERDICTS_ADDRESS or record the deploy in scenarios/addresses.json");
      const readVerdict = async (runId: string): Promise<Readback> => readVerdictOnChain(process.env.SEPOLIA_RPC_URL ?? "", inputs.address, runId);
      const writeRecord = async (name: string, record: RunRecord) => {
        await writeFile(join(scenarioDir, "runs", `${name}.json`), JSON.stringify(record, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2) + "\n");
      };
      const options: PersistOptions = { scenario, payload, result, buildInputs: inputs, readVerdict, writeRecord };
      return persistRealRun(options);
    },
  };
}
