import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CSP_DIRECTIVES, CSP_HEADER_ONLY } from "../csp.ts";

// Read the header value from vercel.json at the repo root, so the test fails if the two ever drift.
const vercel = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const header = vercel.headers.find((h) => h.source === "/(.*)")!.headers.find((h) => h.key === "Content-Security-Policy")!.value;

describe("Content Security Policy", () => {
  it("the Vercel header carries every meta-tag directive", () => {
    const headerParts = header.split(";").map((s) => s.trim());
    for (const d of CSP_DIRECTIVES) expect(headerParts).toContain(d);
  });

  it("the header adds only the header-only directives", () => {
    const headerParts = header.split(";").map((s) => s.trim());
    expect(headerParts.length).toBe(CSP_DIRECTIVES.length + CSP_HEADER_ONLY.length);
    for (const d of CSP_HEADER_ONLY) expect(headerParts).toContain(d);
  });

  it("the policy forbids inline scripts and remote origins", () => {
    expect(header).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(header).not.toMatch(/https?:\/\//);
  });
});
