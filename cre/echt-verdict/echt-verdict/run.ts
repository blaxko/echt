// Pure helpers for one verdict run: request validation, Etherscan rows to policy transfers, the
// payment decision (packages/policy), and the EchtVerdicts report encoding. No network, no clock.
// The workflow entry point (main.ts) does the I/O and calls these.

import {
  analyzePayments,
  hashCanonical,
  judgePayment,
  POLICY_CONFIG,
  POLICY_VERSION,
  type PaymentAnalysis,
  type ProviderOutcome,
  type SourceMeta,
  type Transfer,
  type VoiceWallet,
} from "../../../packages/policy/src/index";
import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

// Blocks behind the post that the transfer lookup starts from. 72 h at about 12 s per Sepolia block.
// The policy still applies the exact 72 h rule by timestamp.
export const LOOKBACK_BLOCKS = 21_600;
// Etherscan calls per execution: one per voice, plus one per campaign source. CRE allows 15; we stay ≤ 12.
export const MAX_VOICES = 7;
export const MAX_SOURCE_LOOKUPS = 5;

export interface RunVoice {
  personaId: string;
  wallet: string;
  verified: boolean;
  postBlock: number;
  postedAtMs: number;
  disclosedByPostId: string | null;
}

export interface RunRequest {
  runId: string;
  symbol: string;
  pinnedToBlock: number;
  extractionFailed: boolean;
  knownExchanges: string[];
  voices: RunVoice[];
}

export interface TxlistRow {
  hash: string;
  blockNumber: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
}

export type VoiceFetch = { ok: true; transfers: Transfer[] } | { ok: false; error: string };
export type SourceFetch = { ok: true; txCount: number } | { ok: false; error: string };

export const VERDICT_CODE = { ELIGIBLE: 0, REVIEW: 1, BLOCK: 2 } as const;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const PERSONA = /^persona_\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uint(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${name} must be a non-negative integer`);
  return value as number;
}

function parseVoice(value: unknown): RunVoice {
  if (!isRecord(value)) throw new Error("each voice must be an object");
  const { personaId, wallet, verified, postBlock, postedAtMs, disclosedByPostId } = value;
  if (typeof personaId !== "string" || !PERSONA.test(personaId)) throw new Error("personaId must look like persona_NN");
  if (typeof wallet !== "string" || !ADDRESS.test(wallet)) throw new Error(`${personaId}: wallet must be a 0x address`);
  if (typeof verified !== "boolean") throw new Error(`${personaId}: verified must be a boolean`);
  if (disclosedByPostId !== null && typeof disclosedByPostId !== "string") {
    throw new Error(`${personaId}: disclosedByPostId must be a string or null`);
  }
  return {
    personaId,
    wallet: wallet.toLowerCase(),
    verified,
    postBlock: uint(postBlock, `${personaId}.postBlock`),
    postedAtMs: uint(postedAtMs, `${personaId}.postedAtMs`),
    disclosedByPostId,
  };
}

/** Validates the HTTP payload. Throws with a message that names the bad field. */
export function parseRunRequest(input: unknown): RunRequest {
  if (!isRecord(input)) throw new Error("run request must be a JSON object");
  const { runId, symbol, pinnedToBlock, extractionFailed, knownExchanges, voices } = input;
  if (typeof runId !== "string" || runId.length === 0) throw new Error("runId must be a non-empty string");
  if (typeof symbol !== "string" || symbol.length === 0) throw new Error("symbol must be a non-empty string");
  if (typeof extractionFailed !== "boolean") throw new Error("extractionFailed must be a boolean");
  if (!Array.isArray(knownExchanges) || !knownExchanges.every((x) => typeof x === "string" && ADDRESS.test(x))) {
    throw new Error("knownExchanges must be a list of 0x addresses");
  }
  if (!Array.isArray(voices) || voices.length === 0 || voices.length > MAX_VOICES) {
    throw new Error(`voices must hold 1 to ${MAX_VOICES} entries`);
  }
  const pinned = uint(pinnedToBlock, "pinnedToBlock");
  const parsed = voices.map(parseVoice);
  for (const v of parsed) {
    if (v.postBlock > pinned) throw new Error(`${v.personaId}: postBlock is after pinnedToBlock`);
  }
  return {
    runId,
    symbol,
    pinnedToBlock: pinned,
    extractionFailed,
    knownExchanges: knownExchanges.map((x) => x.toLowerCase()),
    voices: parsed,
  };
}

/** First block of a voice's lookback. Never negative. */
export function lookbackStart(postBlock: number): number {
  return Math.max(0, postBlock - LOOKBACK_BLOCKS);
}

/** Etherscan V2 txlist URL. Built by hand because URLSearchParams is not guaranteed in the CRE runtime. */
export function txlistUrl(
  baseUrl: string,
  chainId: number,
  address: string,
  startBlock: number,
  endBlock: number,
  apiKey: string,
): string {
  const params: [string, string][] = [
    ["chainid", String(chainId)],
    ["module", "account"],
    ["action", "txlist"],
    ["address", address],
    ["startblock", String(startBlock)],
    ["endblock", String(endBlock)],
    ["page", "1"],
    ["offset", "10000"],
    ["sort", "asc"],
    ["apikey", apiKey],
  ];
  return `${baseUrl}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** Returns the rows of a txlist answer. "No transactions found" is an empty answer; NOTOK is an error. */
export function parseTxlist(body: unknown): { ok: true; rows: TxlistRow[] } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "etherscan answer is not an object" };
  if (body.status === "1" && Array.isArray(body.result)) return { ok: true, rows: body.result as TxlistRow[] };
  if (body.message === "No transactions found") return { ok: true, rows: [] };
  return { ok: false, error: `etherscan: ${String(body.message)}` };
}

