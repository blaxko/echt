# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary (inferred from the PRD): a person who runs or reviews an AI trading agent, and needs to know whether a wave of crypto posts was paid for before the agent trades on it.
- Secondary (from the PRD): anyone checking the evidence. They need only a browser, and every payment and verdict is a public Sepolia transaction.

## Product Purpose

Echt checks whether a wave of "independent" crypto voices was paid from one source before an AI trading agent places a practice trade. It writes the verdict (BLOCK, REVIEW or ELIGIBLE) and a hash of its evidence to Ethereum Sepolia. Success means a reader can open the dashboard, see the verdict and its reasons, follow each payment to Etherscan, and replay the decision in the browser.

## Positioning

Echt reports patterns in transfers and whether disclosure was detected. It makes no legal finding. A missing or failed lookup gives REVIEW, never ELIGIBLE. A language model extracts fields from posts but never decides the verdict; a deterministic policy does.

## Operating Context

- The dashboard is read-only in the public build. The local build can start a run through a server and the Chainlink CRE local simulation.
- Scenarios T1 (BLOCK), T2 (ELIGIBLE), T5 (REVIEW, injected provider fault) and T6 (tampered snapshot, HASH_MISMATCH on replay) are the demonstration set.
- The public site is a static build deployed to Vercel and GitHub Pages.

## Capabilities and Constraints

- Market data comes from RYO. RYO has been unavailable since 27 October, so the market gate reads UNAVAILABLE. The dashboard must say so and must not fill it in.
- Chain: Ethereum Sepolia only (chain id 11155111). No mainnet, no real funds, no trading execution. Positions are practice only.
- Personas and posts are synthetic and labelled SYNTHETIC everywhere they appear. Transfers are testnet transfers. The CRE run is a local simulation, not a deployed network.
- Copy must not use "paid shill", "illegal", "fraud", "scam" or "proof of payment". Use "linked transfers", "disclosure not detected", "policy threshold met".

## Brand Commitments

- Name: Echt. Logo: `apps/web/public/brand/echt-mark-white.svg` (dark backgrounds) and `echt-mark-black.svg` (light). Favicon: `favicon.svg`.
- The product is labelled with its provenance (SYNTHETIC, TESTNET, SIMULATED, LIVE, MODEL) on every datum.

## Evidence on Hand

- T1 BLOCK verdict, 5 of 7 voices linked: https://sepolia.etherscan.io/tx/0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be
- T2 ELIGIBLE verdict, 0 voices linked: https://sepolia.etherscan.io/tx/0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63
- Contract EchtVerdicts: https://sepolia.etherscan.io/address/0x2bc4819848efd784995ff6eab33be28b2b85bf8f
- Recorded runs: `scenarios/runs/T1.json` and `T2.json` (real), T5 and T6 (dry run).
- Cited background, not Echt's data: a 2025 leak (about 160 paid influencers, fewer than 5 disclosed), reported by The Block; tokens recommended by influencers returned -18.9% at 90 days (ProMarket summary); about 96% of influencer posts in a study of over 100 million tweets were undisclosed.
- Absences future work must not fill: no customer testimonials, no user counts, no logos of users, no benchmark claims.

## Product Principles

1. Show the evidence before the verdict. Every verdict links to the transactions behind it.
2. Fail closed: missing or inconsistent data is REVIEW, never ELIGIBLE.
3. Keep labels honest: synthetic stays synthetic, testnet stays testnet, simulation stays simulation.
4. Factual copy only, drawn from the README and PRD. No claims the evidence does not support.

## Accessibility & Inclusion

- Every verdict is conveyed by text and a shape marker, not colour alone.
- Keyboard use: R replays, E opens the Evidence Brief, Esc closes the run log, and the dashboard works with a keyboard alone.
- Contrast: text and graphics meet WCAG AA on the dark palette.
- Inferred from the PRD's accessibility section: tab order follows the zones, and wide tables scroll inside their own box.
