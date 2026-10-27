import { POLICY_CONFIG } from "./policy.config.ts";

export interface RiskLimits {
  maxPositionUsd: number;
  stopPct: number;
  riskBudgetUsd: number;
}

export interface Proposal {
  side: "long";
  sizeUsd: number;
  stopPct: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = POLICY_CONFIG.practice;

/** PRD §6.3: min(maxPositionUsd, riskBudgetUsd / stopPct), stop at stopPct. */
export function proposePosition(limits: RiskLimits = DEFAULT_RISK_LIMITS): Proposal {
  return {
    side: "long",
    sizeUsd: Math.min(limits.maxPositionUsd, limits.riskBudgetUsd / limits.stopPct),
    stopPct: limits.stopPct,
  };
}

/** False when the limits are unusable or the proposal breaks them. Only then is RISK_LIMIT raised. */
export function withinRiskLimits(proposal: Proposal, limits: RiskLimits): boolean {
  if (!(limits.stopPct > 0 && limits.stopPct < 1)) return false;
  if (!(proposal.sizeUsd > 0)) return false;
  return proposal.sizeUsd <= limits.maxPositionUsd && proposal.sizeUsd * proposal.stopPct <= limits.riskBudgetUsd + 1e-9;
}
