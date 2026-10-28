// Builds the stored run record the dashboard reads (scenarios/runs/<scenario>.json), and persists a real run
// only after the server has independently recomputed the evidence hash and read the verdict back from the chain.

import { decideRun, type RunInput, type SourceMeta, type Transfer } from "@echt/policy";
import type { RunPayload } from "./run-payload.ts";

export interface PaymentFact {
  personaId: string;
  txHash: string;
  blockTimestamp: number;
}

export interface Persona {
  handle: string;
  postedAt: string;
  provenance: string;
}

export interface RecordMarket {
  status: string;
  tool: string;
  symbol: string;
  code: string;
  message: string;
  traceId: string;
  source: string;
}

export interface BuildOptions {
  scenario: string;
  label: string;
  cre: string;
  dryRun: boolean;
  payload: RunPayload;
  transfers: Transfer[];
  sourceMeta: Record<string, SourceMeta>;
  providerFailed: boolean;
  payments: PaymentFact[];
  personas: Record<string, Persona>;
  market: RecordMarket;
  verdictTx: string | null;
  pinNote: string;
  proposal: { side: string; sizeUsd: number; stopPct: number; symbol: string; rationale: string };
}

export type RunRecord = Record<string, unknown> & { evidenceHash: string; verdict: string; sectionHashes: Record<string, string> };

export function runInputOf(payload: RunPayload, transfers: Transfer[], sourceMeta: Record<string, SourceMeta>, providerFailed: boolean): RunInput {
  return {
    runId: payload.runId,
    symbol: payload.symbol,
    pinnedToBlock: payload.pinnedToBlock,
    extractionFailed: payload.extractionFailed,
    providerFailed,
    voices: payload.voices.map((v) => ({
      personaId: v.personaId,
      wallet: v.wallet,
      verified: v.verified,
      postedAtMs: v.postedAtMs,
      disclosed: v.disclosedByPostId !== null,
    })),
    transfers,
    sourceMeta,
  };
}

export function buildRecord(opts: BuildOptions): RunRecord {
  const input = runInputOf(opts.payload, opts.transfers, opts.sourceMeta, opts.providerFailed);
  const decision = decideRun(input);
  const paid = new Map(opts.payments.map((p) => [p.personaId, p]));
  return {
    schemaVersion: 1,
    scenario: opts.scenario,
    label: opts.label,
    provenance: opts.dryRun ? "SIMULATED" : "TESTNET",
    cre: opts.cre,
    dryRun: opts.dryRun,
    verdictTx: opts.verdictTx,
    runId: opts.payload.runId,
    pinnedToBlock: opts.payload.pinnedToBlock,
    pinNote: opts.pinNote,
    policyVersion: "echt-policy@2",
    verdict: decision.verdict,
    reasons: decision.reasons,
    linkedPersonaIds: decision.linkedPersonaIds,
    marketGate: "UNAVAILABLE",
    finalAction: "NO_POSITION",
    proposal: opts.proposal,
    voices: opts.payload.voices.map((v) => {
      const pay = paid.get(v.personaId);
      const persona = opts.personas[v.personaId];
      return {
        personaId: v.personaId,
        handle: persona?.handle ?? v.personaId,
        wallet: v.wallet,
        verified: v.verified,
        postedAt: persona?.postedAt ?? new Date(v.postedAtMs).toISOString(),
        postBlock: v.postBlock,
        gapHours: pay ? Number(((v.postedAtMs - pay.blockTimestamp * 1000) / 3_600_000).toFixed(2)) : null,
        paymentTx: pay ? pay.txHash : null,
        linked: decision.linkedPersonaIds.includes(v.personaId),
        disclosed: v.disclosedByPostId !== null,
        provenance: persona?.provenance ?? "SYNTHETIC",
      };
    }),
    market: opts.market,
    provider: opts.providerFailed ? { status: "failed", detail: "a voice lookup failed" } : { status: "ok" },
    inputs: input,
    evidence: decision.evidence,
    evidenceHash: decision.evidenceHash,
    sectionHashes: decision.sectionHashes,
  };
}

export interface Readback {
  evidenceHash: string;
  paymentVerdict: number;
  pinnedToBlock: number;
  linkedCount: number;
}

export const VERDICT_CODE: Record<string, number> = { ELIGIBLE: 0, REVIEW: 1, BLOCK: 2 };

export interface PersistOptions {
  scenario: string;
  payload: RunPayload;
  result: Record<string, unknown>;
  buildInputs: { transfers: Transfer[]; sourceMeta: Record<string, SourceMeta>; payments: PaymentFact[]; personas: Record<string, Persona>; market: RecordMarket; proposal: BuildOptions["proposal"] };
  readVerdict: (runId: string) => Promise<Readback>;
  writeRecord: (scenario: string, record: RunRecord) => Promise<void>;
}

export type PersistOutcome = { written: true; record: RunRecord } | { written: false; reason: string };

/**
 * Writes a real run only if three things agree: the CRE result, the server's own recomputation of the
 * evidence hash, and the getVerdict read-back from EchtVerdicts. Any disagreement leaves the old record alone.
 */
export async function persistRealRun(opts: PersistOptions): Promise<PersistOutcome> {
  const { result, payload } = opts;
  const txHash = typeof result.txHash === "string" ? result.txHash : null;
  if (!txHash) return { written: false, reason: "the CRE result has no transaction hash, so nothing was written on-chain" };

  const record = buildRecord({
    scenario: opts.scenario,
    label: "TESTNET · CRE local simulation",
    cre: "Chainlink CRE · local simulation",
    dryRun: false,
    payload,
    transfers: opts.buildInputs.transfers,
    sourceMeta: opts.buildInputs.sourceMeta,
    providerFailed: false,
    payments: opts.buildInputs.payments,
    personas: opts.buildInputs.personas,
    market: opts.buildInputs.market,
    verdictTx: txHash,
    pinNote: "pinned to head − 20 when the run started",
    proposal: opts.buildInputs.proposal,
  });

  if (record.evidenceHash !== result.evidenceHash) {
    return { written: false, reason: `evidence hash mismatch: server ${record.evidenceHash}, CRE ${String(result.evidenceHash)}` };
  }
  if (record.verdict !== result.verdict) return { written: false, reason: `verdict mismatch: server ${String(record.verdict)}, CRE ${String(result.verdict)}` };

  const chain = await opts.readVerdict(payload.runId);
  if (chain.evidenceHash !== record.evidenceHash) return { written: false, reason: "getVerdict evidence hash does not match" };
  if (chain.paymentVerdict !== VERDICT_CODE[String(record.verdict)]) return { written: false, reason: "getVerdict verdict does not match" };
  if (chain.pinnedToBlock !== payload.pinnedToBlock) return { written: false, reason: "getVerdict pinned block does not match" };
  if (chain.linkedCount !== (record.linkedPersonaIds as string[]).length) return { written: false, reason: "getVerdict linked count does not match" };

  const stored = { ...record, readback: { source: "EchtVerdicts.getVerdict", ...chain } };
  await opts.writeRecord(opts.scenario, stored);
  return { written: true, record: stored };
}
