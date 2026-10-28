import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Competition vocabulary stays in the README and docs/. The web app is product copy, so these words must not appear
// in any file it ships or renders.
const FORBIDDEN = [/hackathon/i, /\bBLI\b/, /dorahacks/i, /bounty/i, /\bjudges?\b/i, /judging/i, /submission/i];

const webRoot = new URL("../", import.meta.url);
const sources = [
  ...readdirSync(new URL("src/", webRoot)).filter((f) => /\.(ts|tsx|css)$/.test(f)).map((f) => `src/${f}`),
  "index.html",
];

describe("product copy", () => {
  it("the web app never uses competition vocabulary", () => {
    for (const file of sources) {
      const text = readFileSync(new URL(file, webRoot), "utf8");
      for (const word of FORBIDDEN) expect(text, `${file} matches ${word}`).not.toMatch(word);
    }
  });
});
