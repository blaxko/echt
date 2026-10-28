import { decideRun, EVIDENCE_SECTIONS, type RunInput } from "@echt/policy";
import type { RunRecord } from "./api.ts";

export type ReplayResult = { result: "MATCH" } | { result: "HASH_MISMATCH"; section: string } | { result: "VERDICT_MISMATCH" };

/** FR9: recompute the decision offline from the stored inputs, then compare hash, then verdict. No network calls. */
export function replay(record: RunRecord): ReplayResult {
  const recomputed = decideRun(record.inputs as RunInput);
  if (recomputed.evidenceHash !== record.evidenceHash) {
    const section = EVIDENCE_SECTIONS.find((s) => recomputed.sectionHashes[s] !== record.sectionHashes[s]) ?? "unknown";
    return { result: "HASH_MISMATCH", section };
  }
  if (recomputed.verdict !== record.verdict) return { result: "VERDICT_MISMATCH" };
  return { result: "MATCH" };
}
