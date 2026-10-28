# Echt

Echt stops an AI trading agent from following coordinated crypto hype before it places a practice trade. When seven watched voices turn bullish on one token, a Chainlink CRE workflow checks, at a pinned block, whether the voices' verified wallets received transfers from the same campaign source before they posted. A deterministic policy returns `BLOCK`, `REVIEW` or `ELIGIBLE`, the verdict is written to Ethereum Sepolia, and the dashboard shows every transfer, the cancelled trade and an Evidence Brief anyone can replay. Echt reports patterns in transfers. It does not make legal findings.

## Run it

The repo pins pnpm 10.34.9 in `packageManager`. With `corepack enable`, that version is used automatically.

```bash
pnpm install
pnpm test
. .\scripts\load-env.ps1
pnpm --filter @echt/server start
pnpm --filter @echt/web dev
```

Then open http://localhost:5173. The first two commands need nothing but Node 24 and pnpm. The last three need a `.env` with a Sepolia RPC URL and an Etherscan key (see `.env.example`). The dashboard reads the committed run records, so it works without them.

## Live contract and transactions

| What | Link |
|---|---|
| `EchtVerdicts` on Ethereum Sepolia | https://sepolia.etherscan.io/address/0x2bc4819848efd784995ff6eab33be28b2b85bf8f |
| Deploy transaction | https://sepolia.etherscan.io/tx/0xd7b21891714f5d98b47fd469e0db235b37b9d315b6b3765d6e8f75d6a0facb05 |
| T1 payments (5 voices, 0.002 ETH each) | see `scenarios/addresses.json`, or the list in `docs/demo-script.md` |
| T1 verdict (`BLOCK`) | to be filled after the 17:20 Lagos broadcast, from `scenarios/runs/T1.json` |
| T2 verdict (`ELIGIBLE`) | to be filled after the broadcast, from `scenarios/runs/T2.json` |

## Who needs what (PRD §11b)

No wallet, no token, no sign-up and no funds are needed to use Echt. Nothing is gated.

| Who | What they need | What they get |
|---|---|---|
| Judge or visitor watching the dashboard | A browser | Every scenario, the verdict, the Evidence Brief, Replay |
| Anyone checking the evidence | A browser | Every payment and verdict is a public Sepolia transaction |
| Developer cloning the repo | Node 24, pnpm, Bun, a free Etherscan key and a free Sepolia RPC URL | Re-runs the CRE check against the already-seeded public payments in `scenarios/addresses.json`. No deploy, no faucet, no wallet |
| Developer who also wants live market data | A RYO builder key | Live RYO evidence. Without one, the market gate shows UNAVAILABLE, labelled honestly |

Only the builder needs funded testnet wallets, and only once, to seed the scenarios.

## More

- `docs/ARCHITECTURE.md`: diagrams, data flow, CRE limits, decisions D1–D16
- `docs/LIMITATIONS.md`: what Echt does not prove
- `docs/demo-script.md`: the two-minute shot list
- `docs/PRD.md` and `docs/DECISIONS.md`: requirements and the record of each choice
