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

/**
 * What the page has loaded, tagged with the scenario it was requested for. A result is only ever shown for
 * the scenario it belongs to: switching tabs never shows the previous scenario's record, even for one frame.
 */
export type LoadState =
  | { status: "loading"; scenario: string }
  | { status: "ready"; scenario: string; record: RunRecord | null }
  | { status: "error"; scenario: string; message: string };

export type Screen = "loading" | "error" | "empty" | "record";

/** The load state as it applies to the scenario on screen. Anything for another scenario counts as loading. */
export function shownFor(load: LoadState, scenario: string): LoadState {
  return load.scenario === scenario ? load : { status: "loading", scenario };
}

/** Loading never shows IDLE or a verdict. "empty" means the request settled and no record exists. */
export function screenFor(load: LoadState): Screen {
  if (load.status === "loading") return "loading";
  if (load.status === "error") return "error";
  return load.record ? "record" : "empty";
}

export function recordOf(load: LoadState): RunRecord | null {
  return load.status === "ready" ? load.record : null;
}
