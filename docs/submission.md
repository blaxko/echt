# Echt: DoraHacks BUIDL

## Pitch (one line)

Echt checks whether a wave of "independent" crypto voices was paid from one source before an AI agent trades on it, and writes the verdict on-chain.

## For a judge in 30 seconds

- **Live demo:** https://blaxko.github.io/echt/ (read-only, runs in the browser)
- **What to look at:** the T1 tab. Five of seven voices were paid from one wallet before they posted. The verdict is BLOCK, and its transaction is on Sepolia: https://sepolia.etherscan.io/tx/0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be
- **The control case:** T2. One payment is not a pattern, so the verdict is ELIGIBLE with no linked voices: https://sepolia.etherscan.io/tx/0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63
- **Trust the result:** every verdict was read back from the contract with `getVerdict` before it was recorded. The first broadcast failed silently, and the fix is shown in the demo.

## What it does

When seven voices turn bullish on one token within six hours, a naive agent buys. Echt runs a check before the practice trade:

1. A model reads each post into a record: token, sentiment, conviction, urgency, and whether a paid relationship is disclosed. The model only extracts. It never decides.
2. A Chainlink CRE workflow reads each voice wallet's transfer history at a pinned block. It asks whether one sender reached at least two converging voices before they posted.
3. A deterministic policy (`echt-policy@2`, pure TypeScript) returns BLOCK, REVIEW or ELIGIBLE. A missing or failed lookup is REVIEW, never ELIGIBLE.
4. The verdict and a hash of its evidence are written to `EchtVerdicts` on Ethereum Sepolia.
5. The dashboard shows the cancelled trade, every payment as an Etherscan link with its measured gap to the post, and an Evidence Brief. Replay recomputes the decision in the browser and reports MATCH or HASH_MISMATCH.

## How it uses Chainlink CRE (for the CRE bounty)

- **Orchestration.** An HTTP-triggered CRE workflow in TypeScript (Bun). It takes a payload and a pinned block, and returns a signed report to a forwarder-gated receiver.
- **External API and chain.** It reads Etherscan V2 transfer history. Each execution makes at most 12 HTTP calls (CRE's limit is 15), uses paced requests (3 per second on the free tier), and keeps only the fields the policy reads.
- **Consensus.** Every node reads the same pinned block. Rows are sorted, and failed calls come back as data, so identical output is possible. A failed lookup becomes REVIEW.
- **EVM write.** The workflow ABI-encodes a `Verdict` struct and sends it with `writeReport`. `EchtVerdicts` accepts reports only from the forwarder and stores each run id once. Persona IDs are hashed on-chain.
- **Proof.** The broadcast runs through `cre workflow simulate --broadcast`. The server reads the verdict back with `getVerdict`. It writes a record only if the on-chain evidence hash matches its own recomputation.

Honest label: the CRE step is a local simulation that writes to Sepolia, not a deployed DON. The dashboard says so.

## How it fits RYO's Multi-KOL brief

- **Multi-KOL narrative.** The unit is a set of voices, not one post. Echt converges seven voices on one token in six hours, then checks the money behind them.
- **Cause and effect.** A BLOCK or REVIEW opens no practice position. The record shows the cancelled trade next to the evidence that cancelled it.
- **Repeatability.** Replay recomputes the same decision offline from the stored inputs.
- **Market evidence.** The market gate calls RYO `analyze_token`. RYO returned `VALIDATION_FAILED` for BTC, ETH and SOL throughout the build. The dashboard shows that message and its trace id, and no position opens without a real RYO `ok` envelope.

## Links

- Repository: https://github.com/blaxko/echt
- Live demo: https://blaxko.github.io/echt/
- `EchtVerdicts` (Ethereum Sepolia): https://sepolia.etherscan.io/address/0x2bc4819848efd784995ff6eab33be28b2b85bf8f
- T1 verdict (BLOCK): https://sepolia.etherscan.io/tx/0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be
- T2 verdict (ELIGIBLE): https://sepolia.etherscan.io/tx/0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63
- The two broadcasts that stored no verdict, kept for transparency: https://sepolia.etherscan.io/tx/0x1fe3a333a2a7900b0884b81664fa3beaa0223bc0b789737a2b4435df1115a75d and https://sepolia.etherscan.io/tx/0xa893a158d3fa42495a1fb5b9cc7cede342bb57a1a2910da718157956bbfad253

## Limitations

- **Synthetic voices and posts.** The seven voices and their posts are written for the test. Nothing here describes a real account.
- **Testnet payments.** Real Sepolia transactions with no market value. They show the pattern, not a real campaign.
- **Local CRE simulation.** No deployed DON verified the verdicts. The write goes through the mock forwarder.
- **No live market data.** RYO was unavailable throughout the build, so no practice position opens.
- **Policy scope.** One payment never makes a campaign source, so T2 has 0 linked voices. Only native ETH counts, over a 72-hour lookback.
- **Not legal findings.** Echt reports a pattern in transfers and whether disclosure was detected. It does not decide who broke the law.

Full list: `docs/LIMITATIONS.md`.