/**
 * Native transfers only, failed calls dropped, sorted by (block, index). Sorting makes two nodes
 * that read the same chain produce byte-identical output, which consensus needs.
 */
export function toTransfers(rows: readonly TxlistRow[]): Transfer[] {
  return rows
    .filter((r) => r.isError === "0" && r.to !== "")
    .map((r) => ({
      txHash: r.hash as Hex,
      blockNumber: Number(r.blockNumber),
      transactionIndex: Number(r.transactionIndex),
      from: r.from.toLowerCase() as Hex,
      to: r.to.toLowerCase() as Hex,
      amountWei: r.value,
      timestamp: new Date(Number(r.timeStamp) * 1000).toISOString(),
      provenance: "TESTNET" as const,
    }))
    .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
}

export function toVoiceWallets(voices: readonly RunVoice[]): VoiceWallet[] {
  return voices.map((v) => ({
    personaId: v.personaId,
    wallet: v.wallet,
    verified: v.verified,
    postedAtMs: v.postedAtMs,
    disclosedByPostId: v.disclosedByPostId,
  }));
}

/** Source metadata for the campaign sources we could look up. A source with no entry makes the policy return REVIEW. */
export function sourceMetaFrom(
  sources: readonly string[],
  fetches: readonly (SourceFetch | undefined)[],
  knownExchanges: readonly string[],
): Record<string, SourceMeta> {
  const meta: Record<string, SourceMeta> = {};
  sources.forEach((source, i) => {
    const fetch = fetches[i];
    if (fetch?.ok) meta[source] = { txCount: fetch.txCount, knownExchange: knownExchanges.includes(source) };
  });
  return meta;
}

export interface Decision {
  verdict: "BLOCK" | "REVIEW" | "ELIGIBLE";
  reasons: string[];
  analysis: PaymentAnalysis;
  linkedPersonaIds: string[];
  evidenceHash: Hex;
}

/** The payment decision for one run. Provider failure in any voice lookup forces REVIEW through the policy. */
export function decide(
  request: RunRequest,
  transfers: readonly Transfer[],
  meta: Readonly<Record<string, SourceMeta>>,
  providerFailed: boolean,
): Decision {
  const analysis = analyzePayments(toVoiceWallets(request.voices), transfers, meta);
  const provider: ProviderOutcome = providerFailed ? "failed" : "ok";
  const linked = analysis.linkedPersonaIds.map((personaId) => ({
    personaId,
    disclosed: request.voices.some((v) => v.personaId === personaId && v.disclosedByPostId !== null),
  }));
  const judged = judgePayment({
    extractionFailed: request.extractionFailed,
    provider,
    analysis,
    linked,
    minVerifiedVoices: POLICY_CONFIG.minVerifiedVoices,
  });
  const evidence = {
    runId: request.runId,
    symbol: request.symbol,
    pinnedToBlock: request.pinnedToBlock,
    policyVersion: POLICY_VERSION,
    voices: request.voices.map((v) => ({ personaId: v.personaId, wallet: v.wallet, verified: v.verified, postedAtMs: v.postedAtMs })),
    campaignSources: analysis.campaignSources,
    qualifyingTxHashes: analysis.qualifying.map((q) => q.txHash).sort(),
    linkedPersonaIds: analysis.linkedPersonaIds,
    verdict: judged.verdict,
    reasons: judged.reasons,
  };
  return {
    verdict: judged.verdict,
    reasons: judged.reasons,
    analysis,
    linkedPersonaIds: analysis.linkedPersonaIds,
    evidenceHash: hashCanonical(evidence),
  };
}

const VERDICT_TUPLE = [
  {
    type: "tuple",
    components: [
      { name: "runId", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "tokenSymbolHash", type: "bytes32" },
      { name: "pinnedToBlock", type: "uint64" },
      { name: "paymentVerdict", type: "uint8" },
      { name: "convergingCount", type: "uint8" },
      { name: "linkedCount", type: "uint8" },
      { name: "policyVersion", type: "bytes32" },
      { name: "personaIdHashes", type: "bytes32[]" },
    ],
  },
] as const;

/** ABI-encodes the Verdict struct that EchtVerdicts.onReport decodes. Persona IDs are hashed, never sent in clear. */
export function encodeVerdict(request: RunRequest, decision: Decision, convergingCount: number): Hex {
  return encodeAbiParameters(VERDICT_TUPLE, [
    {
      runId: keccak256(stringToHex(request.runId)),
      evidenceHash: decision.evidenceHash,
      tokenSymbolHash: keccak256(stringToHex(request.symbol)),
      pinnedToBlock: BigInt(request.pinnedToBlock),
      paymentVerdict: VERDICT_CODE[decision.verdict],
      convergingCount,
      linkedCount: decision.linkedPersonaIds.length,
      policyVersion: keccak256(stringToHex(POLICY_VERSION)),
      personaIdHashes: decision.linkedPersonaIds.map((id) => keccak256(stringToHex(id))),
    },
  ]);
}

export { VERDICT_TUPLE };

