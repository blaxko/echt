import { detectConvergence } from "./convergence.ts";
import type { ProviderOutcome } from "./failures.ts";
import { marketGate, type MarketFacts } from "./market.ts";
import { analyzePayments, type Exclusion, type SourceMeta, type VoiceWallet } from "./payments.ts";
import { DEFAULT_RISK_LIMITS, proposePosition, withinRiskLimits, type Proposal, type RiskLimits } from "./proposal.ts";
import { POLICY_CONFIG } from "./policy.config.ts";
import type { Extraction, FinalAction, MarketGate, Persona, PaymentVerdict, Post, ReasonCode, Transfer } from "./types.ts";
import { judgePayment, type LinkedVoice } from "./verdict.ts";

export interface EvaluationInput {
  runId: string;
  posts: readonly Post[];
  extractions: readonly Extraction[];
  personas: readonly Persona[];
  transfers: readonly Transfer[];
  /** Keyed by lowercase address. A campaign source with no entry is treated as missing data. */
  sourceMeta: Readonly<Record<string, SourceMeta>>;
  provider: ProviderOutcome;
  market: MarketFacts;
  riskLimits?: RiskLimits;
}

export interface Decided {
  status: "DECIDED";
  policyVersion: typeof POLICY_CONFIG.policyVersion;
  convergence: { token: string; voices: string[]; windowStart: string; windowEnd: string };
  campaignSources: string[];
  linkedVoices: { personaId: string; transfers: string[]; disclosed: boolean; disclosedByPostId: string | null }[];
  excludedTransfers: Exclusion[];
  extractionFailedPostIds: string[];
  paymentVerdict: PaymentVerdict;
  marketGate: MarketGate;
  finalAction: FinalAction;
  reasonCodes: ReasonCode[];
  proposal: Proposal;
}

export type EvaluationResult = { status: "IDLE" } | Decided;

/** 0 = least severe. A failure must never score lower than the evidence it hides. */
export function severity(verdict: PaymentVerdict): number {
  switch (verdict) {
    case "ELIGIBLE":
      return 0;
    case "REVIEW":
      return 1;
    case "BLOCK":
      return 2;
  }
}

/**
 * Runs convergence, payment analysis, the market gate and the final-action combiner.
 * Pure: no I/O, no clock reads (all times come from the input).
 */
export function evaluate(input: EvaluationInput): EvaluationResult {
  const convergence = detectConvergence(input.posts, input.extractions);
  if (convergence.status === "IDLE") return { status: "IDLE" };

  const personaById = new Map(input.personas.map((p) => [p.id, p]));
  const extractionByPost = new Map(input.extractions.map((e) => [e.postId, e]));
  const disclosingPosts = input.posts
    .filter((p) => extractionByPost.get(p.id)?.disclosureDetected === true && extractionByPost.get(p.id)?.status === "ok")
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt) || a.id.localeCompare(b.id));

  const voices: VoiceWallet[] = convergence.voices.map((v) => {
    const persona = personaById.get(v.personaId);
    if (!persona) throw new Error(`no persona record for ${v.personaId}`);
    const disclosure = disclosingPosts.find((p) => p.personaId === v.personaId);
    return {
      personaId: v.personaId,
      wallet: persona.wallet.toLowerCase(),
      verified: persona.attestation.method === "signed_challenge",
      postedAtMs: v.postedAtMs,
      disclosedByPostId: disclosure?.id ?? null,
    };
  });
  const voiceById = new Map(voices.map((v) => [v.personaId, v]));

  const analysis = analyzePayments(voices, input.transfers, input.sourceMeta);
  const linked: LinkedVoice[] = analysis.linkedPersonaIds.map((personaId) => ({
    personaId,
    disclosed: voiceById.get(personaId)?.disclosedByPostId !== null,
  }));

  const judgement = judgePayment({
    extractionFailed: convergence.extractionFailedPostIds.length > 0,
    provider: input.provider,
    analysis,
    linked,
    minVerifiedVoices: POLICY_CONFIG.minVerifiedVoices,
  });

  const limits = input.riskLimits ?? DEFAULT_RISK_LIMITS;
  const proposal = proposePosition(limits);
  const gate = marketGate(input.market);
  const { finalAction, gateReason } = combine(judgement.verdict, gate, withinRiskLimits(proposal, limits));

  return {
    status: "DECIDED",
    policyVersion: POLICY_CONFIG.policyVersion,
    convergence: {
      token: convergence.token,
      voices: convergence.voices.map((v) => v.personaId),
      windowStart: new Date(convergence.windowStartMs).toISOString(),
      windowEnd: new Date(convergence.windowEndMs).toISOString(),
    },
    campaignSources: analysis.campaignSources,
    linkedVoices: analysis.linkedPersonaIds.map((personaId) => ({
      personaId,
      transfers: analysis.qualifying
        .filter((q) => q.personaId === personaId)
        .map((q) => q.txHash)
        .sort(),
      disclosed: voiceById.get(personaId)?.disclosedByPostId !== null,
      disclosedByPostId: voiceById.get(personaId)?.disclosedByPostId ?? null,
    })),
    excludedTransfers: analysis.exclusions,
    extractionFailedPostIds: convergence.extractionFailedPostIds,
    paymentVerdict: judgement.verdict,
    marketGate: gate,
    finalAction,
    reasonCodes: gateReason ? [...judgement.reasons, gateReason] : judgement.reasons,
    proposal,
  };
}

/** Payment first: a non-ELIGIBLE verdict is the reason shown, whatever the market says. */
function combine(
  verdict: PaymentVerdict,
  gate: MarketGate,
  riskOk: boolean,
): { finalAction: FinalAction; gateReason: ReasonCode | null } {
  if (verdict !== "ELIGIBLE") return { finalAction: "NO_POSITION", gateReason: null };
  if (!riskOk) return { finalAction: "NO_POSITION", gateReason: "RISK_LIMIT" };
  if (gate === "FAIL") return { finalAction: "NO_POSITION", gateReason: "MARKET_FAIL" };
  if (gate === "UNAVAILABLE") return { finalAction: "NO_POSITION", gateReason: "MARKET_UNAVAILABLE" };
  return { finalAction: "OPEN_PRACTICE_POSITION", gateReason: null };
}
