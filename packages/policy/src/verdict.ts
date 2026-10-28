import { POLICY_CONFIG } from "./policy.config.ts";
import type { PaymentAnalysis } from "./payments.ts";
import type { ProviderOutcome } from "./failures.ts";
import type { PaymentVerdict, ReasonCode } from "./types.ts";

export interface LinkedVoice {
  personaId: string;
  disclosed: boolean;
}

export interface PaymentJudgement {
  verdict: PaymentVerdict;
  reasons: ReasonCode[];
}

export interface PaymentInputs {
  extractionFailed: boolean;
  provider: ProviderOutcome;
  analysis: PaymentAnalysis;
  linked: readonly LinkedVoice[];
  minVerifiedVoices: number;
}

/**
 * PRD §6.6 payment verdict. Failure checks run first, so a missing or inconsistent input
 * can never reach ELIGIBLE.
 *
 * BLOCK counts undisclosed linked voices, so a disclosed link does not count toward it
 * ("Disclosed links" paragraph). The table's "none of them has disclosure" wording is read
 * this way; see the plan's open questions.
 */
export function judgePayment(input: PaymentInputs): PaymentJudgement {
  const { analysis, linked } = input;

  if (input.extractionFailed) return review("EXTRACTION_FAILED");
  if (input.provider === "failed") return review("PROVIDER_FAILED");
  if (input.provider === "inconsistent") return review("PROVIDER_INCONSISTENT");
  if (analysis.missingSourceMeta.length > 0) return review("PROVIDER_FAILED");
  if (analysis.exchangeSources.length > 0) return review("EXCHANGE_SOURCE");
  if (analysis.verifiedVoiceCount < input.minVerifiedVoices) return review("INSUFFICIENT_VERIFIED_WALLETS");

  const undisclosed = linked.filter((v) => !v.disclosed).length;
  if (undisclosed >= POLICY_CONFIG.block.minUndisclosedLinkedVoices) {
    return { verdict: "BLOCK", reasons: ["THRESHOLD_MET"] };
  }
  if (linked.length >= POLICY_CONFIG.block.minUndisclosedLinkedVoices && undisclosed === 0) {
    return { verdict: "ELIGIBLE", reasons: ["DISCLOSED_CAMPAIGN"] };
  }
  return { verdict: "ELIGIBLE", reasons: ["NO_QUALIFYING_PATTERN"] };
}

function review(reason: ReasonCode): PaymentJudgement {
  return { verdict: "REVIEW", reasons: [reason] };
}
