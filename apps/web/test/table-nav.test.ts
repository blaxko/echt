import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RunRecord } from "../src/api.ts";
import { addressView, etherscanAddress, sameSender } from "../src/format.ts";
import { AppHeader, TransferTable } from "../src/components.tsx";

const t1 = JSON.parse(
  readFileSync(new URL("../../../scenarios/runs/T1.json", import.meta.url), "utf8").trim(),
) as RunRecord;
const transfers = (t1.inputs as { transfers: { from: string; to: string }[] }).transfers;

describe("address formatter", () => {
  it("shows 0x, four characters, an ellipsis and four characters, with the full address in full", () => {
    const addr = "0xaa9f1234abcd5678ef90aabbccdd00117b25";
    const view = addressView(addr);
    expect(view.short).toBe("0xaa9f…7b25");
    expect(view.full).toBe(addr);
  });

  it("every recorded T1 address has the short form", () => {
    for (const t of transfers) expect(addressView(t.from).short).toMatch(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/);
  });

  it("links the sender to its Sepolia address page", () => {
    expect(etherscanAddress("0xabc")).toBe("https://sepolia.etherscan.io/address/0xabc");
  });
});

describe("the From column collapses only when every sender is the same", () => {
  it("T1 has one campaign sender, so From can collapse", () => {
    expect(sameSender(transfers)).toBe(true);
  });

  it("two different senders keep the column", () => {
    const mixed = [transfers[0]!, { ...transfers[0]!, from: "0x" + "11".repeat(20) }];
    expect(sameSender(mixed)).toBe(false);
  });

  it("the comparison ignores letter case", () => {
    const upper = transfers.map((t) => ({ ...t, from: t.from.toUpperCase().replace("0X", "0x") }));
    expect(sameSender(upper)).toBe(true);
  });

  it("no transfers keeps the column rather than inventing a sender", () => {
    expect(sameSender([])).toBe(false);
  });

  it("the rendered table carries the one-sender class only when the senders match", () => {
    const same = renderToStaticMarkup(createElement(TransferTable, { record: t1 }));
    expect(same).toContain("one-sender");
    const mixedRecord = {
      ...t1,
      inputs: { ...(t1.inputs as object), transfers: [transfers[0]!, { ...transfers[0]!, from: "0x" + "22".repeat(20) }] },
      evidence: { ...t1.evidence, transfers: t1.evidence.transfers },
    } as RunRecord;
    expect(renderToStaticMarkup(createElement(TransferTable, { record: mixedRecord }))).not.toContain("one-sender");
  });
});

describe("header navigation", () => {
  it("the logo and a visible Home link point to #/ on the dashboard header", () => {
    const html = renderToStaticMarkup(createElement(AppHeader, null));
    expect(html).toContain('href="#/"');
    expect(html).toContain('aria-label="Echt home"');
    expect(html).toContain("← Home");
  });

  it("the same header, with the Brief, links to #/", () => {
    const html = renderToStaticMarkup(createElement(AppHeader, null));
    expect(html).toContain('href="#/"');
    expect(html).toContain("← Home");
  });
});
