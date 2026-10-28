// Builds the run records the dashboard reads: scenarios/runs/{T1,T2,T5,T6}.json.
//   tsx build-run-records.ts
// Every record is a DRY RUN. Pins are the test pins used for the 28 Oct dry simulation, and nothing is
// written on-chain. Real verdicts replace these files after the post times pass.
// Transfers are the six payments in scenarios/addresses.json, the same rows Etherscan returned on 28 Oct.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideRun, type RunInput, type Transfer } from "../packages/policy/src/index.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCEN = join(ROOT, "scenarios");
// Some fixtures were written by PowerShell with a byte-order mark, so strip it before parsing.
const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as T;

const DRY_PIN = 12_009_848; // head − 20 at the 28 Oct 05:20 UTC dry simulation
const TEST_POST_BLOCK = DRY_PIN - 1000;

interface Payment { personaId: string; txHash: string; blockNumber: number; blockTimestamp: number; amountWei: string }
const addresses = read<{ campaignSource: string; payments: Record<string, Payment[]> }>(join(SCEN, "addresses.json"));
const t1 = read<any>(join(SCEN, "T1-coordinated.json"));
const t2 = read<any>(join(SCEN, "T2-unrelated.json"));
const ryo = read<{ code: string; message: string; trace_id: string; details: { tool: string } }>(
  join(SCEN, "fixtures", "ryo-analyze_token-ETH-error-retry-28oct.json"),
);

const allPayments = [...addresses.payments.T1!, ...addresses.payments.T2!];
const source = addresses.campaignSource.toLowerCase();
const transfers: Transfer[] = allPayments.map((p, i) => {
  const w = [...t1.input.voices, ...t2.input.voices].find((v: any) => v.personaId === p.personaId).wallet.toLowerCase();
  return {
    txHash: p.txHash as `0x${string}`,
    blockNumber: p.blockNumber,
    transactionIndex: i,
    from: source as `0x${string}`,
    to: w as `0x${string}`,
    amountWei: p.amountWei,
    timestamp: new Date(p.blockTimestamp * 1000).toISOString(),
    provenance: "TESTNET",
  };
});

function build(scenario: any, paymentList: Payment[], opts: { id: string; label: string; providerFailed?: boolean; tamper?: boolean }) {
  const postByPersona = new Map<string, string>(scenario.input.posts.map((p: any) => [p.personaId, p.postedAt]));
  const voices = scenario.input.voices.map((v: any) => ({
    personaId: v.personaId,
    wallet: v.wallet.toLowerCase(),
    verified: v.attestation.method === "signed_challenge",
    postedAtMs: Date.parse(postByPersona.get(v.personaId)),
    disclosed: false,
  }));
  const input: RunInput = {
    runId: scenario.input.runId,
    symbol: "ETH",
    pinnedToBlock: DRY_PIN,
    extractionFailed: false,
    providerFailed: opts.providerFailed ?? false,
    voices,
    transfers,
    sourceMeta: { [source]: { txCount: allPayments.length, knownExchange: false } },
  };
  const decision = decideRun(input);

  // T6: the transfer list is edited after the fact. The stored evidence and hash stay as they were.
  const inputs = structuredClone(input) as RunInput;
  if (opts.tamper) inputs.transfers = inputs.transfers.map((t, i) => (i === 0 ? { ...t, amountWei: "2000000000000001" } : t));

  const paid = new Map(paymentList.map((p) => [p.personaId, p]));
  const record = {
    schemaVersion: 1,
    scenario: opts.id,
    label: opts.label,
    provenance: "SIMULATED",
    cre: "Chainlink CRE · local simulation",
    dryRun: true,
    verdictTx: null,
    runId: input.runId,
    pinnedToBlock: DRY_PIN,
    pinNote: "Test pin from the 28 Oct dry simulation. Real verdicts pin to head − 20.",
    policyVersion: "echt-policy@2",
    verdict: decision.verdict,
    reasons: decision.reasons,
    linkedPersonaIds: decision.linkedPersonaIds,
    marketGate: "UNAVAILABLE",
    finalAction: "NO_POSITION",
    proposal: { side: "long", sizeUsd: 400, stopPct: 0.08, symbol: "ETH", rationale: "Seven voices turned bullish on ETH inside one 6 h window" },
    voices: scenario.input.voices.map((v: any) => {
      const pay = paid.get(v.personaId);
      const postedAtMs = Date.parse(postByPersona.get(v.personaId));
      return {
        personaId: v.personaId,
        handle: v.handle,
        wallet: v.wallet,
        verified: v.attestation.method === "signed_challenge",
        postedAt: postByPersona.get(v.personaId),
        postBlock: TEST_POST_BLOCK,
        gapHours: pay ? Number(((postedAtMs - pay.blockTimestamp * 1000) / 3_600_000).toFixed(2)) : null,
        paymentTx: pay ? pay.txHash : null,
        linked: decision.linkedPersonaIds.includes(v.personaId),
        disclosed: false,
        provenance: "SYNTHETIC",
      };
    }),
    market: {
      status: "UNAVAILABLE",
      tool: "analyze_token",
      symbol: "ETH",
      code: ryo.code,
      message: ryo.message,
      traceId: ryo.trace_id,
      source: "scenarios/fixtures/ryo-analyze_token-ETH-error-retry-28oct.json",
    },
    provider: opts.providerFailed ? { status: "failed", detail: "injected fault (T5): one voice lookup returned no answer" } : { status: "ok" },
    inputs,
    evidence: decision.evidence,
    evidenceHash: decision.evidenceHash,
    sectionHashes: decision.sectionHashes,
  };
  return record;
}

mkdirSync(join(SCEN, "runs"), { recursive: true });
const records = {
  T1: build(t1, addresses.payments.T1!, { id: "T1", label: "SIMULATED · dry run, nothing written on-chain" }),
  T2: build(t2, addresses.payments.T2!, { id: "T2", label: "SIMULATED · dry run, nothing written on-chain" }),
  T5: build(t1, addresses.payments.T1!, { id: "T5", label: "SIMULATED · injected provider fault (T5), nothing written on-chain", providerFailed: true }),
  T6: build(t1, addresses.payments.T1!, { id: "T6", label: "SIMULATED · tampered snapshot (T6), nothing written on-chain", tamper: true }),
};
for (const [name, r] of Object.entries(records)) {
  writeFileSync(join(SCEN, "runs", `${name}.json`), JSON.stringify(r, null, 2) + "\n");
  console.log(`${name}: ${r.verdict} ${r.reasons.join(",")} linked=${r.linkedPersonaIds.length} hash=${r.evidenceHash.slice(0, 12)}…`);
}
