// Offline scenario check: rerun the policy on a recorded run's inputs and compare with the scenario's expectations.
// Pure: no network, no LLM, no RYO, no chain. A scenario marked pending is shown as PENDING, never as PASS.
import { decideRun, EVIDENCE_SECTIONS, type RunInput } from "../packages/policy/src/index.ts";

export type Status = "PASS" | "FAIL" | "PENDING";

export interface ScenarioFile {
  id: string;
  status?: "pending";
  pendingReason?: string;
  expected?: {
    paymentVerdict?: string;
    reason?: string;
    linkedCount?: number;
    replay?: string;
    section?: string;
  };
}

// The fields of a recorded run that the check reads (scenarios/runs/<id>.json).
export interface RecordedRun {
  inputs: unknown;
  evidenceHash: string;
  sectionHashes?: Record<string, string>;
}

export interface Row {
  scenario: string;
  expected: string;
  actual: string;
  status: Status;
  reason?: string;
}

export function checkScenario(file: ScenarioFile, run: RecordedRun | null): Row {
  if (file.status === "pending") {
    return { scenario: file.id, expected: "—", actual: "—", status: "PENDING", reason: file.pendingReason ?? "pending" };
  }
  const expected = file.expected ?? {};
  if (!run) {
    return { scenario: file.id, expected: "a recorded run", actual: "no run in scenarios/runs/", status: "FAIL" };
  }

  const decision = decideRun(run.inputs as RunInput);
  const hashMatches = decision.evidenceHash === run.evidenceHash;

  // Replay check: the stored inputs must reproduce the stored evidence hash. A mismatch names the first section that changed.
  if (expected.replay !== undefined) {
    const section = hashMatches
      ? undefined
      : EVIDENCE_SECTIONS.find((s) => decision.sectionHashes[s] !== run.sectionHashes?.[s]) ?? "unknown";
    const actual = hashMatches ? "MATCH" : `HASH_MISMATCH · section: ${section}`;
    const want = expected.section ? `${expected.replay} · section: ${expected.section}` : expected.replay;
    const ok = hashMatches ? expected.replay === "MATCH" : actual === want;
    return { scenario: file.id, expected: want, actual, status: ok ? "PASS" : "FAIL" };
  }

  // Verdict check: verdict, reason code, linked voices, and the recorded evidence hash.
  const linked = decision.linkedPersonaIds.length;
  const parts = [expected.paymentVerdict ?? "?"];
  if (expected.reason) parts.push(expected.reason);
  if (expected.linkedCount !== undefined) parts.push(`${expected.linkedCount} linked`);
  parts.push("hash matches recorded run");
  const want = parts.join(" · ");

  const actualParts: string[] = [decision.verdict];
  if (expected.reason) actualParts.push(decision.reasons.join(",") || "none");
  if (expected.linkedCount !== undefined) actualParts.push(`${linked} linked`);
  actualParts.push(hashMatches ? "hash matches recorded run" : "hash differs from recorded run");
  const actual = actualParts.join(" · ");

  const ok =
    decision.verdict === expected.paymentVerdict &&
    (expected.reason === undefined || decision.reasons.includes(expected.reason as never)) &&
    (expected.linkedCount === undefined || linked === expected.linkedCount) &&
    hashMatches;
  return { scenario: file.id, expected: want, actual, status: ok ? "PASS" : "FAIL" };
}

export function formatTable(rows: Row[]): string {
  const lines = ["| Scenario | Expected | Actual | Result |", "|---|---|---|---|"];
  for (const r of rows) {
    const result = r.status === "PENDING" ? `PENDING (${r.reason})` : r.status;
    lines.push(`| ${r.scenario} | ${r.expected} | ${r.actual} | ${result} |`);
  }
  return lines.join("\n");
}
