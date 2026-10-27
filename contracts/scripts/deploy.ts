import { artifacts, network } from "hardhat";
import { encodeDeployData, formatEther } from "viem";

// CRE mock forwarder for local `cre workflow simulate` (DECISIONS.md). Never hardcode it elsewhere.
const MOCK_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";
const MIN_DEPLOYER_BALANCE_WEI = 20_000_000_000_000_000n; // 0.02 ETH

// Dry run by default. Broadcasts only with --broadcast, which you pass after approving the cost.
const broadcast = process.argv.includes("--broadcast");

if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY must be set (load scripts/load-env.ps1 first).");
}

const connection = await network.create("sepolia");
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
if (!deployer) throw new Error("no deployer wallet: check DEPLOYER_PRIVATE_KEY");

const chainId = await publicClient.getChainId();
if (chainId !== 11155111) throw new Error(`refusing to run: chain ${chainId} is not Ethereum Sepolia (11155111)`);

const balance = await publicClient.getBalance({ address: deployer.account.address });
console.log(`chain            ${chainId} (Ethereum Sepolia)`);
console.log(`deployer         ${deployer.account.address}`);
console.log(`balance          ${formatEther(balance)} ETH`);
console.log(`constructor arg  forwarder = ${MOCK_FORWARDER} (CRE mock forwarder)`);

if (balance < MIN_DEPLOYER_BALANCE_WEI) {
  throw new Error(`deployer balance is below 0.02 ETH. Stopping, as agreed.`);
}

const artifact = await artifacts.readArtifact("EchtVerdicts");
const gas = await publicClient.estimateGas({
  account: deployer.account,
  data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode as `0x${string}`, args: [MOCK_FORWARDER] }),
});
const gasPrice = await publicClient.getGasPrice();
console.log(`estimated gas    ${gas} at ${gasPrice} wei/gas ≈ ${formatEther(gas * gasPrice)} ETH`);

if (!broadcast) {
  console.log("dry run only. Nothing was sent. Re-run with --broadcast after approval.");
} else {
  const contract = await viem.deployContract("EchtVerdicts", [MOCK_FORWARDER]);
  console.log(`deployed         ${contract.address}`);
  console.log(`explorer         https://sepolia.etherscan.io/address/${contract.address}`);
}

await connection.close();
