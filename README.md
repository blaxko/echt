# Echt

**Live demo (read-only): https://echt-sepia.vercel.app/** · dashboard: https://echt-sepia.vercel.app/#/app
Backup (GitHub Pages): https://blaxko.github.io/echt/ · dashboard: https://blaxko.github.io/echt/#/app

**In one sentence:** Echt checks whether a wave of "independent" crypto voices was paid from one source, before an AI agent trades on it, and writes the verdict to Ethereum Sepolia.

## What you can check in two minutes

1. Open the [live demo](https://echt-sepia.vercel.app/#/app). Each tab is a scenario. The landing page is at [the root](https://echt-sepia.vercel.app/).
2. **T1** blocks the trade: 5 of 7 voices received payments from one source before they posted. Every payment is an [Etherscan link](https://sepolia.etherscan.io/tx/0xcbcb1806ae5953cca2279e0f185782707024e81b6d109bd86d34c65fd725a231), with its measured gap to the post.
3. **T2** does not: one payment is not a pattern, so it is ELIGIBLE with no linked voices.
4. Press **Replay**. T1 returns MATCH. T6, a tampered copy, returns HASH_MISMATCH.

## The on-chain verdicts

| Run | Verdict | Verdict transaction |
|---|---|---|
| T1 | BLOCK, 5 linked voices | [0xc0141cba…](https://sepolia.etherscan.io/tx/0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be) |
| T2 | ELIGIBLE, 0 linked voices | [0x97d2b04e…](https://sepolia.etherscan.io/tx/0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63) |

Contract: [`EchtVerdicts`](https://sepolia.etherscan.io/address/0x2bc4819848efd784995ff6eab33be28b2b85bf8f). Each verdict was read back with `getVerdict` before it was recorded. The demo script opens with the broadcast that failed and was fixed: [docs/demo-script.md](docs/demo-script.md).

## How it works

1. A model reads each post into a structured record (token, sentiment, conviction, urgency, disclosure). Results are cached and labelled `MODEL`.
2. A Chainlink CRE workflow reads each voice wallet's transfers at a pinned block, and finds whether one sender reached at least two converging voices before they posted.
3. A deterministic policy (`packages/policy`, no dependencies) returns BLOCK, REVIEW or ELIGIBLE. The model never decides.
4. The verdict and a hash of its evidence are written to `EchtVerdicts`. The read-back must match before a record is stored.

Honest labels: the personas and posts are synthetic, the payments are Sepolia testnet transfers, and the CRE step is a local simulation, not a deployed DON. Echt reports patterns and whether disclosure was detected. It does not make legal findings. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Deploy the public site (Vercel or GitHub Pages)

Both targets build the same static site from `pnpm --filter @echt/web build:public`. It reads only committed files, so it needs **no secrets and no environment variables**.

**Vercel.** Import the repository. `vercel.json` sets the install command, the build command, the output folder (`apps/web/dist-public`) and the security headers, so no dashboard overrides are needed. Two settings matter:
- Environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` (all environments). Vercel then uses the pnpm version in `packageManager` (10.34.9). Without it, Vercel falls back to its default pnpm.
- Node.js version 24.x.

**GitHub Pages.** `.github/workflows/pages.yml` deploys on every push to `main` (Settings → Pages → Source: GitHub Actions).

## Run it locally

The public demo needs nothing. Running new checks needs the setup below.

```bash
corepack enable
pnpm install
pnpm test
. .\scripts\load-env.ps1
pnpm --filter @echt/server start
```

Then, in a second terminal, `pnpm --filter @echt/web dev` and open http://localhost:5173. The pinned pnpm version (10.34.9) comes from `packageManager`. Checks need a `.env` with a Sepolia RPC URL and an Etherscan key (see `.env.example`).

## Who needs what (PRD §11b)

| Who | Needs | Gets |
|---|---|---|
| Anyone viewing the demo | A browser | Every scenario, verdicts, Brief, Replay |
| Anyone checking the evidence | A browser | Every payment and verdict on sepolia.etherscan.io |
| A developer cloning the repo | Node 24, corepack (pnpm 10.34.9), Bun, a free Etherscan key and a Sepolia RPC URL | Re-runs the checks against the committed public payments |
| Anyone wanting live market data | A RYO builder key | Live market evidence. Without it, the market gate reads UNAVAILABLE |

## Documents

- [docs/submission.md](docs/submission.md): the BUIDL text
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): diagrams, data flow, CRE limits, decisions
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md): what Echt does not prove
- [docs/launch.md](docs/launch.md): the launch checklist, rollback and monitoring
- [docs/DECISIONS.md](docs/DECISIONS.md): each decision and its reason
- [docs/demo-script.md](docs/demo-script.md): the two-minute shot list
