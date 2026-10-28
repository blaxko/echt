// The stored run record and the small API the dashboard uses. Two modes:
//  - local: the API server on :8787 (proxied by Vite). Runs can be started.
//  - public: VITE_PUBLIC_DEMO=1. Records are copied into the build, so there is no server and no key.
export interface Voice {
  personaId: string;
  handle: string;
  wallet: string;
  verified: boolean;
  postedAt: string;
  postBlock: number;
  gapHours: number | null;
  paymentTx: string | null;
  linked: boolean;
  disclosed: boolean;
  provenance: string;
}

export interface Transfer {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amountWei: string;
  timestamp: string;
}

export interface RunRecord {
  scenario: string;
  generatedAt?: string;
  label: string;
  dryRun?: boolean;
  verdictTx: string | null;
  runId: string;
  pinnedToBlock: number;
  pinNote?: string;
  policyVersion: string;
  verdict: "BLOCK" | "REVIEW" | "ELIGIBLE";
  reasons: string[];
  linkedPersonaIds: string[];
  marketGate: string;
  finalAction: string;
  proposal: { side: string; sizeUsd: number; stopPct: number; symbol: string; rationale: string };
  voices: Voice[];
  market: { status: string; tool: string; symbol: string; code: string; message: string; traceId: string; source: string };
  provider: { status: string; detail?: string };
  inputs: unknown;
  evidence: Record<string, unknown> & { transfers?: { txHash: string; personaId: string; amountWei: string }[] };
  evidenceHash: string;
  sectionHashes: Record<string, string>;
  cre: string;
}

export const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === "1";

type Fetcher = (url: string) => Promise<Response>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Loads one run record. A missing record is a JSON 404 from the API (or a missing demo file), and that
 * returns null. Anything else (a proxy error, a non-JSON body, a network failure) is retried, and only
 * then reported as an error. This keeps a slow API from looking like "no run recorded".
 */
export async function fetchRecord(scenario: string, fetcher: Fetcher = (u) => fetch(u), attempts = 3, pause = 300): Promise<RunRecord | null> {
  const url = PUBLIC_DEMO ? `${import.meta.env.BASE_URL}demo/runs/${scenario}.json` : `/api/runs/${scenario}/record`;
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetcher(url);
      const type = res.headers.get("content-type") ?? "";
      if (res.status === 404 && (PUBLIC_DEMO || type.includes("application/json"))) return null;
      if (res.ok && type.includes("json")) return (await res.json()) as RunRecord;
      lastError = `record ${scenario}: HTTP ${res.status}${type.includes("json") ? "" : " (not JSON)"}`;
    } catch (error) {
      lastError = `record ${scenario}: ${(error as Error).message}`;
    }
    if (i < attempts - 1) await sleep(pause * (i + 1));
  }
  throw new Error(lastError);
}

export async function startRun(scenario: string): Promise<{ id: string } | { error: string }> {
  const res = await fetch(`/api/runs/${scenario}`, { method: "POST" });
  const body = (await res.json()) as { id?: string; error?: string };
  return res.ok && body.id ? { id: body.id } : { error: body.error ?? `HTTP ${res.status}` };
}
