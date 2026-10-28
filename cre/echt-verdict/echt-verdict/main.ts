// Echt payment check (PRD §6.6, F5). HTTP trigger → transfer lookups at a pinned block → consensus →
// payment policy → signed report → EchtVerdicts. Helpers live in run.ts (the WASM build rejects
// exported functions with parameters, so main.ts exports only main()).

import {
  bytesToHex,
  consensusIdenticalAggregation,
  decodeJson,
  EVMClient,
  getNetwork,
  handler,
  HTTPCapability,
  HTTPClient,
  prepareReportRequest,
  Runner,
  type HTTPPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk";
import { analyzePayments, type Transfer } from "../../../packages/policy/src/index";
import {
  decide,
  encodeVerdict,
  lookbackStart,
  MAX_SOURCE_LOOKUPS,
  parseRunRequest,
  parseTxlist,
  sourceMetaFrom,
  toTransfers,
  toVoiceWallets,
  txlistUrl,
  type SourceFetch,
  type VoiceFetch,
} from "./run";

export type Config = {
  chainId: number;
  chainSelectorName: string;
  etherscanBaseUrl: string;
  verdictsAddress: string;
  gasLimit: string;
};

// Etherscan's free tier allows 3 calls per second, so each node waits 400 ms before a call.
const ETHERSCAN_PACING_MS = 400;

// Runs on every node. The result is a JSON string so consensus can compare nodes byte for byte.
// Errors are returned as data, not thrown, so a failed lookup becomes REVIEW instead of a silent gap.
const fetchVoice = (nodeRuntime: NodeRuntime<Config>, url: string): string => {
  nodeRuntime.sleep(ETHERSCAN_PACING_MS);
  const response = new HTTPClient().sendRequest(nodeRuntime, { url, method: "GET" }).result();
  if (response.statusCode !== 200) return JSON.stringify({ ok: false, error: `etherscan HTTP ${response.statusCode}` });
  const rows = parseTxlist(decodeJson(response.body));
  if (!rows.ok) return JSON.stringify({ ok: false, error: rows.error });
  return JSON.stringify({ ok: true, transfers: toTransfers(rows.rows) });
};

const fetchSource = (nodeRuntime: NodeRuntime<Config>, url: string): string => {
  nodeRuntime.sleep(ETHERSCAN_PACING_MS);
  const response = new HTTPClient().sendRequest(nodeRuntime, { url, method: "GET" }).result();
  if (response.statusCode !== 200) return JSON.stringify({ ok: false, error: `etherscan HTTP ${response.statusCode}` });
  const rows = parseTxlist(decodeJson(response.body));
  if (!rows.ok) return JSON.stringify({ ok: false, error: rows.error });
  return JSON.stringify({ ok: true, txCount: rows.rows.length });
};

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const request = parseRunRequest(decodeJson(payload.input));
  // The key sits in the URL, so URLs are never logged.
  const apiKey = runtime.getSecret({ id: "ETHERSCAN_KEY" }).result().value;
  const { chainId, etherscanBaseUrl } = runtime.config;
  runtime.log(`run ${request.runId}: ${request.voices.length} voices, pinned block ${request.pinnedToBlock}`);

  const transfers: Transfer[] = [];
  let providerFailed = false;
  for (const voice of request.voices) {
    const url = txlistUrl(etherscanBaseUrl, chainId, voice.wallet, lookbackStart(voice.postBlock), request.pinnedToBlock, apiKey);
    const fetched = JSON.parse(runtime.runInNodeMode(fetchVoice, consensusIdenticalAggregation<string>())(url).result()) as VoiceFetch;
    if (fetched.ok) transfers.push(...fetched.transfers);
    else {
      providerFailed = true;
      runtime.log(`run ${request.runId}: ${voice.personaId} lookup failed: ${fetched.error}`);
    }
  }

  // Sources come from the transfers, so the policy finds them first. Their metadata is fetched next.
  const sources = analyzePayments(toVoiceWallets(request.voices), transfers, {}).campaignSources;
  const startBlock = Math.min(...request.voices.map((v) => lookbackStart(v.postBlock)));
  const sourceFetches: (SourceFetch | undefined)[] = sources
    .slice(0, MAX_SOURCE_LOOKUPS)
    .map((source) => {
      const url = txlistUrl(etherscanBaseUrl, chainId, source, startBlock, request.pinnedToBlock, apiKey);
      return JSON.parse(runtime.runInNodeMode(fetchSource, consensusIdenticalAggregation<string>())(url).result()) as SourceFetch;
    });

  const meta = sourceMetaFrom(sources, sourceFetches, request.knownExchanges);
  const decision = decide(request, transfers, meta, providerFailed);
  runtime.log(`run ${request.runId}: payment verdict ${decision.verdict} (${decision.reasons.join(", ")})`);

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`unknown chain selector name ${runtime.config.chainSelectorName}`);
  const report = runtime.report(prepareReportRequest(encodeVerdict(request, decision, request.voices.length))).result();
  const reply = new EVMClient(network.chainSelector.selector)
    .writeReport(runtime, {
      receiver: runtime.config.verdictsAddress,
      report,
      gasConfig: { gasLimit: runtime.config.gasLimit },
    })
    .result();

  return JSON.stringify({
    runId: request.runId,
    verdict: decision.verdict,
    reasons: decision.reasons,
    linkedPersonaIds: decision.linkedPersonaIds,
    convergingCount: request.voices.length,
    evidenceHash: decision.evidenceHash,
    txStatus: reply.txStatus,
    txHash: reply.txHash ? bytesToHex(reply.txHash) : null,
    provenance: "SIMULATED",
  });
};

const initWorkflow = (_config: Config) => {
  const http = new HTTPCapability();
  return [handler(http.trigger({ authorizedKeys: [] }), onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

