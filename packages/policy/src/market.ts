import type { MarketGate, RyoEnvelope } from "./types.ts";

/** Why RYO gave no usable envelope. Each one maps to UNAVAILABLE, never to FAIL or PASS. */
export type RyoFailure = "http_429" | "http_503" | "mcp_is_error" | "rest_error" | "key_missing";

/**
 * The deterministic facts the gate reads from a RYO `deep_analysis` envelope. The server's
 * RYO adapter fills this in; the exact field paths are confirmed against the live catalog
 * (PRD Q2), so the policy takes normalized facts rather than raw RYO JSON.
 */
export type MarketFacts =
  | { kind: "failed"; failure: RyoFailure }
  | {
      kind: "envelope";
      status: RyoEnvelope["status"];
      dataMode: RyoEnvelope["data_mode"];
      verdict: "bullish" | "neutral" | "bearish" | null;
      primarySectionsAvailable: boolean;
    };

/** PRD FR4.4. A missing or unavailable input is UNAVAILABLE. It is never PASS. */
export function marketGate(facts: MarketFacts): MarketGate {
  if (facts.kind === "failed") return "UNAVAILABLE";
  if (facts.status === "unavailable" || facts.dataMode === "simulated") return "UNAVAILABLE";
  if (facts.status !== "ok" && facts.status !== "partial") return "UNAVAILABLE";
  if (facts.verdict === "bearish") return "FAIL";
  if (facts.verdict === null || !facts.primarySectionsAvailable) return "UNAVAILABLE";
  return "PASS";
}
