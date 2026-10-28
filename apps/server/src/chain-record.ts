// Real-run persistence wiring: reads the scenario files, the on-chain payments and the saved RYO fixture,
// then reads the verdict back from EchtVerdicts. Only the server touches the RPC and the file system here.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readVerdictOnChain } from "../../../scripts/chain-read.ts";

type Address = `0x${string}`;
import type { Transfer } from "@echt/policy";
import type { PaymentFact, Persona, PersistOptions, Readback, RecordMarket, RunRecord } from "./run-record.ts";
import { persistRealRun } from "./run-record.ts";
import type { RunPayload } from "./run-payload.ts";



const SCENARIO_FILES: Record<string, string> = { T1: "T1-coordinated.json", T2: "T2-unrelated.json" };
const PROPOSAL = { side: "long", sizeUsd: 400, stopPct: 0.08, symbol: "ETH", rationale: "Seven voices turned bullish on ETH inside one 6 h window" };

interface ScenarioJson {
  input: {
    campaignSource: string;
    voices: { personaId: string; wallet: string; handle: string }[];
    posts: { personaId: string; postedAt: string }[];
  };
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse((await readFile(path, "utf8")).replace(/^﻿/, "")) as T;

export function makeRealPersistence(repoRoot: string) {
  const scenarioDir = join(repoRoot, "scenarios");
  const addressesPath = join(scenarioDir, "addresses.json");

  async function buildInputs(scenario: string, payload: RunPayload) {
    const addresses = await readJson<{ campaignSource: string; verdicts?: { address: string }; payments: Record<string, PaymentFact[] & { wallet?: string }> }>(addressesPath);
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
    const market = await readMarket(payload.symbol);
    return {
      transfers,
      sourceMeta: { [source]: { txCount: payFacts.length, knownExchange: false } },
      payments,
      personas,
      market,
      proposal: PROPOSAL,
      address: (process.env.ECHT_VERDICTS_ADDRESS ?? addresses.verdicts?.address) as Address,
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
      const readVerdict = async (runId: string): Promise<Readback> => readVerdictOnChain(process.env.SEPOLIA_RPC_URL ?? "", inputs.address, runId);
      const writeRecord = async (name: string, record: RunRecord) => {
        await writeFile(join(scenarioDir, "runs", `${name}.json`), JSON.stringify(record, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2) + "\n");
      };
      const options: PersistOptions = { scenario, payload, result, buildInputs: inputs, readVerdict, writeRecord };
      return persistRealRun(options);
    },
  };
}
