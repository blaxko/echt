import { describe, expect, it } from "vitest";
import { detectConvergence } from "../src/convergence.ts";
import { bullishPost } from "./builders.ts";

describe("detectConvergence (PRD §6.3)", () => {
  it("converges when 5 distinct bullish voices agree on one token within 6 h", () => {
    const items = [1, 2, 3, 4, 5].map((n) => bullishPost(n, n * 10));
    const result = detectConvergence(
      items.map((i) => i.post),
      items.map((i) => i.extraction),
    );
    expect(result.status).toBe("CONVERGED");
    if (result.status !== "CONVERGED") return;
    expect(result.token).toBe("ETH");
    expect(result.voices.map((v) => v.personaId)).toEqual([
      "persona_01",
      "persona_02",
      "persona_03",
      "persona_04",
      "persona_05",
    ]);
  });

  it("stays IDLE with 4 voices (fixture from PRD §11 F3)", () => {
    const items = [1, 2, 3, 4].map((n) => bullishPost(n, n));
    const result = detectConvergence(
      items.map((i) => i.post),
      items.map((i) => i.extraction),
    );
    expect(result).toEqual({ status: "IDLE" });
  });

  it("counts a voice that posts three times once", () => {
    const items = [bullishPost(1, 1), bullishPost(1, 2), bullishPost(1, 3), bullishPost(2, 4)];
    const result = detectConvergence(
      items.map((i) => i.post),
      items.map((i) => i.extraction),
    );
    expect(result).toEqual({ status: "IDLE" });
  });

  it("does not converge when the five posts span more than 6 h", () => {
    const items = [1, 2, 3, 4].map((n) => bullishPost(n, n));
    items.push(bullishPost(5, 6 * 60 + 30));
    const result = detectConvergence(
      items.map((i) => i.post),
      items.map((i) => i.extraction),
    );
    expect(result).toEqual({ status: "IDLE" });
  });

  it("treats a post with no extraction as a failed extraction inside the window", () => {
    const items = [1, 2, 3, 4, 5].map((n) => bullishPost(n, n));
    const extra = bullishPost(6, 6);
    const result = detectConvergence(
      [...items.map((i) => i.post), extra.post],
      items.map((i) => i.extraction),
    );
    expect(result.status).toBe("CONVERGED");
    if (result.status !== "CONVERGED") return;
    expect(result.extractionFailedPostIds).toEqual([extra.post.id]);
  });
});
