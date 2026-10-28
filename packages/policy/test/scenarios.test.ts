import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluate, type EvaluationInput } from "../src/evaluate.ts";
import { hashCanonical } from "../src/hash.ts";

// PRD §10.1: each fixture is a synthetic unit input with its expected outcome.
// Real seeded scenarios (TESTNET transfers) are added after Task 8.
const dir = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

interface Fixture {
  id: string;
  title: string;
  input: EvaluationInput;
  expected: Record<string, unknown>;
}

const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture);

const byId = (id: string): Fixture => {
  const f = fixtures.find((x) => x.id === id);
  if (!f) throw new Error(`missing fixture ${id}`);
  return f;
};

describe("scenario fixtures T1–T6 (PRD §10.1)", () => {
  it("loads all six fixtures", () => {
    expect(fixtures.map((f) => f.id)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6"]);
  });

  for (const fixture of fixtures) {
    it(`${fixture.id}: ${fixture.title}`, () => {
      const result = evaluate(fixture.input);
      expect(result.status).toBe("DECIDED");
      if (result.status !== "DECIDED") return;
      expect({
        status: result.status,
        paymentVerdict: result.paymentVerdict,
        reasonCodes: result.reasonCodes,
        marketGate: result.marketGate,
        finalAction: result.finalAction,
      }).toEqual(fixture.expected);
    });
  }

  it("T4 reason codes are codes only and never name a voice", () => {
    const result = evaluate(byId("T4").input);
    if (result.status !== "DECIDED") throw new Error("T4 must decide");
    expect(JSON.stringify(result.reasonCodes)).not.toMatch(/persona_/);
  });

  it("T6 differs from T1 only in the transfers section, so its hash must differ", () => {
    const t1 = byId("T1").input;
    const t6 = byId("T6").input;
    expect(hashCanonical({ transfers: t6.transfers as never })).not.toBe(
      hashCanonical({ transfers: t1.transfers as never }),
    );
    expect(hashCanonical({ posts: t6.posts as never })).toBe(hashCanonical({ posts: t1.posts as never }));
  });
});
