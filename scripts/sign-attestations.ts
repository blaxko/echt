// Signs `echt:{handle}:{nonce}` with each persona wallet (PRD §6.6 signed_challenge).
// Offline: no network, no spend. Output is public (addresses, nonces, signatures) and committed.
//   tsx sign-attestations.ts   signs personas that have no attestation yet; existing entries are kept unchanged

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMessage, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WALLETS_FILE = join(ROOT, "scenarios", "wallets.local.json");
const OUT_FILE = join(ROOT, "scenarios", "attestations.json");

interface Attestation {
  personaId: string;
  handle: string;
  wallet: Hex;
  method: "signed_challenge";
  nonce: string;
  signature: Hex;
  challengePostId: string;
  provenance: "SYNTHETIC";
}

const existing: { message: string; attestations: Attestation[] } = existsSync(OUT_FILE)
  ? (JSON.parse(readFileSync(OUT_FILE, "utf8")) as { message: string; attestations: Attestation[] })
  : { message: "echt:{handle}:{nonce}", attestations: [] };
const attested = new Set(existing.attestations.map((a) => a.personaId));

const { personas } = JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as {
  personas: { id: string; handle: string; privateKey: Hex; address: Hex }[];
};

const added: Attestation[] = [];
for (const p of personas) {
  if (attested.has(p.id)) continue;
  const account = privateKeyToAccount(p.privateKey);
  const nonce = randomBytes(8).toString("hex");
  const message = `echt:${p.handle}:${nonce}`;
  const signature = await account.signMessage({ message });
  const ok = await verifyMessage({ address: account.address, message, signature });
  if (!ok) throw new Error(`signature check failed for ${p.id}`);
  added.push({
    personaId: p.id,
    handle: p.handle,
    wallet: account.address,
    method: "signed_challenge",
    nonce,
    signature,
    challengePostId: `challenge_${p.id}`,
    provenance: "SYNTHETIC",
  });
  console.log(`${p.id}  ${p.address}  signed, verified`);
}

if (added.length === 0) {
  console.log("every persona already has an attestation. Nothing written.");
} else {
  const attestations = [...existing.attestations, ...added].sort((a, b) => a.personaId.localeCompare(b.personaId));
  writeFileSync(OUT_FILE, JSON.stringify({ message: existing.message, attestations }, null, 2) + "\n");
  console.log(`added ${added.length} attestations; ${attestations.length} in scenarios/attestations.json`);
}
