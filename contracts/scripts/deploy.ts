import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { artifacts, network } from "hardhat";
import { encodeDeployData, formatEther } from "viem";

// CRE mock forwarder for local `cre workflow simulate` (DECISIONS.md). Never hardcode it elsewhere.
const MOCK_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";
const CHAIN_ID = 11155111;
const DEPLOYER_CAP_WEI = 20_000_000_000_000_000n; // 0.02 ETH total for the build (CLAUDE.md §11)
const FLOOR_WEI = 5_000_000_000_000_000n; // keep ≥ 0.005 ETH after the send (CLAUDE.md §11)
const ADDRESSES_FILE = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "scenarios", "addresses.json");

// Dry run by default. Broadcasts only when ECHT_BROADCAST=1 (Hardhat rejects unknown CLI flags).
const broadcast = process.env.ECHT_BROADCAST === "1";

if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY must be set (load scripts/load-env.ps1 first).");
}

const connection = await network.create("sepolia");
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
if (!deployer) throw new Error("no deployer wallet: check DEPLOYER_PRIVATE_KEY");

const chainId = await publicClient.getChainId();
if (chainId !== CHAIN_ID) throw new Error(`refusing to run: chain ${chainId} is not Ethereum Sepolia (11155111)`);

const balance = await publicClient.getBalance({ address: deployer.account.address });
console.log(`chain            ${chainId} (Ethereum Sepolia)`);
console.log(`deployer         ${deployer.account.address}`);
console.log(`balance          ${formatEther(balance)} ETH`);
console.log(`constructor arg  forwarder = ${MOCK_FORWARDER} (CRE mock forwarder)`);

const artifact = await artifacts.readArtifact("EchtVerdicts");
const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode as `0x${string}`, args: [MOCK_FORWARDER] });
const gas = await publicClient.estimateGas({ account: deployer.account, data });
const gasPrice = await publicClient.getGasPrice();
const cost = gas * gasPrice;
console.log(`estimated gas    ${gas} at ${gasPrice} wei/gas ≈ ${formatEther(cost)} ETH`);

if (cost > DEPLOYER_CAP_WEI) {
  throw new Error(`estimate ${formatEther(cost)} ETH exceeds the 0.02 ETH deployer cap. Retry when gas is lower.`);
}
if (balance - cost < FLOOR_WEI) {
  throw new Error("deployer balance would drop below 0.005 ETH after the deploy. Stopping.");
}

if (!broadcast) {
  console.log("dry run only. Nothing was sent. Set ECHT_BROADCAST=1 to broadcast.");
} else {
  const hash = await deployer.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode as `0x${string}`, args: [MOCK_FORWARDER] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`deploy failed: ${hash}`);
  const address = receipt.contractAddress;
  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`deploy tx        ${hash}`);
  console.log(`deployed         ${address}`);
  console.log(`spent            ${formatEther(spent)} ETH`);
  console.log(`explorer         https://sepolia.etherscan.io/address/${address}`);

  // The address is public. Code reads it from scenarios/addresses.json; ECHT_VERDICTS_ADDRESS is only an override.
  const addresses = existsSync(ADDRESSES_FILE) ? JSON.parse(readFileSync(ADDRESSES_FILE, "utf8")) : {};
  addresses.verdicts = {
    chainId: CHAIN_ID,
    address,
    forwarder: MOCK_FORWARDER,
    deployTx: hash,
    blockNumber: Number(receipt.blockNumber),
    gasWei: spent.toString(),
    provenance: "TESTNET",
  };
  writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2) + "\n");
  console.log("recorded verdicts address in scenarios/addresses.json");
}

await connection.close();
