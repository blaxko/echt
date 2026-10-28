import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { RunRecord } from "../src/api.ts";
import { T1_FACTS, T1_TX } from "../src/content.ts";

// The landing states the recorded T1 run. Each number it shows must match the record, so a copy edit can't drift
// from the evidence. Facts come from scenarios/runs only.
const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../scenarios/runs/${name}.json`, import.meta.url), "utf8").trim()) as RunRecord;
const t1 = load("T1");
const t2 = load("T2");

describe("landing facts match the recorded runs", () => {
  it("T1 verdict, voices, links, payments and evidence hash", () => {
    expect(t1.verdict).toBe("BLOCK");
    expect(T1_FACTS.verdict).toBe("NO POSITION · BLOCK");
    expect(t1.voices.length).toBe(T1_FACTS.voices);
    expect(t1.linkedPersonaIds.length).toBe(T1_FACTS.linked);
    expect(t1.voices.filter((v) => v.paymentTx).length).toBe(T1_FACTS.payments);
    expect(t1.evidenceHash).toBe(T1_FACTS.evidenceHash);
    expect(t1.verdictTx).toBe(T1_TX);
  });

  it("T1 pinned block and the 11.9 h gap shown on the floating chip", () => {
    expect(t1.pinnedToBlock).toBe(T1_FACTS.pinnedBlock);
    const gaps = t1.voices.filter((v) => v.paymentTx).map((v) => v.gapHours);
    expect(gaps.every((g) => g !== null && Math.abs(g - 11.9) < 0.05)).toBe(true);
    expect(T1_FACTS.gapHours).toBe("11.9 h");
  });

  it("T2 is ELIGIBLE with no linked voices, as the problem-fix-result strip says", () => {
    expect(t2.verdict).toBe("ELIGIBLE");
    expect(t2.linkedPersonaIds.length).toBe(0);
  });
});
