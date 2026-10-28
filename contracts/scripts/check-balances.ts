import { network } from "hardhat";
import { formatEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Read-only. Derives each public address from its key (keys are never printed) and checks
// it against the funded address recorded in docs/DECISIONS.md, then checks the balance.
const WALLETS = [
  { role: "deployer", key: "DEPLOYER_PRIVATE_KEY", address: "0x0bA556a253D2f1FdCF352aD55A5b44718802BB95" },
  { role: "CRE writer", key: "CRE_ETH_PRIVATE_KEY", address: "0xcc136490c7e6F89B298c1A5b4957a1f532B285da" },
  { role: "campaign source", key: "CAMPAIGN_PRIVATE_KEY", address: "0xaA9FE8c47cBFD12E1D6109b7c825c5b478A7B25c" },
] as const;
const MIN_WEI = 20_000_000_000_000_000n; // 0.02 ETH

const connection = await network.create("sepolia");
const { viem } = connection;
const publicClient = await viem.getPublicClient();
if ((await publicClient.getChainId()) !== 11155111) throw new Error("not Ethereum Sepolia");

let failed = false;
for (const w of WALLETS) {
  const raw = process.env[w.key]?.trim();
  if (!raw) {
    console.log(`${w.role.padEnd(16)} ${w.key} is not set`);
    failed = true;
    continue;
  }
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const derived = privateKeyToAccount(key).address;
  const match = derived.toLowerCase() === w.address.toLowerCase();
  const balance = await publicClient.getBalance({ address: w.address });
  const enough = balance >= MIN_WEI;
  if (!match || !enough) failed = true;
  console.log(
    `${w.role.padEnd(16)} ${w.address}  ${formatEther(balance)} ETH  key-match=${match}  ${enough ? "ok" : "BELOW 0.02 ETH"}`,
  );
}
await connection.close();
if (failed) {
  console.log("STOP: at least one wallet is below 0.02 ETH or its key does not match.");
  process.exitCode = 1;
}
