// Reads EchtVerdicts.getVerdict for a run id. Read-only.
//   tsx verify-verdict.ts <runId>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readVerdictOnChain } from "../apps/server/src/chain-read.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const runId = process.argv[2];
if (!runId) throw new Error("usage: verify-verdict.ts <runId>");
const addresses = JSON.parse(readFileSync(join(ROOT, "scenarios", "addresses.json"), "utf8").replace(/^\uFEFF/, "")) as { verdicts: { address: string } };
const address = (process.env.ECHT_VERDICTS_ADDRESS ?? addresses.verdicts.address) as `0x${string}`;
const verdict = await readVerdictOnChain(process.env.SEPOLIA_RPC_URL ?? "", address, runId);
console.log(JSON.stringify({ runId, contract: address, ...verdict }, null, 2));
