import { parsePingRequest, summarizeTxlist } from "./ping";
import {
  consensusIdenticalAggregation,
  decodeJson,
  handler,
  HTTPCapability,
  HTTPClient,
  Runner,
  type HTTPPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk";

export type Config = {
  chainId: number;
  etherscanBaseUrl: string;
};

const fetchTxlist = (nodeRuntime: NodeRuntime<Config>, url: string): string => {
  const httpClient = new HTTPClient();
  const response = httpClient.sendRequest(nodeRuntime, { url, method: "GET" }).result();
  if (response.statusCode !== 200) throw new Error(`etherscan HTTP ${response.statusCode}`);
  return JSON.stringify(summarizeTxlist(decodeJson(response.body)));
};

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const request = parsePingRequest(decodeJson(payload.input));
  const apiKey = runtime.getSecret({ id: "ETHERSCAN_KEY" }).result().value;
  // Built by hand: URLSearchParams is not guaranteed in the CRE WASM runtime.
  const query = [
    ["chainid", String(runtime.config.chainId)],
    ["module", "account"],
    ["action", "txlist"],
    ["address", request.address],
    ["startblock", String(request.startBlock)],
    ["endblock", String(request.endBlock)],
    ["sort", "asc"],
    ["apikey", apiKey],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v ?? "")}`)
    .join("&");
  const url = `${runtime.config.etherscanBaseUrl}?${query}`;

  // Log the request shape only. The URL carries the API key and is never logged.
  runtime.log(`run ${request.runId}: txlist chain ${runtime.config.chainId}, blocks ${request.startBlock}-${request.endBlock}`);
  const summary = runtime.runInNodeMode(fetchTxlist, consensusIdenticalAggregation<string>())(url).result();
  runtime.log(`run ${request.runId}: etherscan ${summary}`);
  return summary;
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  return [handler(http.trigger({ authorizedKeys: [] }), onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
