import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// One palette, independent of the OS theme (design/reference/notes.md, section 1). These tests read the
// shipped source, so a regression fails here before a page is ever built.
const webRoot = new URL("../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, webRoot), "utf8");
const css = read("src/styles.css");
const html = read("index.html");

// Print is the only light view. Everything outside @media print must draw from the palette.
const screenCss = css.replace(/@media print \{[\s\S]*$/, "");

// Palette literals allowed in a background declaration, and the glow colour the body uses.
const PALETTE_HEX = new Set(["#000000", "#0b0d0b", "#111411", "#203838", "#a1d11c", "#0b0d0b"]);
const PALETTE_VARS = ["--bg", "--surface", "--surface-raised", "--accent", "--accent-ink", "--teal", "--ink", "--ink-muted", "--line", "--block", "--review", "--eligible", "--open", "--run"];

function backgroundValues(source: string): string[] {
  return [...source.matchAll(/background(?:-color)?:\s*([^;}]+)[;}]/g)].map((m) => m[1]!.trim());
}

const NAMED_COLOURS = /\b(white|black|red|blue|green|gray|grey|silver|navy|teal|purple|orange|yellow|pink|brown)\b/i;

// A background is on-palette when every colour in it is a palette hex, a palette variable, or the teal or lime tint.
function isPaletteBackground(value: string): boolean {
  if (NAMED_COLOURS.test(value)) return false;
  const hexes = [...value.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  if (!hexes.every((h) => PALETTE_HEX.has(h))) return false;
  const tints = [...value.matchAll(/rgba?\(([^)]*)\)/g)].map((m) => m[1]!.replace(/\s+/g, ""));
  // The teal glow, the lime tint, and the black scrim behind a modal dialog are the only tints allowed.
  if (!tints.every((t) => t.startsWith("32,56,56,") || t.startsWith("161,209,28,") || t.startsWith("0,0,0,"))) return false;
  const vars = [...value.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => `--${m[1]}`);
  return vars.every((v) => PALETTE_VARS.includes(v));
}

describe("one palette, no OS theme switching", () => {
  it("no prefers-color-scheme rule in the stylesheet or the app source", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    for (const dir of ["src", "test"]) {
      for (const file of readdirSync(new URL(`${dir}/`, webRoot))) {
        // This file names the forbidden patterns itself, so it is the one file the scan skips.
        if (!/\.(ts|tsx)$/.test(file) || file === "palette.test.ts") continue;
        expect(read(`${dir}/${file}`), file).not.toMatch(/prefers-color-scheme|data-theme/);
      }
    }
  });

  it("the page declares dark, and the theme colour matches the background token", () => {
    expect(html).toMatch(/<meta name="color-scheme" content="dark"/);
    const bg = css.match(/--bg:\s*(#[0-9a-fA-F]{6})/)![1]!.toLowerCase();
    expect(html).toMatch(new RegExp(`<meta name="theme-color" content="${bg}"`, "i"));
  });

  it("html and body draw from the background token", () => {
    expect(css).toMatch(/html \{ background: var\(--bg\); \}/);
    expect(css).toMatch(/body \{[\s\S]*?var\(--bg\)/);
  });

  it("every screen background is a palette colour, never white", () => {
    const values = backgroundValues(screenCss);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(isPaletteBackground(v), `background: ${v}`).toBe(true);
    // "white" as a colour only: the white-space property is not one.
    expect(screenCss).not.toMatch(/#fff\b|#ffffff\b|(?<![-\w])white(?![-\w])/i);
  });

  it("the print view is the only light view", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/--bg: #fff/);
  });
});
