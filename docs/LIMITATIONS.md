# Limitations

Echt is a hackathon build. This page says what it does not prove, so that nobody reads more into a verdict than the evidence supports.

## What Echt reports

Echt reports patterns in transfers and whether disclosure was detected. It does not make legal findings. Its verdicts use these words: "linked transfers", "disclosure detected or not detected", "policy threshold met", "no qualifying transfer pattern observed". It never says "paid shill", "illegal", "fraud", "scam", or "proof of payment". A `BLOCK` is a policy result for one window of data, not a conclusion about anyone's conduct. Disclosure detection is a heuristic flag, not a compliance check.

## Synthetic personas and posts

- The seven voices (`@echt_persona_01` to `_07`) and the seven second-scenario voices (`_08` to `_14`) are synthetic. Their posts are written for the test. They are labelled `SYNTHETIC` everywhere they appear.
- No real person's handle or wallet appears in any scenario or on-chain. Persona IDs are hashed on-chain.
- The posts are dated 8–14 hours after each payment, so the gap between a payment and its post is a designed value. The dashboard shows the gap measured from block timestamps, not the designed value.

## Testnet payments

- The payments are real transactions on Ethereum Sepolia, sent from a test wallet to the persona wallets. They are `TESTNET`.
- The payments were made to show the pattern. Nothing in the chain record says who controls the persona wallets, and nothing proves the personas are real.
- Sepolia ETH has no market value. The payments are not trades.

## Local CRE simulation, not a deployed DON

- The verdict runs through `cre workflow simulate`, a local simulation. No Chainlink DON verified it. The UI labels it "Chainlink CRE · local simulation". Echt does not claim a deployed DON verified a verdict.
- The workflow was type-checked only through its tests and the root typecheck. The CLI runs with `--skip-type-checks`, because the generated `tsconfig.json` rejects the policy package's `.ts` import suffixes (DECISIONS.md, D11). The logic is covered by 15 Bun tests, the policy tests, and simulation runs.
- Chain writes go through the mock forwarder `0x15fC6ae953E024d975e77382eEeC56A9101f9F88`, not the production forwarder, because the hackathon has no deployed-workflow access yet (DECISIONS.md).

## RYO outage

- RYO market data has been down for every symbol tried since 27 October (BTC, ETH, SOL). The retry on 28 October still returned `VALIDATION_FAILED` for all three. The trace IDs are saved in `scenarios/fixtures/`.
- Because of this, the market gate reads UNAVAILABLE on every record. The dashboard shows that honestly, with RYO's message and trace ID.
- An ELIGIBLE verdict therefore ends in NO POSITION. The `OPEN PRACTICE POSITION` state is coded and unit-tested, but the UI shows it only when a real RYO envelope with `status: ok` exists. None does yet.
- The payment verdict does not depend on market data. The market only decides whether an ELIGIBLE verdict opens a practice position.

## Scope limits in the policy

- A campaign source is a sender whose transfers reach at least 2 converging voices (D6). One payment, such as T2's, does not make a campaign source. This is a design choice. It means a single payment never counts as a pattern.
- The lookback is 72 hours before each post. A transfer outside that window is not considered.
- The policy reads native Sepolia ETH transfers only. Token transfers, contract calls and internal transactions are not read.
- Convergence (seven bullish voices on one token in six hours) is computed by the server from the posts, not by the workflow. The workflow trusts the converging voices it is given and checks their payments.
- This build has no live post extraction. Converging posts and their disclosure flags come from the synthetic scenario files, not from a model reading the posts. The LLM step in the design is not built.

## Replay

- Replay recomputes the decision from the stored inputs, offline. It proves that the stored record is internally consistent. It does not prove the chain's inputs are correct. The read-back from `EchtVerdicts` checks that the chain holds the same evidence hash.

## Build and tooling

- pnpm 12.3.4 leaves some peer links broken in this repo (viem's `abitype` peer in one package). The chain code therefore lives in the `scripts` package, where the links are intact. The server does not depend on `viem` directly for that reason. A clone with the same pnpm version may see the same broken link; `pnpm install` plus the scripts package still works (DECISIONS.md, D10).
- The test suite covers the policy, the server, the web state logic, the contract and the CRE helpers. It does not cover the full browser flow end to end.

## What would change the answer

- A deployed CRE workflow with a real forwarder.
- A live RYO envelope with `status: ok` (the retry script saves one if it appears).
- Real disclosure review by a person, not the heuristic.
