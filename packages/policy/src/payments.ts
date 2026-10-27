import { parseTime } from "./convergence.ts";
import { POLICY_CONFIG } from "./policy.config.ts";
import type { Transfer } from "./types.ts";

const HOUR_MS = 3_600_000;

export interface SourceMeta {
  txCount: number;
  knownExchange: boolean;
}

/** A converging voice's wallet and what the run knows about its post. */
export interface VoiceWallet {
  personaId: string;
  wallet: string;
  verified: boolean; // signed_challenge attestation
  postedAtMs: number;
  disclosedByPostId: string | null;
}

export type ExclusionReason = "post_dated" | "outside_lookback" | "below_threshold" | "unverified_wallet" | "not_campaign_source";

export interface Exclusion {
  txHash: string;
  personaId: string;
  reason: ExclusionReason;
}

export interface QualifyingTransfer {
  txHash: string;
  from: string;
  personaId: string;
  amountWei: bigint;
}

export interface PaymentAnalysis {
  campaignSources: string[];
  qualifying: QualifyingTransfer[];
  exclusions: Exclusion[];
  linkedPersonaIds: string[];
  verifiedVoiceCount: number;
  exchangeSources: string[];
  missingSourceMeta: string[];
}

/**
 * Interpretation (PRD §6.6 is circular here): a *candidate* is a transfer from any sender into a
 * verified converging wallet, after the post, within the lookback, at or above the threshold.
 * A *campaign source* is a sender whose candidates reach at least `minVoices` distinct voices.
 * *Qualifying* transfers are the candidates from campaign sources.
 */
export function analyzePayments(
  voices: readonly VoiceWallet[],
  transfers: readonly Transfer[],
  sourceMeta: Readonly<Record<string, SourceMeta>>,
): PaymentAnalysis {
  const { lookbackHours, minQualifyingWei, campaignSource } = POLICY_CONFIG;
  const byWallet = new Map(voices.map((v) => [v.wallet.toLowerCase(), v]));
  const exclusions: Exclusion[] = [];
  const candidates: (QualifyingTransfer & { ms: number })[] = [];

  for (const t of transfers) {
    const voice = byWallet.get(t.to.toLowerCase());
    if (!voice) continue;
    const from = t.from.toLowerCase();
    const ms = parseTime(t.timestamp);
    const amountWei = BigInt(t.amountWei);
    const exclude = (reason: ExclusionReason) =>
      exclusions.push({ txHash: t.txHash, personaId: voice.personaId, reason });

    if (!voice.verified) exclude("unverified_wallet");
    else if (ms >= voice.postedAtMs) exclude("post_dated");
    else if (ms < voice.postedAtMs - lookbackHours * HOUR_MS) exclude("outside_lookback");
    else if (amountWei < minQualifyingWei) exclude("below_threshold");
    else candidates.push({ txHash: t.txHash, from, personaId: voice.personaId, amountWei, ms });
  }

  const votersBySender = new Map<string, Set<string>>();
  for (const c of candidates) {
    const set = votersBySender.get(c.from) ?? new Set<string>();
    set.add(c.personaId);
    votersBySender.set(c.from, set);
  }
  const campaignSources = [...votersBySender]
    .filter(([, voters]) => voters.size >= campaignSource.minVoices)
    .map(([from]) => from)
    .sort();
  const campaignSet = new Set(campaignSources);

  const qualifying: QualifyingTransfer[] = [];
  for (const c of candidates) {
    if (campaignSet.has(c.from)) {
      qualifying.push({ txHash: c.txHash, from: c.from, personaId: c.personaId, amountWei: c.amountWei });
    } else {
      exclusions.push({ txHash: c.txHash, personaId: c.personaId, reason: "not_campaign_source" });
    }
  }

  const exchangeSources: string[] = [];
  const missingSourceMeta: string[] = [];
  for (const source of campaignSources) {
    const meta = sourceMeta[source];
    if (meta === undefined) missingSourceMeta.push(source);
    else if (meta.knownExchange || meta.txCount > campaignSource.maxTxCount) exchangeSources.push(source);
  }

  return {
    campaignSources,
    qualifying,
    exclusions,
    linkedPersonaIds: [...new Set(qualifying.map((q) => q.personaId))].sort(),
    verifiedVoiceCount: voices.filter((v) => v.verified).length,
    exchangeSources,
    missingSourceMeta,
  };
}
