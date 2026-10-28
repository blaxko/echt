// Pure helpers for the ping trigger. Kept out of main.ts: javy exports every top-level
// function of the entry module, and the CRE WASM build rejects exports with parameters.
/** Trigger payload for the Task 9 ping. Validated by hand: no zod inside the workflow. */
export type PingRequest = {
  runId: string;
  address: string;
  startBlock: number;
  endBlock: number;
};

/** The only fields the policy needs from an Etherscan txlist row (PRD FR5.3). */
export type TxlistSummary = {
  status: string;
  message: string;
  count: number;
  hashes: string[];
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function parsePingRequest(raw: unknown): PingRequest {
  if (typeof raw !== "object" || raw === null) throw new Error("payload must be a JSON object");
  const r = raw as Record<string, unknown>;
  if (typeof r.runId !== "string" || r.runId.length === 0) throw new Error("runId must be a non-empty string");
  if (typeof r.address !== "string" || !ADDRESS.test(r.address)) throw new Error("address must be 0x + 40 hex");
  if (!Number.isSafeInteger(r.startBlock) || !Number.isSafeInteger(r.endBlock)) {
    throw new Error("startBlock and endBlock must be integers");
  }
  const startBlock = r.startBlock as number;
  const endBlock = r.endBlock as number;
  if (startBlock < 0 || endBlock < startBlock) throw new Error("need 0 <= startBlock <= endBlock");
  return { runId: r.runId, address: r.address.toLowerCase(), startBlock, endBlock };
}

/**
 * Etherscan V2 envelope: { status: "1" | "0", message, result }.
 * "No transactions found" is a valid empty answer. "NOTOK" means the call failed (bad key, rate limit).
 */
export function summarizeTxlist(body: unknown): TxlistSummary {
  if (typeof body !== "object" || body === null) throw new Error("etherscan body is not an object");
  const b = body as { status?: unknown; message?: unknown; result?: unknown };
  const status = String(b.status ?? "");
  const message = String(b.message ?? "");
  if (message === "NOTOK") throw new Error("etherscan returned NOTOK");
  const rows = Array.isArray(b.result) ? (b.result as { hash?: unknown }[]) : [];
  const hashes = rows.map((row) => String(row.hash ?? "")).sort();
  return { status, message, count: rows.length, hashes };
}

