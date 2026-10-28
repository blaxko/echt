# Echt: DoraHacks BUIDL draft

## One-line pitch

Echt stops an AI trading agent from following coordinated crypto hype: a Chainlink CRE workflow checks, at a pinned block, whether the voices behind a bullish wave were paid from one source, and writes the verdict to Ethereum Sepolia.

## What it does

When seven watched voices turn bullish on one token inside six hours, a naive agent buys. Echt runs a check before the practice trade opens:

1. Each post is read by a model into a structured record: token, sentiment, conviction, urgency, and whether a paid or sponsored relationship is disclosed. Results are cached and labelled `MODEL`.
2. A Chainlink CRE workflow reads each voice wallet's transfer history from Etherscan at a pinned block. It finds whether one sender reached at least two converging voices before they posted.
3. A deterministic policy (`echt-policy@2`, pure TypeScript) returns `BLOCK`, `REVIEW` or `ELIGIBLE`. The model never decides.
4. The verdict, with a hash of the evidence, is written to `EchtVerdicts` on Ethereum Sepolia.
5. The dashboard shows the cancelled trade, every payment as an Etherscan link with its measured gap to the post, and an Evidence Brief. Replay recomputes the decision in the browser and reports MATCH or HASH_MISMATCH.

Live: https://blaxko.github.io/echt/ (read-only). The demo script is in `docs/demo-script.md`.

## How it uses Chainlink CRE (for the CRE bounty)

- **Orchestration.** The workflow is an HTTP-triggered CRE workflow (TypeScript, run with Bun). Its inputs are a payload and a pinned block, and its output is a signed report to a forwarder-gated receiver.
- **Chain and external API.** It reads transfer history from the Etherscan V2 API, one paced call per voice wallet and one per campaign source found. It stays under the limits: 15 HTTP calls, 250 KB responses, 5-minute executions. Echt uses at most 12 calls and fetches only the fields the policy uses.
- **Consensus.** Each node reads the same pinned block, the rows are sorted, and failed calls come back as data. Identical results across nodes are required (`consensusIdenticalAggregation`). A failed lookup becomes `REVIEW`, never `ELIGIBLE`.
- **EVM write.** The workflow ABI-encodes a `Verdict` struct and sends it through `writeReport`. The receiver `EchtVerdicts` accepts reports only from the forwarder and stores each verdict once per run id. Persona IDs are hashed on-chain.
- **Proof.** The broadcast runs through `cre workflow simulate --broadcast`. The server then reads the verdict back with `getVerdict` and writes a record only if the on-chain evidence hash matches its own recomputation.

Honest label: this is a local CRE simulation writing to Sepolia, not a deployed DON. The dashboard says so.

## How it fits RYO's Multi-KOL brief

- **Multi-KOL narrative.** The unit of analysis is a set of voices, not one post. Echt converges seven voices on one token inside a six-hour window, then checks the money behind them.
- **Cause and effect.** The check changes the agent's action. A `BLOCK` or `REVIEW` means no practice position is opened. The run record shows the cancelled trade next to the evidence that cancelled it.
- **Repeatability.** Replay recomputes the same decision offline. The same input always gives the same evidence hash.
- **Market evidence.** The design calls RYO `analyze_token` for the market gate. RYO market data was unavailable for BTC, ETH and SOL during the build (`VALIDATION_FAILED`, trace ids saved in `scenarios/fixtures/`). The dashboard shows that, and no position opens without a real RYO envelope.

## Links

- Repository: https://github.com/blaxko/echt
- Live demo (read-only, GitHub Pages): https://blaxko.github.io/echt/
- `EchtVerdicts` contract (Ethereum Sepolia): https://sepolia.etherscan.io/address/0x2bc4819848efd784995ff6eab33be28b2b85bf8f
- Verdict transactions:
  - T1, BLOCK, 5 linked voices: https://sepolia.etherscan.io/tx/0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be
  - T2, ELIGIBLE, 0 linked voices: https://sepolia.etherscan.io/tx/0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63
- Payments (T1, 0.002 ETH each): see `scenarios/addresses.json` for all transaction hashes.
- The failed broadcasts that stored no verdict, shown for transparency: https://sepolia.etherscan.io/tx/0x1fe3a333a2a7900b0884b81664fa3beaa0223bc0b789737a2b4435df1115a75d and https://sepolia.etherscan.io/tx/0xa893a158d3fa42495a1fb5b9cc7cede342bb57a1a2910da718157956bbfad253

## Limitations

- **Synthetic personas and posts.** The seven voices and the posts that the model reads are written for the test. Nothing here is a finding about a real account.
- **Testnet payments.** The payments are real Sepolia transactions with no market value. They show the pattern, not a real campaign.
- **Local CRE simulation.** No deployed DON verified the verdicts. The write goes through the mock forwarder.
- **RYO outage.** Market data was unavailable for the whole build. The payment verdict does not depend on it, but no practice position can open.
- **Policy scope.** One payment never makes a campaign source (D6), so T2 ends with 0 linked voices. Only native ETH transfers count, over a 72-hour lookback.
- **Not legal findings.** Echt reports a pattern in transfers and whether disclosure was detected. It does not decide who broke the law.

See `docs/LIMITATIONS.md` for the full list.
