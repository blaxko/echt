import type { EvaluationInput } from "../src/evaluate.ts";
import type { Extraction, Persona, Post, Transfer } from "../src/types.ts";

// Test-only builders. Synthetic data: personas are `@echt_persona_NN`, wallets are generated.
const BASE_MS = Date.parse("2026-10-29T12:00:00Z");
const hex = (n: bigint, bytes: number) => n.toString(16).padStart(bytes * 2, "0");

export const SOURCE = `0x${hex(0xcafen, 20)}` as const;

export function persona(n: number, verified: boolean): Persona {
  return {
    id: `persona_${String(n).padStart(2, "0")}`,
    handle: `@echt_persona_${String(n).padStart(2, "0")}`,
    wallet: `0x${hex(BigInt(0x1000 + n), 20)}`,
    attestation: verified
      ? { method: "signed_challenge", nonce: `n${n}`, signature: `0x${hex(1n, 65)}` }
      : { method: "unverified_claim" },
    provenance: "SYNTHETIC",
  };
}

/** Bullish post for persona n, `minutesAfterBase` minutes after BASE. */
export function bullishPost(n: number, minutesAfterBase: number, disclosed = false): {
  post: Post;
  extraction: Extraction;
} {
  const id = `post_${n}_${minutesAfterBase}`;
  const postedAtMs = BASE_MS + minutesAfterBase * 60_000;
  return {
    post: {
      id,
      personaId: `persona_${String(n).padStart(2, "0")}`,
      text: "synthetic test post",
      postedAt: new Date(postedAtMs).toISOString(),
      postBlock: 0,
      provenance: "SYNTHETIC",
    },
    extraction: {
      postId: id,
      tokenSymbol: "ETH",
      sentiment: "bullish",
      conviction: 0.8,
      urgency: 0.5,
      disclosureDetected: disclosed,
      disclosureEvidence: disclosed ? "#ad" : null,
      status: "ok",
      modelId: "test-model",
      promptVersion: "test",
      provenance: "MODEL",
    },
  };
}

export function transferTo(
  n: number,
  opts: { index: number; hoursBeforePost: number; amountWei?: string; from?: string },
): Transfer {
  const postMs = BASE_MS + n * 60_000; // matches bullishPost(n, n) in the builders below
  return {
    txHash: `0x${hex(BigInt(n * 1000 + opts.index + 1), 32)}`,
    blockNumber: 18_400_000 + n,
    transactionIndex: opts.index,
    from: (opts.from ?? SOURCE) as `0x${string}`,
    to: `0x${hex(BigInt(0x1000 + n), 20)}`,
    amountWei: opts.amountWei ?? "2000000000000000",
    timestamp: new Date(postMs - opts.hoursBeforePost * 3_600_000).toISOString(),
    provenance: "TESTNET",
  };
}

/** Seven bullish voices within one hour, all verified, five of them paid from one source. */
export function t1Input(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  const personas = [1, 2, 3, 4, 5, 6, 7].map((n) => persona(n, true));
  const posts: Post[] = [];
  const extractions: Extraction[] = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const bullish = bullishPost(n, n);
    posts.push(bullish.post);
    extractions.push(bullish.extraction);
  }
  const transfers = [1, 2, 3, 4, 5].map((n, i) => transferTo(n, { index: i, hoursBeforePost: 11 }));
  return {
    runId: "test-run",
    posts,
    extractions,
    personas,
    transfers,
    sourceMeta: { [SOURCE]: { txCount: 42, knownExchange: false } },
    provider: "ok",
    market: {
      kind: "envelope",
      status: "ok",
      dataMode: "live",
      verdict: "neutral",
      primarySectionsAvailable: true,
    },
    ...overrides,
  };
}
