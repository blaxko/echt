import { describe, expect, it } from "vitest";
import { fetchRecord, type RunRecord } from "../src/api.ts";
import { recordOf, screenFor, shownFor, type LoadState } from "../src/state.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const html = (status: number) => new Response("<html>proxy error</html>", { status, headers: { "content-type": "text/html" } });
const rec = (scenario: string) => ({ scenario, verdict: "BLOCK" }) as unknown as RunRecord;

describe("record loading", () => {
  it("shows loading until the request settles, never IDLE or a verdict", () => {
    const loading: LoadState = { status: "loading", scenario: "T1" };
    expect(screenFor(loading)).toBe("loading");
    expect(recordOf(loading)).toBeNull();
  });

  it("shows empty only after a settled request with no record", () => {
    expect(screenFor({ status: "ready", scenario: "T2", record: null })).toBe("empty");
  });

  it("shows a record once it has arrived", () => {
    const r = rec("T1");
    expect(screenFor({ status: "ready", scenario: "T1", record: r })).toBe("record");
    expect(recordOf({ status: "ready", scenario: "T1", record: r })).toBe(r);
  });

  it("reports an error instead of empty", () => {
    expect(screenFor({ status: "error", scenario: "T1", message: "x" })).toBe("error");
  });

  it("never shows a record for another scenario, even for one frame after a tab switch", () => {
    const t1: LoadState = { status: "ready", scenario: "T1", record: rec("T1") };
    expect(screenFor(shownFor(t1, "T2"))).toBe("loading");
    expect(recordOf(shownFor(t1, "T2"))).toBeNull();
    expect(recordOf(shownFor(t1, "T1"))).toEqual(rec("T1"));
  });

  it("retries a proxy error (HTML) and then returns the record, not empty", async () => {
    const replies = [html(502), json({ verdict: "BLOCK" })];
    const record = await fetchRecord("T1", async () => replies.shift()!, 3, 1);
    expect(record).toEqual({ verdict: "BLOCK" });
  });

  it("treats a JSON 404 from the API as no record", async () => {
    expect(await fetchRecord("T2", async () => json({ error: "no record" }, 404), 3, 1)).toBeNull();
  });

  it("throws after the retries run out on a non-JSON failure", async () => {
    await expect(fetchRecord("T1", async () => html(503), 2, 1)).rejects.toThrow("not JSON");
  });
});
