import { decideRun, type RunDecision, type RunInput } from "@echt/policy";
import type { RunRecord } from "./api.ts";

// The What-if panel edits a copy of a recorded run's inputs and re-runs the same policy in the browser.
// It never writes a record, never touches the chain, and the recorded verdict stays on screen next to it.
export interface WhatIf {
  /** persona id -> whether a payment from the campaign source is counted. Only recorded payments can be toggled. */
  paid: Record<string, boolean>;
  /** persona id -> whether the voice's post discloses the paid relationship. */
  disclosed: Record<string, boolean>;
  /** The transfer provider is treated as down: the run cannot finish, so the policy gives REVIEW. */
  providerDown: boolean;
}

/** The starting point for a run: each voice's recorded payment and disclosure, and the provider up. */
export function baseWhatIf(input: RunInput): WhatIf {
  const paidWallets = new Set(input.transfers.map((t) => t.to.toLowerCase()));
  return {
    paid: Object.fromEntries(input.voices.map((v) => [v.personaId, paidWallets.has(v.wallet.toLowerCase())])),
    disclosed: Object.fromEntries(input.voices.map((v) => [v.personaId, v.disclosed])),
    providerDown: false,
  };
}

/** Voices with a recorded payment. Only these can be toggled, because a payment cannot be invented. */
export function recordedPaymentVoices(input: RunInput): Set<string> {
  const wallets = new Set(input.transfers.map((t) => t.to.toLowerCase()));
  return new Set(input.voices.filter((v) => wallets.has(v.wallet.toLowerCase())).map((v) => v.personaId));
}

/** The run inputs with the what-if changes applied. The recorded input is not mutated. */
export function applyWhatIf(base: RunInput, w: WhatIf): RunInput {
  const dropWallets = new Set(
    base.voices.filter((v) => w.paid[v.personaId] === false).map((v) => v.wallet.toLowerCase()),
  );
  return {
    ...base,
    providerFailed: w.providerDown,
    voices: base.voices.map((v) => ({ ...v, disclosed: w.disclosed[v.personaId] ?? v.disclosed })),
    transfers: base.transfers.filter((t) => !dropWallets.has(t.to.toLowerCase())),
  };
}

/** Re-run the policy on the what-if inputs. Pure: the same inputs always give the same decision. */
export function runWhatIf(record: RunRecord, w: WhatIf): RunDecision {
  return decideRun(applyWhatIf(record.inputs as RunInput, w));
}

/** The graph's data for a what-if view: links, disclosure and payments as the what-if sets them. The recorded run is not changed. */
export function viewRecord(record: RunRecord, w: WhatIf): RunRecord {
  const d = runWhatIf(record, w);
  const linked = new Set(d.linkedPersonaIds);
  return {
    ...record,
    voices: record.voices.map((v) => ({
      ...v,
      linked: linked.has(v.personaId),
      disclosed: w.disclosed[v.personaId] ?? v.disclosed,
      paymentTx: w.paid[v.personaId] === false ? null : v.paymentTx,
    })),
  };
}
