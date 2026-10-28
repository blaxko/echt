// Runs F2 on the synthetic scenario posts and commits the results.
//   . .\scripts\load-env.ps1 ; cd scripts ; npx tsx extract-posts.ts
// Reads LLM_BASE_URL, LLM_API_KEY and LLM_MODEL from the environment. Writes:
//   scenarios/extractions/cache/<sha256>.json   one file per post (committed; cached reads make no call)
//   scenarios/extractions/<scenario>.json       per-scenario results, labelled MODEL
// Only synthetic persona posts are sent. Nothing else leaves the machine.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cacheKey,
  extractPost,
  openAiChatClient,
  PROMPT_VERSION,
  type Extraction,
  type ExtractionCache,
} from "../apps/server/src/extraction/extract.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const POSTS = join(ROOT, "scenarios", "posts");
const OUT = join(ROOT, "scenarios", "extractions");
const CACHE = join(OUT, "cache");
const PAUSE_MS = 2000; // Groq's free tier allows about 30 requests per minute

const baseURL = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;
if (!baseURL || !apiKey || !model) throw new Error("LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set (load-env first)");

mkdirSync(CACHE, { recursive: true });
const cache: ExtractionCache = {
  get(key) {
    const path = join(CACHE, `${key}.json`);
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { extraction: Extraction }).extraction : undefined;
  },
  set(key, value) {
    writeFileSync(join(CACHE, `${key}.json`), JSON.stringify({ key, model, promptVersion: PROMPT_VERSION, label: "MODEL", extraction: value }, null, 2) + "\n");
  },
};

const client = await openAiChatClient(baseURL, apiKey);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const scenario of ["T1", "T2", "T3"]) {
  const file = JSON.parse(readFileSync(join(POSTS, `${scenario}.json`), "utf8")) as { posts: { id: string; personaId: string; text: string }[] };
  const results = [];
  for (const post of file.posts) {
    const result = await extractPost(client, cache, post.text, model);
    if (result.status === "ok" && !result.cached) await sleep(PAUSE_MS);
    results.push({
      postId: post.id,
      personaId: post.personaId,
      text: post.text,
      cacheKey: cacheKey(post.text, model),
      label: "MODEL",
      status: result.status,
      cached: result.cached,
      extraction: result.status === "ok" ? result.extraction : null,
      error: result.status === "extraction_failed" ? result.error : null,
    });
    console.log(`${scenario} ${post.id}: ${result.status}${result.cached ? " (cached)" : ""}`);
  }
  writeFileSync(join(OUT, `${scenario}.json`), JSON.stringify({ scenario, model, promptVersion: PROMPT_VERSION, label: "MODEL", results }, null, 2) + "\n");
}
