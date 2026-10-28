// Read-only chain access for the server: getVerdict on EchtVerdicts. Lives in the scripts workspace because
// that package's viem link is intact; the server imports this file instead of depending on viem itself
// (pnpm 12.3.4 leaves viem's abitype peer unlinked in apps/server; see docs/DECISIONS.md D10).

import { createPublicClient, http, keccak256, stringToHex, type Address } from "viem";
import { sepolia } from "viem/chains";

export const VERDICT_ABI = [
  {
    type: "function",
    name: "getVerdict",
    stateMutability: "view",
    inputs: [{ name: "runId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "runId", type: "bytes32" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "tokenSymbolHash", type: "bytes32" },
          { name: "pinnedToBlock", type: "uint64" },
          { name: "paymentVerdict", type: "uint8" },
          { name: "convergingCount", type: "uint8" },
          { name: "linkedCount", type: "uint8" },
          { name: "policyVersion", type: "bytes32" },
          { name: "personaIdHashes", type: "bytes32[]" },
        ],
      },
    ],
  },
] as const;

export interface ChainVerdict {
  evidenceHash: `0x${string}`;
  paymentVerdict: number;
  pinnedToBlock: number;
  linkedCount: number;
}

/** Reads EchtVerdicts.getVerdict for a run id (the string; it is hashed here, as the contract's key). */
export async function readVerdictOnChain(rpcUrl: string, address: Address, runId: string): Promise<ChainVerdict> {
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  if ((await client.getChainId()) !== 11155111) throw new Error("refusing: RPC is not Ethereum Sepolia");
  const v = await client.readContract({ address, abi: VERDICT_ABI, functionName: "getVerdict", args: [keccak256(stringToHex(runId))] });
  return { evidenceHash: v.evidenceHash, paymentVerdict: v.paymentVerdict, pinnedToBlock: Number(v.pinnedToBlock), linkedCount: v.linkedCount };
}
