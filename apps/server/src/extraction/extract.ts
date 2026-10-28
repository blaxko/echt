// F2 (PRD §6.2): the LLM reads one post into structured fields. Models extract; policy decides (CLAUDE.md §9).
// JSON mode through the openai SDK, zod validation, one retry, then extraction_failed. Results are cached by
// sha256(text + model + promptVersion), so each post is read once. Only synthetic persona posts go here.

import { createHash } from "node:crypto";
import { z } from "zod";

export const PROMPT_VERSION = "extract-v1";

export const ExtractionSchema = z.object({
  token: z.string().nullable(),
  sentiment: z.enum(["bullish", "bearish", "neutral"]),
  conviction: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  disclosure_detected: z.boolean(),
  disclosure_evidence: z.string().nullable(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export type ExtractionResult =
  | { status: "ok"; extraction: Extraction; cached: boolean }
  | { status: "extraction_failed"; error: string; cached: false };

export interface ChatClient {
  complete(args: { model: string; system: string; user: string }): Promise<string>;
}

export interface ExtractionCache {
  get(key: string): Extraction | undefined;
  set(key: string, value: Extraction): void;
}

export const SYSTEM_PROMPT = `You read one social media post about a crypto token and return only a JSON object with these keys:
- "token": the ticker the post is about (for example "ETH"), or null if none.
- "sentiment": "bullish", "bearish" or "neutral", describing the post's stance toward the token.
- "conviction": a number from 0 to 1, how strongly the author states the view.
- "urgency": a number from 0 to 1, how strongly the post pushes readers to act now.
- "disclosure_detected": true only if the post itself states a paid, sponsored, affiliate, partnership or #ad relationship. Otherwise false.
- "disclosure_evidence": the exact phrase from the post that shows the disclosure, or null.
Do not judge legality. Do not infer a relationship the post does not state. Return JSON only.`;

export function cacheKey(text: string, model: string, promptVersion = PROMPT_VERSION): string {
  return createHash("sha256").update(text + model + promptVersion).digest("hex");
}

function parseAndValidate(raw: string): Extraction {
  const json: unknown = JSON.parse(raw);
  return ExtractionSchema.parse(json);
}

/** One post. A cache hit makes no model call. Otherwise: one call, one retry on bad JSON or a schema failure. */
export async function extractPost(
  client: ChatClient,
  cache: ExtractionCache,
  text: string,
  model: string,
): Promise<ExtractionResult> {
  const key = cacheKey(text, model);
  const hit = cache.get(key);
  if (hit) return { status: "ok", extraction: hit, cached: true };

  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await client.complete({ model, system: SYSTEM_PROMPT, user: text });
      const extraction = parseAndValidate(raw);
      cache.set(key, extraction);
      return { status: "ok", extraction, cached: false };
    } catch (error) {
      lastError = `attempt ${attempt}: ${(error as Error).message}`;
    }
  }
  return { status: "extraction_failed", error: lastError, cached: false };
}

/** The openai SDK against any OpenAI-compatible endpoint, set by LLM_BASE_URL and LLM_API_KEY. */
export async function openAiChatClient(baseURL: string, apiKey: string): Promise<ChatClient> {
  const { default: OpenAI } = await import("openai");
  const sdk = new OpenAI({ baseURL, apiKey });
  return {
    async complete({ model, system, user }) {
      const res = await sdk.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const content = res.choices[0]?.message?.content;
      if (!content) throw new Error("empty model reply");
      return content;
    },
  };
}
