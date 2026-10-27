// Signs `echt:{handle}:{nonce}` with each persona wallet (PRD §6.6 signed_challenge).
// Offline: no network, no spend. Output is public (addresses, nonces, signatures) and committed.
//   tsx scripts/sign-attestations.ts            writes scenarios/attestations.json (refuses to overwrite)

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMessage, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WALLETS_FILE = join(ROOT, "scenarios", "wallets.local.json");
const OUT_FILE = join(ROOT, "scenarios", "attestations.json");

if (existsSync(OUT_FILE)) {
  console.log("scenarios/attestations.json already exists. Refusing to overwrite signed attestations.");
  process.exitCode = 1;
} else {
  const { personas } = JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as {
    personas: { id: string; handle: string; privateKey: Hex; address: Hex }[];
  };

  const attestations = [];
  for (const p of personas) {
    const account = privateKeyToAccount(p.privateKey);
    const nonce = randomBytes(8).toString("hex");
    const message = `echt:${p.handle}:${nonce}`;
    const signature = await account.signMessage({ message });
    const ok = await verifyMessage({ address: account.address, message, signature });
    if (!ok) throw new Error(`signature check failed for ${p.id}`);
    attestations.push({
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

  writeFileSync(OUT_FILE, JSON.stringify({ message: "echt:{handle}:{nonce}", attestations }, null, 2) + "\n");
  console.log(`wrote ${attestations.length} attestations to scenarios/attestations.json`);
}
