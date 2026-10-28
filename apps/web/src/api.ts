// Types for the stored run record and the small API the dashboard uses. Everything the page shows comes from here.
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

export async function fetchRecord(scenario: string): Promise<RunRecord | null> {
  const res = await fetch(`/api/runs/${scenario}/record`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`record ${scenario}: HTTP ${res.status}`);
  return (await res.json()) as RunRecord;
}

export async function startRun(scenario: string): Promise<{ id: string } | { error: string }> {
  const res = await fetch(`/api/runs/${scenario}`, { method: "POST" });
  const body = (await res.json()) as { id?: string; error?: string };
  return res.ok && body.id ? { id: body.id } : { error: body.error ?? `HTTP ${res.status}` };
}
