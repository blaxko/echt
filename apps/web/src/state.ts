import type { RunRecord } from "./api.ts";

export type FinalState = "IDLE" | "BLOCK" | "REVIEW" | "ELIGIBLE_NO_POSITION" | "OPEN_PRACTICE_POSITION";

/**
 * A real RYO envelope is one saved from the live catalogue under scenarios/fixtures. A test-only envelope
 * can never open a position on screen.
 */
export function isRealEnvelope(market: RunRecord["market"]): boolean {
  return market.status === "ok" && market.source.startsWith("scenarios/fixtures/") && !market.source.includes("TEST");
}

/** Maps a record onto the PRD §7 states. OPEN_PRACTICE_POSITION needs ELIGIBLE, a passing gate and a real ok envelope. */
export function finalState(record: RunRecord | null): FinalState {
  if (!record) return "IDLE";
  if (record.verdict === "BLOCK") return "BLOCK";
  if (record.verdict === "REVIEW") return "REVIEW";
  if (record.marketGate === "PASS" && isRealEnvelope(record.market)) return "OPEN_PRACTICE_POSITION";
  return "ELIGIBLE_NO_POSITION";
}
