// Persona sets for the seeded scenarios. Pure: no I/O, no keys.
// T1 and T2 read the same chain, so their voice wallets must be disjoint (PRD §6.6, DECISIONS.md).
// T3–T6 reuse T1's on-chain transfers, so they have no seed step of their own.

export const PERSONA_COUNT = 14;

// Voice personas per seeded scenario. T1 uses 01–07; T2 uses 08–14.
export const VOICE_SETS: Record<string, readonly number[]> = {
  T1: [1, 2, 3, 4, 5, 6, 7],
  T2: [8, 9, 10, 11, 12, 13, 14],
};

// Personas actually paid (0.002 ETH each) per scenario. Must be voices of that scenario.
export const PAID_SETS: Record<string, readonly number[]> = {
  T1: [1, 2, 3, 4, 5],
  T2: [8],
};

export function personaId(n: number): string {
  return `persona_${String(n).padStart(2, "0")}`;
}

export function personaHandle(n: number): string {
  return `@echt_persona_${String(n).padStart(2, "0")}`;
}

export function voiceNumbers(scenario: string): readonly number[] {
  const voices = VOICE_SETS[scenario];
  if (!voices) throw new Error(`unknown scenario ${scenario}`);
  return voices;
}

export function paidNumbers(scenario: string): readonly number[] {
  const voices = voiceNumbers(scenario);
  const paid = PAID_SETS[scenario];
  if (!paid) throw new Error(`no payment set for scenario ${scenario}`);
  for (const n of paid) {
    if (!voices.includes(n)) throw new Error(`${personaId(n)} is paid in ${scenario} but is not one of its voices`);
  }
  return paid;
}

// The wallets a scenario reads: its voices only, in persona order.
export function scenarioWallets<T extends { id: string }>(scenario: string, wallets: readonly T[]): T[] {
  const ids = new Set(voiceNumbers(scenario).map(personaId));
  return wallets.filter((w) => ids.has(w.id));
}
