// Generates the persona wallets and (with --confirm) seeds scenario payments on Ethereum Sepolia.
//   tsx scripts/seed-testnet.ts --generate-only          no network, no spend
//   tsx scripts/seed-testnet.ts --scenario T1            dry run: prints the plan and cost, sends nothing
//   tsx scripts/seed-testnet.ts --scenario T1 --confirm  broadcasts the payments (after your OK)
// Keys come only from process.env. wallets.local.json is gitignored and never printed.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WALLETS_FILE = join(ROOT, "scenarios", "wallets.local.json");
const ADDRESSES_FILE = join(ROOT, "scenarios", "addresses.json");

const PERSONA_COUNT = 7;
const AMOUNT_WEI = parseEther("0.002");
const MIN_CAMPAIGN_BALANCE_WEI = parseEther("0.02");
const LOOKBACK_MS = 72 * 3_600_000;
const SAFE_GAP_MS = 11 * 3_600_000; // the post sits about 11 h after its payment (8–14 h)
// Personas paid in each scenario. T1 uses 1–5. T2 uses 6, which is outside T1's five.
const SCENARIO_PERSONAS: Record<string, number[]> = { T1: [1, 2, 3, 4, 5], T2: [6] };

interface PersonaWallet {
  id: string;
  handle: string;
  privateKey: Hex;
  address: Hex;
}

const args = new Set(process.argv.slice(2));
const scenarioArg = process.argv[process.argv.indexOf("--scenario") + 1];

function personaId(n: number): string {
  return `persona_${String(n).padStart(2, "0")}`;
}

function loadWallets(): PersonaWallet[] {
  if (!existsSync(WALLETS_FILE)) throw new Error("wallets.local.json not found: run with --generate-only first");
  const parsed = JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as { personas: PersonaWallet[] };
  return parsed.personas;
}

function generateWallets(): void {
  if (existsSync(WALLETS_FILE)) {
    console.log("wallets.local.json already exists. Refusing to overwrite persona keys.");
    process.exitCode = 1;
    return;
  }
  const personas = Array.from({ length: PERSONA_COUNT }, (_, i) => {
    const n = i + 1;
    const privateKey = generatePrivateKey();
    return {
      id: personaId(n),
      handle: `@echt_persona_${String(n).padStart(2, "0")}`,
      privateKey,
      address: privateKeyToAccount(privateKey).address,
    };
  });
  writeFileSync(WALLETS_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), personas }, null, 2) + "\n");
  console.log(`wrote ${PERSONA_COUNT} persona wallets to scenarios/wallets.local.json (keys not printed)`);
  for (const p of personas) console.log(`${p.id}  ${p.handle}  ${p.address}`);
}

async function seedScenario(scenario: string): Promise<void> {
  const personaNumbers = SCENARIO_PERSONAS[scenario];
  if (!personaNumbers) throw new Error(`unknown scenario ${scenario}`);
  const rpc = process.env.SEPOLIA_RPC_URL;
  const campaignKey = process.env.CAMPAIGN_PRIVATE_KEY?.trim();
  if (!rpc || !campaignKey) throw new Error("SEPOLIA_RPC_URL and CAMPAIGN_PRIVATE_KEY must be set (load-env first)");

  const wallets = loadWallets();
  const targets = personaNumbers.map((n) => {
    const w = wallets.find((x) => x.id === personaId(n));
    if (!w) throw new Error(`no wallet for ${personaId(n)}`);
    return w;
  });

  const account = privateKeyToAccount(campaignKey.startsWith("0x") ? (campaignKey as Hex) : (`0x${campaignKey}` as Hex));
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc) });

  if ((await publicClient.getChainId()) !== 11155111) throw new Error("refusing: not Ethereum Sepolia");

  const addresses = existsSync(ADDRESSES_FILE)
    ? (JSON.parse(readFileSync(ADDRESSES_FILE, "utf8")) as Record<string, unknown>)
    : {};
  const existing = (addresses.payments as Record<string, unknown[]> | undefined)?.[scenario];
  if (existing && existing.length > 0) {
    throw new Error(`${scenario} payments already recorded in addresses.json. Refusing to pay twice.`);
  }

  if (scenario === "T2") {
    const t1 = ((addresses.payments as Record<string, { blockTimestamp: number }[]> | undefined)?.T1 ?? []);
    if (t1.length === 0) throw new Error("T2 must be seeded after T1, so the T1 history is outside the T2 lookback");
    const latestT1 = Math.max(...t1.map((p) => p.blockTimestamp)) * 1000;
    const earliestSafe = latestT1 + LOOKBACK_MS + SAFE_GAP_MS;
    if (Date.now() < earliestSafe) {
      throw new Error(
        `T2 is blocked until ${new Date(earliestSafe).toISOString()}: T1's payments would fall inside T2's 72 h lookback.`,
      );
    }
  }

  const balance = await publicClient.getBalance({ address: account.address });
  const gasPrice = await publicClient.getGasPrice();
  const transferGas = 21_000n;
  const totalTransfers = AMOUNT_WEI * BigInt(targets.length);
  const totalGas = transferGas * BigInt(targets.length) * gasPrice;

  console.log(`scenario         ${scenario}`);
  console.log(`campaign source  ${account.address}  balance ${formatEther(balance)} ETH`);
  console.log(`payments         ${targets.length} × ${formatEther(AMOUNT_WEI)} ETH = ${formatEther(totalTransfers)} ETH`);
  console.log(`gas (estimated)  ${formatEther(totalGas)} ETH at ${gasPrice} wei/gas`);
  console.log(`total            ≈ ${formatEther(totalTransfers + totalGas)} ETH`);
  for (const t of targets) console.log(`  -> ${t.id}  ${t.address}`);

  if (balance < MIN_CAMPAIGN_BALANCE_WEI) throw new Error("campaign balance is below 0.02 ETH. Stopping.");
  if (!args.has("--confirm")) {
    console.log("dry run only. Nothing was sent. Re-run with --confirm after approval.");
    return;
  }

  const payments: Record<string, unknown>[] = [];
  for (const t of targets) {
    const hash = await walletClient.sendTransaction({ to: t.address, value: AMOUNT_WEI });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    payments.push({
      personaId: t.id,
      to: t.address,
      amountWei: AMOUNT_WEI.toString(),
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      blockTimestamp: Number(block.timestamp),
      status: receipt.status,
    });
    console.log(`sent ${t.id}  ${hash}  block ${receipt.blockNumber}  ${receipt.status}`);
  }

  const paymentsByScenario = { ...((addresses.payments as Record<string, unknown>) ?? {}), [scenario]: payments };
  writeFileSync(
    ADDRESSES_FILE,
    JSON.stringify({ ...addresses, chainId: 11155111, campaignSource: account.address, payments: paymentsByScenario }, null, 2) + "\n",
  );
  console.log(`recorded ${payments.length} payments in scenarios/addresses.json`);
}

if (args.has("--generate-only")) generateWallets();
else if (scenarioArg) await seedScenario(scenarioArg);
else {
  console.log("usage: --generate-only | --scenario T1 [--confirm] | --scenario T2 [--confirm]");
  process.exitCode = 1;
}
