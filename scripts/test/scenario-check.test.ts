import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkScenario, type ScenarioFile } from "../scenario-check.ts";

// Scenario expectations and recorded runs, read from the repo. Nothing here calls the network, an LLM, RYO or a chain.
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8").trim()) as T;

describe("scenario check", () => {
  it("T1: the recorded inputs reproduce BLOCK, THRESHOLD_MET, 5 linked voices and the evidence hash", () => {
    const row = checkScenario(read<ScenarioFile>("scenarios/T1-coordinated.json"), read("scenarios/runs/T1.json"));
    expect(row.status).toBe("PASS");
  });

  it("T2: the recorded inputs reproduce ELIGIBLE with no linked voices", () => {
    const row = checkScenario(read<ScenarioFile>("scenarios/T2-unrelated.json"), read("scenarios/runs/T2.json"));
    expect(row.status).toBe("PASS");
  });

  it("a wrong expected verdict is a FAIL, and the row shows both sides", () => {
    const wrong = { ...read<ScenarioFile>("scenarios/T2-unrelated.json"), expected: { paymentVerdict: "BLOCK" } } as ScenarioFile;
    const row = checkScenario(wrong, read("scenarios/runs/T2.json"));
    expect(row.status).toBe("FAIL");
    expect(row.expected).toContain("BLOCK");
    expect(row.actual).toContain("ELIGIBLE");
  });

  it("a corrupted evidence hash is a FAIL even when the verdict matches", () => {
    const run = { ...read<Record<string, unknown>>("scenarios/runs/T2.json"), evidenceHash: "0x" + "00".repeat(32) };
    const row = checkScenario(read<ScenarioFile>("scenarios/T2-unrelated.json"), run as never);
    expect(row.status).toBe("FAIL");
  });

  it("T5: the injected provider fault gives REVIEW with PROVIDER_FAILED", () => {
    const row = checkScenario(read<ScenarioFile>("scenarios/T5-provider-down.json"), read("scenarios/runs/T5.json"));
    expect(row.status).toBe("PASS");
  });

  it("T6: a tampered copy replays as HASH_MISMATCH in the transfers section", () => {
    const row = checkScenario(read<ScenarioFile>("scenarios/T6-tampered.json"), read("scenarios/runs/T6.json"));
    expect(row.status).toBe("PASS");
    expect(row.actual).toContain("HASH_MISMATCH");
    expect(row.actual).toContain("transfers");
  });

  it("T3 and T4 are PENDING with the reason, never PASS", () => {
    for (const id of ["T3", "T4"]) {
      const file = read<ScenarioFile>(`scenarios/${id}-pending.json`);
      const row = checkScenario(file, null);
      expect(row.status).toBe("PENDING");
      expect(row.reason).toMatch(/RYO/);
    }
  });
});
