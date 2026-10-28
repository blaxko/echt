import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentGraph } from "../src/components.tsx";
import type { RunRecord } from "../src/api.ts";

// The payment graph is the dashboard's large tile. A blank graph is a bug (it hid on the landing-to-dashboard path, and
// its strokes used a token too faint to see). These tests fail if the graph or table renders without visible content,
// or if a graph colour falls below its WCAG contrast floor on the palette.
const webRoot = new URL("../", import.meta.url);
const css = readFileSync(new URL("src/styles.css", webRoot), "utf8");
const record = JSON.parse(
  readFileSync(new URL("../../../scenarios/runs/T1.json", import.meta.url), "utf8").trim(),
) as RunRecord;

const tokenValue = (name: string): string => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1]!;
};

// The declaration of one selector, with its var(--token) resolved to the hex value.
const declared = (selector: string, prop: string): string => {
  const block = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`selector ${selector} not found`);
  const decl = block[1]!.match(new RegExp(`${prop}:\\s*var\\((--[a-z-]+)\\)`));
  if (!decl) throw new Error(`${prop} on ${selector} is not a palette token`);
  return tokenValue(decl[1]!);
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("payment graph visibility", () => {
  const markup = renderToStaticMarkup(createElement(PaymentGraph, { record }));

  it("draws one edge per payment and one box per voice", () => {
    const paid = record.voices.filter((v) => v.paymentTx).length;
    expect(markup.match(/class="edge /g)?.length ?? 0).toBe(paid);
    expect(markup.match(/class="node voice/g)?.length ?? 0).toBe(record.voices.length);
  });

  it("writes every voice into the table, so the zone is never blank", () => {
    expect(markup).toContain("<table");
    expect(markup.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)?.length ?? 0).toBe(record.voices.length);
  });

  it("text on the graph meets AA contrast (4.5:1) on its surface", () => {
    const surface = declared(".graph .node", "fill");
    expect(contrast(declared(".graph .node-label", "fill"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(declared(".graph .node-sub", "fill"), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("lines and box borders meet the 3:1 graphics contrast floor on the background", () => {
    const bg = tokenValue("--bg");
    expect(contrast(declared(".graph .node", "stroke"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(declared(".graph .edge.not-campaign", "stroke"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(declared(".graph .edge.linked", "stroke"), bg)).toBeGreaterThanOrEqual(3);
  });
});
