import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

// Secrets come only from process.env (loaded by scripts/load-env.ps1). Never log them.
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const normalizedKey = deployerKey === undefined || deployerKey === "" ? undefined
  : deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`;

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      // Placeholder when unset: the deploy script refuses to run without SEPOLIA_RPC_URL.
      url: process.env.SEPOLIA_RPC_URL ?? "http://127.0.0.1:1",
      accounts: normalizedKey === undefined ? [] : [normalizedKey],
    },
  },
});
