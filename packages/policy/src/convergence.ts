import { POLICY_CONFIG } from "./policy.config.ts";
import type { Extraction, Post } from "./types.ts";

const HOUR_MS = 3_600_000;

export interface ConvergingVoice {
  personaId: string;
  postId: string;
  postedAtMs: number;
}

export type ConvergenceResult =
  | { status: "IDLE" }
  | {
      status: "CONVERGED";
      token: string;
      voices: ConvergingVoice[];
      windowStartMs: number;
      windowEndMs: number;
      /** Posts inside the window whose extraction failed or is missing. Any of them forces REVIEW. */
      extractionFailedPostIds: string[];
    };

export function parseTime(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`invalid ISO timestamp: ${iso}`);
  return ms;
}

/**
 * PRD §6.3: at least `minVoices` distinct personas, bullish, on the same token, inside a
 * `windowHours` window. Each persona counts once, at its earliest bullish post in the window.
 * Picks the token and window with the most voices; ties go to the alphabetically first token.
 */
export function detectConvergence(posts: readonly Post[], extractions: readonly Extraction[]): ConvergenceResult {
  const { minVoices, windowHours } = POLICY_CONFIG.convergence;
  const windowMs = windowHours * HOUR_MS;
  const extractionByPost = new Map(extractions.map((e) => [e.postId, e]));

  const bullishByToken = new Map<string, { postId: string; personaId: string; ms: number }[]>();
  for (const post of posts) {
    const ex = extractionByPost.get(post.id);
    if (!ex || ex.status !== "ok" || ex.sentiment !== "bullish" || ex.tokenSymbol === null) continue;
    const list = bullishByToken.get(ex.tokenSymbol) ?? [];
    list.push({ postId: post.id, personaId: post.personaId, ms: parseTime(post.postedAt) });
    bullishByToken.set(ex.tokenSymbol, list);
  }

  let best: { token: string; voices: ConvergingVoice[]; startMs: number } | null = null;
  for (const token of [...bullishByToken.keys()].sort()) {
    const entries = [...bullishByToken.get(token)!].sort((a, b) => a.ms - b.ms || a.postId.localeCompare(b.postId));
    for (const start of entries) {
      const end = start.ms + windowMs;
      const seen = new Map<string, ConvergingVoice>();
      for (const entry of entries) {
        if (entry.ms < start.ms || entry.ms > end || seen.has(entry.personaId)) continue;
        seen.set(entry.personaId, { personaId: entry.personaId, postId: entry.postId, postedAtMs: entry.ms });
      }
      const voices = [...seen.values()];
      if (voices.length >= minVoices && (best === null || voices.length > best.voices.length)) {
        best = { token, voices, startMs: start.ms };
      }
    }
  }

  if (best === null) return { status: "IDLE" };

  const windowStartMs = best.startMs;
  const windowEndMs = best.startMs + windowMs;
  const extractionFailedPostIds = posts
    .filter((post) => {
      const ms = parseTime(post.postedAt);
      if (ms < windowStartMs || ms > windowEndMs) return false;
      return extractionByPost.get(post.id)?.status !== "ok";
    })
    .map((post) => post.id)
    .sort();

  return {
    status: "CONVERGED",
    token: best.token,
    voices: best.voices.sort((a, b) => a.postedAtMs - b.postedAtMs || a.personaId.localeCompare(b.personaId)),
    windowStartMs,
    windowEndMs,
    extractionFailedPostIds,
  };
}
