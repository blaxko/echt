import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { RunRecord } from "../src/api.ts";
import { applyWhatIf, baseWhatIf, recordedPaymentVoices, runWhatIf, viewRecord } from "../src/whatif.ts";

const t1 = JSON.parse(
  readFileSync(new URL("../../../scenarios/runs/T1.json", import.meta.url), "utf8").trim(),
) as RunRecord;
const input = t1.inputs as Parameters<typeof applyWhatIf>[0];

describe("what-if: re-running the policy in the browser", () => {
  it("with nothing changed, the recorded verdict comes back", () => {
    const d = runWhatIf(t1, baseWhatIf(input));
    expect(d.verdict).toBe("BLOCK");
    expect(d.evidenceHash).toBe(t1.evidenceHash);
  });

  it("T1 minus 3 payments drops below the threshold: ELIGIBLE", () => {
    const linked = [...recordedPaymentVoices(input)];
    const w = baseWhatIf(input);
    for (const id of linked.slice(0, 3)) w.paid[id] = false;
    expect(runWhatIf(t1, w).verdict).toBe("ELIGIBLE");
  });

  it("every linked voice disclosed: ELIGIBLE with DISCLOSED_CAMPAIGN", () => {
    const w = baseWhatIf(input);
    for (const v of input.voices) w.disclosed[v.personaId] = true;
    const d = runWhatIf(t1, w);
    expect(d.verdict).toBe("ELIGIBLE");
    expect(d.reasons).toContain("DISCLOSED_CAMPAIGN");
  });

  it("transfer provider down: REVIEW, never ELIGIBLE", () => {
    const w = baseWhatIf(input);
    w.providerDown = true;
    expect(runWhatIf(t1, w).verdict).toBe("REVIEW");
  });

  it("the graph view follows the what-if, and the recorded run is left alone", () => {
    const w = baseWhatIf(input);
    for (const id of [...recordedPaymentVoices(input)].slice(0, 3)) w.paid[id] = false;
    const view = viewRecord(t1, w);
    expect(view.voices.filter((v) => v.linked).length).toBe(2);
    expect(view.voices.filter((v) => v.paymentTx).length).toBe(2);
    expect(t1.voices.filter((v) => v.linked).length).toBe(5);
  });

  it("the recorded input is not mutated by a what-if", () => {
    const before = JSON.stringify(input);
    const w = baseWhatIf(input);
    w.providerDown = true;
    for (const v of input.voices) w.disclosed[v.personaId] = true;
    applyWhatIf(input, w);
    expect(JSON.stringify(input)).toBe(before);
  });
});
