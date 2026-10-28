// Generates persona wallets and (with --confirm) seeds scenario payments on Ethereum Sepolia.
//   tsx seed-testnet.ts --generate-only          adds any missing personas 01–14; no network, no spend
//   tsx seed-testnet.ts --scenario T1            dry run: prints the plan and cost, sends nothing
//   tsx seed-testnet.ts --scenario T1 --confirm  broadcasts the payments
// Keys come only from process.env. wallets.local.json is gitignored and never printed.
// Spend guards (CLAUDE.md §11): chain id checked before every send; campaign spend capped at
// 0.02 ETH for the whole build; campaign balance kept ≥ 0.005 ETH after each send.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PERSONA_COUNT, paidNumbers, personaHandle, personaId, scenarioWallets } from "./scenario-plan.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WALLETS_FILE = join(ROOT, "scenarios", "wallets.local.json");
const ADDRESSES_FILE = join(ROOT, "scenarios", "addresses.json");

const CHAIN_ID = 11155111;
const AMOUNT_WEI = parseEther("0.002");
const CAMPAIGN_CAP_WEI = parseEther("0.02");
const CAMPAIGN_FLOOR_WEI = parseEther("0.005");
const TRANSFER_GAS = 21_000n;

interface PersonaWallet {
  id: string;
  handle: string;
  privateKey: Hex;
  address: Hex;
}

interface WalletFile {
  generatedAt: string;
  updatedAt?: string;
  personas: PersonaWallet[];
}

interface Payment {
  personaId: string;
  to: Hex;
  amountWei: string;
  gasWei: string;
  txHash: Hex;
  blockNumber: number;
  blockTimestamp: number;
  status: string;
}

type Addresses = { payments?: Record<string, Payment[]> } & Record<string, unknown>;

const args = new Set(process.argv.slice(2));
const scenarioArg = process.argv[process.argv.indexOf("--scenario") + 1];

function readWalletFile(): WalletFile | null {
  return existsSync(WALLETS_FILE) ? (JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as WalletFile) : null;
}

function loadWallets(): PersonaWallet[] {
  const file = readWalletFile();
  if (!file) throw new Error("wallets.local.json not found: run with --generate-only first");
  return file.personas;
}

function readAddresses(): Addresses {
  return existsSync(ADDRESSES_FILE) ? (JSON.parse(readFileSync(ADDRESSES_FILE, "utf8")) as Addresses) : {};
}

function generateWallets(): void {
  const file = readWalletFile();
  const existing = file?.personas ?? [];
  const have = new Set(existing.map((p) => p.id));
  const missing = Array.from({ length: PERSONA_COUNT }, (_, i) => i + 1).filter((n) => !have.has(personaId(n)));
  if (missing.length === 0) {
    console.log(`all ${PERSONA_COUNT} personas already exist in wallets.local.json. Nothing generated.`);
    return;
  }
  // Existing keys are kept exactly as they are. Only missing personas get new keys.
  const added = missing.map((n) => {
    const privateKey = generatePrivateKey();
    return { id: personaId(n), handle: personaHandle(n), privateKey, address: privateKeyToAccount(privateKey).address };
  });
  const personas = [...existing, ...added].sort((a, b) => a.id.localeCompare(b.id));
  const out: WalletFile = {
    generatedAt: file?.generatedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    personas,
  };
  writeFileSync(WALLETS_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`added ${added.length} persona wallets to scenarios/wallets.local.json (keys not printed)`);
  for (const p of added) console.log(`${p.id}  ${p.handle}  ${p.address}`);
}

