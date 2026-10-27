// Maps raw provider outcomes onto the three states the policy understands (PRD §10.2).
// Missing or failed data is never coerced to a clean result.

export type ProviderEvent =
  | { kind: "ok" }
  | { kind: "timeout" }
  | { kind: "http_5xx" }
  | { kind: "rows_over_limit"; rows: number }
  | { kind: "consensus_failed" };

export type ProviderOutcome = "ok" | "failed" | "inconsistent";

const PAGINATION_ROW_LIMIT = 1000;

export function providerOutcome(event: ProviderEvent): ProviderOutcome {
  switch (event.kind) {
    case "ok":
      return "ok";
    case "consensus_failed":
      return "inconsistent";
    case "timeout":
    case "http_5xx":
      return "failed";
    case "rows_over_limit":
      return event.rows > PAGINATION_ROW_LIMIT ? "failed" : "ok";
  }
}
