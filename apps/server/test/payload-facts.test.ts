import { describe, expect, it } from "vitest";
import { buildRunPayload, earliestPostByPersona, type ExtractionFacts, type ScenarioFile } from "../src/run-payload.ts";

// Test-only data: synthetic personas, wallets and posts.
const AFTER = Date.parse("2026-10-28T20:00:00Z");
const wallet = (n: number) => `0x${String(n).padStart(40, "0")}`;

function scenario(posts: ScenarioFile["input"]["posts"]): ScenarioFile {
  return {
    id: "T1",
    provenance: "TESTNET",
    input: {
      runId: "t1-test",
      tokenSymbol: "ETH",
      campaignSource: wallet(99),
      voices: [1, 2].map((n) => ({ personaId: `persona_0${n}`, wallet: wallet(n), attestation: { method: "signed_challenge" } })),
      posts,
    },
  };
}

const NONE: ExtractionFacts = { disclosedPersonas: new Set(), failedPersonas: new Set() };

describe("voices with more than one post", () => {
  const posts = [
    { id: "post_01_late", personaId: "persona_01", postedAt: "2026-10-28T16:30:00Z", postBlock: 300 },
    { id: "post_01_early", personaId: "persona_01", postedAt: "2026-10-28T16:00:00Z", postBlock: 200 },
    { id: "post_02", personaId: "persona_02", postedAt: "2026-10-28T16:10:00Z", postBlock: 250 },
  ];

  it("uses the earliest post for a voice's time and block, not the last one listed", () => {
    const p = earliestPostByPersona(posts);
    expect(p.get("persona_01")!.id).toBe("post_01_early");
    const payload = buildRunPayload(scenario(posts), 400, AFTER);
    const v1 = payload.voices.find((v) => v.personaId === "persona_01")!;
    expect(v1.postBlock).toBe(200);
    expect(v1.postedAtMs).toBe(Date.parse("2026-10-28T16:00:00Z"));
  });

  it("cites the voice's post when that voice's disclosure is detected", () => {
    const facts: ExtractionFacts = { disclosedPersonas: new Set(["persona_01"]), failedPersonas: new Set() };
    const payload = buildRunPayload(scenario(posts), 400, AFTER, facts);
    expect(payload.voices.find((v) => v.personaId === "persona_01")!.disclosedByPostId).toBe("post_01_early");
    expect(payload.voices.find((v) => v.personaId === "persona_02")!.disclosedByPostId).toBeNull();
  });
});

describe("extraction failures", () => {
  const posts = [
    { id: "post_01", personaId: "persona_01", postedAt: "2026-10-28T16:00:00Z", postBlock: 200 },
    { id: "post_02", personaId: "persona_02", postedAt: "2026-10-28T16:10:00Z", postBlock: 250 },
  ];

  it("is false when every extraction succeeded", () => {
    expect(buildRunPayload(scenario(posts), 400, AFTER, NONE).extractionFailed).toBe(false);
  });

  it("is true when a converging voice's extraction failed, so the run becomes REVIEW", () => {
    const facts: ExtractionFacts = { disclosedPersonas: new Set(), failedPersonas: new Set(["persona_02"]) };
    expect(buildRunPayload(scenario(posts), 400, AFTER, facts).extractionFailed).toBe(true);
  });

  it("is true when the extraction is missing (missing data is REVIEW, never clean)", () => {
    const facts: ExtractionFacts = { disclosedPersonas: new Set(), failedPersonas: new Set(["persona_01", "persona_02"]) };
    expect(buildRunPayload(scenario(posts), 400, AFTER, facts).extractionFailed).toBe(true);
  });
});
