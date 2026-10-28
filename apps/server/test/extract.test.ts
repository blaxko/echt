import { describe, expect, it } from "vitest";
import { cacheKey, extractPost, type ChatClient, type Extraction, type ExtractionCache } from "../src/extraction/extract.ts";

const GOOD = JSON.stringify({
  token: "ETH",
  sentiment: "bullish",
  conviction: 0.8,
  urgency: 0.6,
  disclosure_detected: false,
  disclosure_evidence: null,
});

function memoryCache(): ExtractionCache & { store: Map<string, Extraction> } {
  const store = new Map<string, Extraction>();
  return { store, get: (k) => store.get(k), set: (k, v) => void store.set(k, v) };
}

function scripted(replies: string[]): ChatClient & { calls: number } {
  let i = 0;
  const client = {
    calls: 0,
    async complete() {
      client.calls++;
      return replies[Math.min(i++, replies.length - 1)]!;
    },
  };
  return client;
}

const MODEL = "openai/gpt-oss-120b";

describe("extractPost", () => {
  it("returns a validated extraction on the first reply", async () => {
    const client = scripted([GOOD]);
    const result = await extractPost(client, memoryCache(), "ETH to the moon", MODEL);
    expect(result).toMatchObject({ status: "ok", cached: false, extraction: { token: "ETH", sentiment: "bullish" } });
    expect(client.calls).toBe(1);
  });

  it("retries once after a bad reply, then succeeds", async () => {
    const client = scripted(["not json", GOOD]);
    const result = await extractPost(client, memoryCache(), "ETH to the moon", MODEL);
    expect(result.status).toBe("ok");
    expect(client.calls).toBe(2);
  });

  it("rejects a reply that fails the schema, and marks extraction_failed after the retry", async () => {
    const bad = JSON.stringify({ token: "ETH", sentiment: "maybe", conviction: 2, urgency: 0, disclosure_detected: "yes", disclosure_evidence: null });
    const client = scripted([bad, bad]);
    const result = await extractPost(client, memoryCache(), "ETH", MODEL);
    expect(result.status).toBe("extraction_failed");
    expect(client.calls).toBe(2);
  });

  it("makes no model call on a cache hit", async () => {
    const cache = memoryCache();
    await extractPost(scripted([GOOD]), cache, "ETH", MODEL);
    const client = scripted([]);
    const again = await extractPost(client, cache, "ETH", MODEL);
    expect(again).toMatchObject({ status: "ok", cached: true });
    expect(client.calls).toBe(0);
  });

  it("keys the cache on text, model and prompt version", () => {
    expect(cacheKey("a", "m", "v1")).not.toBe(cacheKey("b", "m", "v1"));
    expect(cacheKey("a", "m1", "v1")).not.toBe(cacheKey("a", "m2", "v1"));
    expect(cacheKey("a", "m", "v1")).not.toBe(cacheKey("a", "m", "v2"));
    expect(cacheKey("a", "m", "v1")).toMatch(/^[0-9a-f]{64}$/);
  });
});
