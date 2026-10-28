import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

const verdictAbi = [
  {
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
] as const;

// Hardhat's generated contract types are not produced for this repo, so the test states the shape it uses.
type Echt = {
  address: `0x${string}`;
  abi: readonly unknown[];
  read: { getVerdict: (args: readonly [Hex]) => Promise<unknown> };
  write: { onReport: (args: readonly [Hex, Hex], options: { account: unknown }) => Promise<Hex> };
};

const RUN_ID = keccak256(stringToHex("run-1"));
const EVIDENCE = keccak256(stringToHex("evidence"));
const POLICY = keccak256(stringToHex("echt-policy@2"));

function verdict(overrides: Partial<{ runId: Hex; paymentVerdict: number }> = {}) {
  return {
    runId: overrides.runId ?? RUN_ID,
    evidenceHash: EVIDENCE,
    tokenSymbolHash: keccak256(stringToHex("ETH")),
    pinnedToBlock: 18_402_100n,
    paymentVerdict: overrides.paymentVerdict ?? 2, // BLOCK
    convergingCount: 7,
    linkedCount: 5,
    policyVersion: POLICY,
    personaIdHashes: [keccak256(stringToHex("persona_01")), keccak256(stringToHex("persona_02"))],
  };
}

const encode = (v: ReturnType<typeof verdict>): Hex => encodeAbiParameters(verdictAbi, [v]);

describe("EchtVerdicts", async () => {
  const { viem } = await network.create();
  const [forwarder, stranger] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  async function deploy() {
    const deployed = await viem.deployContract("EchtVerdicts", [forwarder!.account.address]);
    return (await viem.getContractAt("EchtVerdicts", deployed.address)) as unknown as Echt;
  }

  it("accepts a report from the forwarder and stores it", async () => {
    const c = await deploy();
    await c.write.onReport(["0x", encode(verdict())], { account: forwarder!.account });
    const stored = (await c.read.getVerdict([RUN_ID])) as ReturnType<typeof verdict>;
    assert.equal(stored.runId, RUN_ID);
    assert.equal(stored.evidenceHash, EVIDENCE);
    assert.equal(stored.paymentVerdict, 2);
    assert.equal(stored.pinnedToBlock, 18_402_100n);
    assert.equal(stored.personaIdHashes.length, 2);
  });

  it("emits VerdictRecorded", async () => {
    const c = await deploy();
    const hash = await c.write.onReport(["0x", encode(verdict())], { account: forwarder!.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = await publicClient.getContractEvents({
      address: c.address,
      abi: c.abi,
      eventName: "VerdictRecorded",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    assert.equal(logs.length, 1);
    const ev = logs[0] as unknown as { args: { runId: Hex; paymentVerdict: number } };
    assert.equal(ev.args.runId, RUN_ID);
    assert.equal(ev.args.paymentVerdict, 2);
  });

  it("rejects a report from any address other than the forwarder", async () => {
    const c = await deploy();
    await assert.rejects(
      c.write.onReport(["0x", encode(verdict())], { account: stranger!.account }),
      /NotForwarder/,
    );
  });

  it("is idempotent by runId: a second report reverts with AlreadyRecorded", async () => {
    const c = await deploy();
    await c.write.onReport(["0x", encode(verdict())], { account: forwarder!.account });
    await assert.rejects(
      c.write.onReport(["0x", encode(verdict())], { account: forwarder!.account }),
      /AlreadyRecorded/,
    );
  });

  it("rejects a payment verdict outside 0..2", async () => {
    const c = await deploy();
    await assert.rejects(
      c.write.onReport(["0x", encode(verdict({ paymentVerdict: 3 }))], { account: forwarder!.account }),
      /InvalidPaymentVerdict/,
    );
  });

  it("getVerdict reverts for an unknown run", async () => {
    const c = await deploy();
    await assert.rejects(c.read.getVerdict([RUN_ID]), /UnknownRun/);
  });

  it("refuses a zero forwarder at deploy time", async () => {
    await assert.rejects(viem.deployContract("EchtVerdicts", ["0x0000000000000000000000000000000000000000"]), /forwarder is zero/);
  });
});
