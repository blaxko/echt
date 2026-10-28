// PRD §9.3. Types only: no runtime behaviour in this file.

export type Provenance = "SYNTHETIC" | "TESTNET" | "LIVE" | "MODEL" | "SIMULATED";

export interface Persona {
  id: string; // "persona_04"
  handle: string; // "@echt_persona_04", synthetic only
  wallet: `0x${string}`;
  attestation: {
    method: "signed_challenge" | "unverified_claim";
    nonce?: string;
    signature?: `0x${string}`;
    challengePostId?: string;
  };
  provenance: "SYNTHETIC";
}

export interface Post {
  id: string;
  personaId: string;
  text: string;
  postedAt: string; // ISO 8601 UTC
  postBlock: number; // nearest Ethereum Sepolia block at postedAt
  provenance: "SYNTHETIC";
}

export interface Extraction {
  postId: string;
  tokenSymbol: string | null;
  sentiment: "bullish" | "bearish" | "neutral";
  conviction: number; // 0..1
  urgency: number; // 0..1
  disclosureDetected: boolean;
  disclosureEvidence: string | null;
  status: "ok" | "extraction_failed";
  modelId: string;
  promptVersion: string;
  provenance: "MODEL";
}

export interface Transfer {
  txHash: `0x${string}`;
  blockNumber: number;
  transactionIndex: number;
  from: `0x${string}`;
  to: `0x${string}`;
  amountWei: string; // native Sepolia ETH, decimal string, no floats
  timestamp: string;
  provenance: "TESTNET";
}

export interface RyoEnvelope {
  tool: "analyze_token" | "deep_analysis";
  status: "ok" | "partial" | "unavailable";
  data_mode: "live" | "mixed" | "simulated" | "unknown";
  as_of: string;
  summary: { headline: string; key_points?: string[] };
  availability: Record<string, unknown>;
  warnings: string[];
  data: unknown; // stored verbatim
  provenance: "LIVE";
}

export type PaymentVerdict = "BLOCK" | "REVIEW" | "ELIGIBLE";
export type MarketGate = "PASS" | "FAIL" | "UNAVAILABLE";
export type FinalAction = "OPEN_PRACTICE_POSITION" | "NO_POSITION";

export type ReasonCode =
  | "THRESHOLD_MET"
  | "NO_QUALIFYING_PATTERN"
  | "DISCLOSED_CAMPAIGN"
  | "INSUFFICIENT_VERIFIED_WALLETS"
  | "PROVIDER_FAILED"
  | "PROVIDER_INCONSISTENT"
  | "EXTRACTION_FAILED"
  | "EXCHANGE_SOURCE"
  | "MARKET_FAIL"
  | "MARKET_UNAVAILABLE"
  | "RISK_LIMIT";

export interface Decision {
  runId: string;
  policyVersion: "echt-policy@2";
  convergence: { token: string; voices: string[]; windowStart: string; windowEnd: string };
  proposal: { side: "long"; sizeUsd: number; stopPct: number; rationale: string };
  linkedVoices: { personaId: string; transfers: string[]; disclosed: boolean }[];
  paymentVerdict: PaymentVerdict;
  reasonCodes: ReasonCode[];
  marketGate: MarketGate;
  finalAction: FinalAction;
  evidenceHash: `0x${string}`;
  pinnedToBlock: number;
  verdictTx?: `0x${string}`;
  creMode: "local_simulation" | "deployed";
}
