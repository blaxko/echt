// Builds the scenario files and fills their post blocks once each post time has passed.
//   tsx scenario-posts.ts build   writes scenarios/T1-coordinated.json and T2-unrelated.json, postBlock null
//   tsx scenario-posts.ts fill    sets postBlock from RPC for posts whose time has passed; future posts stay null
// Offline except `fill`. Reads public data only (addresses, attestations); never reads wallets.local.json keys.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, type Hex, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { checkPostTiming, personaHandle, personaId, voiceNumbers } from "./scenario-plan.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SCENARIOS_DIR = join(ROOT, "scenarios");
const ADDRESSES_FILE = join(SCENARIOS_DIR, "addresses.json");
const ATTESTATIONS_FILE = join(SCENARIOS_DIR, "attestations.json");
const CHAIN_ID = 11155111;

// First post of each scenario; the rest step one minute apart. Each one sits 8–14 h after its payment.
const SCHEDULE: Record<string, { file: string; runId: string; title: string; firstPostUtc: string }> = {
  T1: {
    file: "T1-coordinated.json",
    runId: "t1-coordinated",
    title: "Coordinated linked transfers: 5 of 7 voices paid from one source, no disclosure",
    firstPostUtc: "2026-10-28T16:00:00Z",
  },
  T2: {
    file: "T2-unrelated.json",
    runId: "t2-unrelated",
    title: "Unrelated voices: 1 of 7 paid from the same source",
    firstPostUtc: "2026-10-28T16:10:00Z",
  },
};

interface Payment {
  personaId: string;
  txHash: Hex;
  blockNumber: number;
  blockTimestamp: number;
}

interface Attestation {
  personaId: string;
  wallet: Hex;
  nonce: string;
  signature: Hex;
  challengePostId: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// Post text comes from scenarios/posts/<scenario>.json, the same texts the extraction reads.
function postText(scenario: string, personaId: string): string {
  const file = readJson<{ posts: { personaId: string; text: string }[] }>(join(SCENARIOS_DIR, "posts", `${scenario}.json`));
  const post = file.posts.find((p) => p.personaId === personaId);
  if (!post) throw new Error(`no post text for ${personaId} in ${scenario}`);
  return post.text;
}

function build(): void {
  const addresses = readJson<{ campaignSource: Hex; payments: Record<string, Payment[]> }>(ADDRESSES_FILE);
  const { attestations } = readJson<{ attestations: Attestation[] }>(ATTESTATIONS_FILE);
  const attestationById = new Map(attestations.map((a) => [a.personaId, a]));

  for (const [scenario, spec] of Object.entries(SCHEDULE)) {
    const payments = addresses.payments[scenario] ?? [];
    const firstPost = Date.parse(spec.firstPostUtc);
    const voices = voiceNumbers(scenario).map((n, i) => {
      const id = personaId(n);
      const att = attestationById.get(id);
      if (!att) throw new Error(`no attestation for ${id}. Run sign:attestations first.`);
      return {
        personaId: id,
        handle: personaHandle(n),
        wallet: att.wallet,
        attestation: { method: "signed_challenge", nonce: att.nonce, signature: att.signature, challengePostId: att.challengePostId },
        postedAt: new Date(firstPost + i * 60_000).toISOString(),
        provenance: "SYNTHETIC",
      };
    });

    const timing = checkPostTiming(
      payments.map((p) => ({ personaId: p.personaId, blockTimestampMs: p.blockTimestamp * 1000 })),
      voices.map((v) => ({ personaId: v.personaId, postedAtMs: Date.parse(v.postedAt) })),
    );
    if (timing.length > 0) throw new Error(`${scenario} timing rule broken:\n  ${timing.join("\n  ")}`);

    const file = {
      id: scenario,
      title: spec.title,
      provenance: "TESTNET",
      chainId: CHAIN_ID,
      input: {
        runId: spec.runId,
        tokenSymbol: "ETH", // placeholder until RYO returns a symbol with status ok (DECISIONS.md)
        campaignSource: addresses.campaignSource,
        voices: voices.map(({ postedAt: _unused, ...v }) => v),
        posts: voices.map((v) => ({
          id: `post_${v.personaId}`,
          personaId: v.personaId,
          text: postText(scenario, v.personaId),
          postedAt: v.postedAt,
          postBlock: null,
          provenance: "SYNTHETIC",
        })),
        payments: payments.map((p) => ({
          personaId: p.personaId,
          txHash: p.txHash,
          blockNumber: p.blockNumber,
          blockTimestamp: p.blockTimestamp,
        })),
      },
      expected: scenario === "T1"
        ? { paymentVerdict: "BLOCK", reason: "THRESHOLD_MET", convergingCount: 7, linkedCount: 5 }
        : { paymentVerdict: "ELIGIBLE", reason: "NO_QUALIFYING_PATTERN", convergingCount: 7, linkedCount: 0 },
    };
    writeFileSync(join(SCENARIOS_DIR, spec.file), JSON.stringify(file, null, 2) + "\n");
    console.log(`wrote scenarios/${spec.file} (${voices.length} voices, ${payments.length} payments, postBlock null)`);
  }
}

// Last block whose timestamp is at or before `targetSec`. Binary search over the chain.
async function blockAtOrBefore(client: PublicClient, targetSec: number): Promise<bigint> {
  let lo = 0n;
  let hi = await client.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (Number(block.timestamp) <= targetSec) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

async function fill(): Promise<void> {
  const rpc = process.env.SEPOLIA_RPC_URL;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL must be set (load-env first)");
  const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
  if ((await client.getChainId()) !== CHAIN_ID) throw new Error("refusing: RPC is not Ethereum Sepolia");

  const now = Date.now();
  const latest = await client.getBlock();
  for (const spec of Object.values(SCHEDULE)) {
    const path = join(SCENARIOS_DIR, spec.file);
    if (!existsSync(path)) {
      console.log(`${spec.file} not built yet. Run build first.`);
      continue;
    }
    const file = readJson<{ input: { posts: { id: string; postedAt: string; postBlock: number | null }[] } }>(path);
    for (const post of file.input.posts) {
      if (post.postBlock !== null) continue;
      const postedMs = Date.parse(post.postedAt);
      if (postedMs > now || Number(latest.timestamp) * 1000 < postedMs) {
        console.log(`${post.id}: due ${post.postedAt}; not yet, postBlock stays null`);
        continue;
      }
      post.postBlock = Number(await blockAtOrBefore(client, postedMs / 1000));
      console.log(`${post.id}: postBlock ${post.postBlock} (last block at or before ${post.postedAt})`);
    }
    writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  }
}

const command = process.argv[2];
if (command === "build") build();
else if (command === "fill") await fill();
else {
  console.log("usage: scenario-posts.ts build | fill");
  process.exitCode = 1;
}
