// Thresholds for echt-policy@2 (PRD §6.6, DECISIONS.md). Any change here bumps policyVersion.

export const POLICY_CONFIG = {
  policyVersion: "echt-policy@2",
  convergence: { minVoices: 5, windowHours: 6 },
  lookbackHours: 72,
  /** Native Sepolia ETH, in wei: 0.001 ETH. */
  minQualifyingWei: 1_000_000_000_000_000n,
  campaignSource: {
    /** A sender must have paid this many distinct converging voices. */
    minVoices: 2,
    /** Above this many transactions a sender is treated as a hot wallet (REVIEW). */
    maxTxCount: 10_000,
  },
  block: { minUndisclosedLinkedVoices: 3 },
  minVerifiedVoices: 3,
  practice: { maxPositionUsd: 400, stopPct: 0.08, riskBudgetUsd: 32 },
} as const;
