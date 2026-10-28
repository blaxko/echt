import { describe, expect, it } from "vitest";
import { fetchRecord } from "../src/api.ts";
import { recordOf, screenFor, type LoadState } from "../src/state.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const html = (status: number) => new Response("<html>proxy error</html>", { status, headers: { "content-type": "text/html" } });

describe("record loading", () => {
  it("shows loading until the request settles, never IDLE or a verdict", () => {
    const loading: LoadState = { status: "loading" };
    expect(screenFor(loading)).toBe("loading");
    expect(recordOf(loading)).toBeNull();
  });

  it("shows empty only after a settled request with no record", () => {
    expect(screenFor({ status: "ready", record: null })).toBe("empty");
  });

  it("shows a record once it has arrived", () => {
    const rec = { verdict: "BLOCK" } as never;
    expect(screenFor({ status: "ready", record: rec })).toBe("record");
    expect(recordOf({ status: "ready", record: rec })).toBe(rec);
  });

  it("reports an error instead of empty", () => {
    expect(screenFor({ status: "error", message: "x" })).toBe("error");
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