async function seedScenario(scenario: string): Promise<void> {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const campaignKey = process.env.CAMPAIGN_PRIVATE_KEY?.trim();
  if (!rpc || !campaignKey) throw new Error("SEPOLIA_RPC_URL and CAMPAIGN_PRIVATE_KEY must be set (load-env first)");

  const voices = scenarioWallets(scenario, loadWallets());
  const targets = paidNumbers(scenario).map((n) => {
    const w = voices.find((x) => x.id === personaId(n));
    if (!w) throw new Error(`no wallet for ${personaId(n)}. Run --generate-only first.`);
    return w;
  });

  const account = privateKeyToAccount(campaignKey.startsWith("0x") ? (campaignKey as Hex) : (`0x${campaignKey}` as Hex));
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc) });

  if ((await publicClient.getChainId()) !== CHAIN_ID) throw new Error("refusing: RPC is not Ethereum Sepolia");

  const addresses = readAddresses();
  const payments = addresses.payments ?? {};
  if ((payments[scenario]?.length ?? 0) > 0) {
    throw new Error(`${scenario} payments already recorded in addresses.json. Refusing to pay twice.`);
  }
  const spentSoFar = Object.values(payments)
    .flat()
    .reduce((sum, p) => sum + BigInt(p.amountWei) + BigInt(p.gasWei), 0n);

  const balance = await publicClient.getBalance({ address: account.address });
  const gasPrice = await publicClient.getGasPrice();
  const planned = (AMOUNT_WEI + TRANSFER_GAS * gasPrice) * BigInt(targets.length);

  console.log(`scenario         ${scenario}`);
  console.log(`campaign source  ${account.address}  balance ${formatEther(balance)} ETH`);
  console.log(`payments         ${targets.length} × ${formatEther(AMOUNT_WEI)} ETH = ${formatEther(AMOUNT_WEI * BigInt(targets.length))} ETH`);
  console.log(`gas (estimated)  ${formatEther(TRANSFER_GAS * gasPrice * BigInt(targets.length))} ETH at ${gasPrice} wei/gas`);
  console.log(`campaign spend   ${formatEther(spentSoFar)} ETH so far, cap ${formatEther(CAMPAIGN_CAP_WEI)} ETH`);
  for (const t of targets) console.log(`  -> ${t.id}  ${t.address}`);

  if (spentSoFar + planned > CAMPAIGN_CAP_WEI) {
    throw new Error(`campaign cap would be exceeded (${formatEther(spentSoFar + planned)} ETH > 0.02 ETH). Stopping.`);
  }
  if (balance - planned < CAMPAIGN_FLOOR_WEI) {
    throw new Error("campaign balance would drop below 0.005 ETH. Stopping.");
  }
  if (!args.has("--confirm")) {
    console.log("dry run only. Nothing was sent. Re-run with --confirm.");
    return;
  }

  // Each payment is written to addresses.json as soon as it is mined, so a failed run never loses a sent tx.
  const recorded: Payment[] = [];
  for (const t of targets) {
    if ((await publicClient.getChainId()) !== CHAIN_ID) throw new Error("chain id changed mid-run. Aborting.");
    const gasNow = await publicClient.getGasPrice();
    const balanceNow = await publicClient.getBalance({ address: account.address });
    if (balanceNow - AMOUNT_WEI - TRANSFER_GAS * gasNow < CAMPAIGN_FLOOR_WEI) {
      throw new Error("campaign balance floor would be breached. Stopping.");
    }

    const hash = await walletClient.sendTransaction({ to: t.address, value: AMOUNT_WEI });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const payment: Payment = {
      personaId: t.id,
      to: t.address,
      amountWei: AMOUNT_WEI.toString(),
      gasWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      blockTimestamp: Number(block.timestamp),
      status: receipt.status,
    };
    recorded.push(payment);
    const latest = readAddresses();
    const byScenario = { ...(latest.payments ?? {}), [scenario]: recorded };
    writeFileSync(
      ADDRESSES_FILE,
      JSON.stringify({ ...latest, chainId: CHAIN_ID, campaignSource: account.address, payments: byScenario }, null, 2) + "\n",
    );
    console.log(`sent ${t.id}  ${hash}  block ${receipt.blockNumber}  ${receipt.status}`);
    if (receipt.status !== "success") throw new Error(`${t.id} transfer reverted. Stopping.`);
  }
  console.log(`recorded ${recorded.length} payments in scenarios/addresses.json`);
}

if (args.has("--generate-only")) generateWallets();
else if (scenarioArg) await seedScenario(scenarioArg);
else {
  console.log("usage: --generate-only | --scenario T1|T2 [--confirm]");
  process.exitCode = 1;
}
