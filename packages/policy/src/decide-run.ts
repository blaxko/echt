// One payment decision, end to end: voices + transfers + source metadata in, verdict and evidence out.
// Pure. The CRE workflow and the browser Replay both call this, so they cannot disagree.

import { canonicalJson, type JsonValue } from "./canonical.ts";
import { hashCanonical } from "./hash.ts";
import type { ProviderOutcome } from "./failures.ts";
import { analyzePayments, type PaymentAnalysis, type SourceMeta, type VoiceWallet } from "./payments.ts";
import { POLICY_VERSION } from "./version.ts";
import { judgePayment } from "./verdict.ts";
import { POLICY_CONFIG } from "./policy.config.ts";
import type { ReasonCode, PaymentVerdict, Transfer } from "./types.ts";

export interface RunVoiceInput {
  personaId: string;
  wallet: string;
  verified: boolean;
  postedAtMs: number;
  disclosed: boolean;
}

export interface RunInput {
  runId: string;
  symbol: string;
  pinnedToBlock: number;
  extractionFailed: boolean;
  providerFailed: boolean;
  voices: readonly RunVoiceInput[];
  transfers: readonly Transfer[];
  sourceMeta: Readonly<Record<string, SourceMeta>>;
}

export interface RunDecision {
  verdict: PaymentVerdict;
  reasons: ReasonCode[];
  linkedPersonaIds: string[];
  analysis: PaymentAnalysis;
  evidence: Record<string, JsonValue>;
  evidenceHash: `0x${string}`;
  sectionHashes: Record<string, `0x${string}`>;
}

/** The sections of the evidence object. Replay names the first section whose hash changed. */
export const EVIDENCE_SECTIONS = ["voices", "campaign", "transfers", "verdict"] as const;

function sectionsOf(evidence: Record<string, JsonValue>): Record<string, JsonValue> {
  return {
    voices: evidence.voices as JsonValue,
    campaign: { campaignSources: evidence.campaignSources as JsonValue, sourceMeta: evidence.sourceMeta as JsonValue },
    transfers: evidence.transfers as JsonValue,
    verdict: { verdict: evidence.verdict as JsonValue, reasons: evidence.reasons as JsonValue, linkedPersonaIds: evidence.linkedPersonaIds as JsonValue },
  };
}

export function decideRun(input: RunInput): RunDecision {
  const voiceWallets: VoiceWallet[] = input.voices.map((v) => ({
    personaId: v.personaId,
    wallet: v.wallet,
    verified: v.verified,
    postedAtMs: v.postedAtMs,
    disclosedByPostId: v.disclosed ? "disclosed" : null,
  }));
  const analysis = analyzePayments(voiceWallets, input.transfers, input.sourceMeta);
  const provider: ProviderOutcome = input.providerFailed ? "failed" : "ok";
  const linked = analysis.linkedPersonaIds.map((personaId) => ({
    personaId,
    disclosed: input.voices.some((v) => v.personaId === personaId && v.disclosed),
  }));
  const judged = judgePayment({
    extractionFailed: input.extractionFailed,
    provider,
    analysis,
    linked,
    minVerifiedVoices: POLICY_CONFIG.minVerifiedVoices,
  });

  const evidence: Record<string, JsonValue> = {
    runId: input.runId,
    symbol: input.symbol,
    pinnedToBlock: input.pinnedToBlock,
    policyVersion: POLICY_VERSION,
    voices: input.voices.map((v) => ({
      personaId: v.personaId,
      wallet: v.wallet.toLowerCase(),
      verified: v.verified,
      postedAtMs: v.postedAtMs,
      disclosed: v.disclosed,
    })),
    campaignSources: analysis.campaignSources,
    sourceMeta: Object.fromEntries(
      Object.entries(input.sourceMeta).map(([k, m]) => [k, { txCount: m.txCount, knownExchange: m.knownExchange }]),
    ),
    // Qualifying transfers carry their amounts, so editing an amount changes the hash.
    transfers: analysis.qualifying
      .map((q) => ({ txHash: q.txHash, from: q.from, personaId: q.personaId, amountWei: q.amountWei.toString() }))
      .sort((a, b) => (a.txHash < b.txHash ? -1 : a.txHash > b.txHash ? 1 : 0)),
    linkedPersonaIds: analysis.linkedPersonaIds,
    verdict: judged.verdict,
    reasons: judged.reasons,
  } as Record<string, JsonValue>;

  const sections = sectionsOf(evidence);
  return {
    verdict: judged.verdict,
    reasons: judged.reasons,
    linkedPersonaIds: analysis.linkedPersonaIds,
    analysis,
    evidence,
    evidenceHash: hashCanonical(evidence),
    sectionHashes: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, hashCanonical(v)])),
  };
}

/** Byte-exact canonical snapshot of the evidence object (PRD FR8.2). */
export function evidenceBytes(evidence: Record<string, JsonValue>): string {
  return canonicalJson(evidence);
}
