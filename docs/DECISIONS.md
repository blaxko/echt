# Decisions — Echt

Non-secret facts the build depends on. **Never put private keys or API keys here.** Those live only in `.env`.

## Chain and CRE (recorded 27 Oct 2026)

| Item | Value |
|---|---|
| Chain | Ethereum Sepolia, chain id `11155111` |
| CRE chain name | `ethereum-testnet-sepolia` |
| CRE chain selector | `16015286601757825753` |
| CRE forwarder (deployed workflows) | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| CRE **mock** forwarder (local `cre workflow simulate`) | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` |
| Explorer | https://sepolia.etherscan.io |
| CRE CLI / Bun | v1.39.0 / 1.4.4 |
| CRE project | `cre/echt-verdict` (TypeScript), hello-world simulation passed 27 Oct 23:00 Lagos |
| CRE deploy access | Requested 27 Oct (purpose: Hackathon); pending |

Column order taken from `cre workflow supported-chains` (name, selector, forwarder, mock forwarder). **Check before deploying `EchtVerdicts`:** run `cre workflow supported-chains --help` or look at the header row to confirm which address is which.

**Contract rule:** `EchtVerdicts` takes the trusted forwarder address in its constructor. For the hackathon (local simulation) deploy it with the **mock forwarder**. If CRE deploy access is granted later, redeploy (or add a setter callable only by the owner) with the real forwarder. Never hardcode either address in code; read them from this file or config.

## Data providers

| Item | Value |
|---|---|
| Transfer history | Etherscan V2 `module=account&action=txlist`, `chainid=11155111` (free tier). Native Sepolia ETH only, no test token |
| Fallback | Alchemy `alchemy_getAssetTransfers` |
| RPC | Alchemy, Ethereum Sepolia (`SEPOLIA_RPC_URL` in `.env`) |
| Market data | RYO REST `https://app-ryochan.com/api/mcp`; key id `53660d79`, scope `tools:read`, 60 calls/min, expires 2026-12-17 |
| RYO status 27 Oct 21:17 Lagos | Market data down for BTC, ETH, SOL (`VALIDATION_FAILED`); fixtures saved; Help Desk notified |
| LLM | Groq free tier via OpenAI-compatible API, model `openai/gpt-oss-120b` (fallback `openai/gpt-oss-20b`), JSON mode verified 27 Oct |

## Wallets (public addresses only)

| Role | Address |
|---|---|
| Deployer | `0x0bA556a253D2f1FdCF352aD55A5b44718802BB95` (funded, 0.05 ETH on 28 Oct) |
| CRE writer | `0xcc136490c7e6F89B298c1A5b4957a1f532B285da` (funded, 0.05 ETH on 28 Oct) |
| Campaign source | `0xaA9FE8c47cBFD12E1D6109b7c825c5b478A7B25c` (funded, 0.05 ETH on 28 Oct) |
| Persona wallets (7) | generated 28 Oct by `scripts/seed-testnet.ts --generate-only` into `scenarios/wallets.local.json` (gitignored). Public addresses: persona_01 `0x78A911C5EAc77756A2AA52734c6491fa777F722E`, _02 `0x069c3377FE98090e1bfC96E1a586c57EBF61643A`, _03 `0x23aC8a150D692dc817946afd29eFe0Cc586D5AEe`, _04 `0x3664A4a5d5D7f8eDF99415Ecb54286f119BC3309`, _05 `0x47063bF0BBD583ADF430334e3Ce16c5Eda5AbA45`, _06 `0xF2aDb0EfF4cB5Ec1BA10014684137ca8DC98C688`, _07 `0xF97Cc5449E4f6d58d310cc6480A6FF1643A18A30` |

## Policy `echt-policy@2` parameters (PRD §6.6)

| Parameter | Value |
|---|---|
| Convergence | ≥ 5 bullish voices, same symbol, within 6 h |
| Lookback before each post | 72 h |
| Qualifying transfer | native Sepolia ETH ≥ 0.001 ETH (1e15 wei), from a campaign source |
| Campaign source | any address that paid ≥ 2 different converging voices in their lookback windows |
| BLOCK threshold | ≥ 3 linked voices with no disclosure detected |
| Minimum verified wallets to judge | 3 (else REVIEW) |
| Exchange / hot-wallet rule | source with > 10,000 txs → REVIEW |
| Practice position | max $400, stop −8%, risk budget $32 |
| Pin depth | ≥ 12 blocks behind head |
| CRE HTTP budget | ≤ 12 of 15 calls per execution |
| Timeouts | RYO 60 s · provider 10 s · LLM 30 s |
| Scenario symbol | **TBD**: the first symbol RYO returns `status: ok` for once its market data recovers |

## Deadlines

| Event | Submit by |
|---|---|
| BLI Legal Tech Hackathon 2 (DoraHacks) | Sat 31 Oct 2026, 20:00 Lagos |
| RYO-CHAN Hackathon 2026 | Wed 11 Nov 2026, 15:59 Lagos |

## Build decisions (28 Oct 2026)

Each row is a choice the build depends on. Owner: the user unless noted.

| # | Decision | Why |
|---|---|---|
| D1 | Canonical hashing: RFC 8785 implemented in `packages/policy`, plus a pure-TS SHA-256. `canonicalize` 5.1.0 is a devDependency used only to cross-check in tests. | Policy has zero runtime dependencies, and the CRE workflow must run the same hash code |
| D2 | Timing: each synthetic post is dated 8–14 h after its persona's real payment block timestamp. All 7 T1 posts fall inside one 6 h window. `postBlock` is filled from RPC only after that time has passed. A scenario whose posts are still in the future is refused. The demo shows the measured gap from block timestamps, never a hardcoded "24–48 h". | Keeps Thursday's CRE gate reachable |
| D3 | Attestations: real `signed_challenge` signatures for all 7 personas. Each scenario file chooses its verified set. T1 and T2 use all 7 verified. T4 uses 2 verified and 5 `unverified_claim`. | Real signatures, scenario-specific trust |
| D4 | CRE config: `cre/echt-verdict/echt-verdict/config.echt.json`, pointed to from `workflow.yaml` for both targets. `config.staging.json` and `config.production.json` are never edited. `secrets-path` is `../secrets.yaml`, which is the project-root file. | Q4 |
| D5 | **Approved 28 Oct.** BLOCK = ≥ 3 linked voices with no disclosure detected. Disclosed links are shown but do not count. PRD §6.6 updated to match (v0.6.2). `echt-policy@2` kept, since nothing is on-chain yet. | Owner decision |
| D6 | **Approved 28 Oct.** A campaign source is a sender whose *candidate* transfers reach ≥ 2 converging voices. A candidate is a transfer into a verified converging wallet, after the post, within the 72 h lookback, at ≥ 0.001 ETH. PRD §6.6 updated to match (v0.6.2); implemented in `packages/policy/src/payments.ts`. | Owner decision |
| D7 | Hardhat 3.21.0, toolbox-viem 5.0.7, viem 2.57.11, Solidity 0.8.28. The mock forwarder `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` is the constructor argument. The CRE receiver pattern is `onReport(metadata, report)`, gated to the forwarder. | Matches the CRE docs |
| D8 | CRE SDK pinned to 1.23.0 exactly (CLAUDE.md §2). Secret logical ID `ETHERSCAN_KEY`, mapped in `secrets.yaml` to the `.env` variable `ETHERSCAN_API_KEY`. The URL carrying the key is never logged. | Avoids the simulator's "uses itself as the env var name" warning |
| D9 | `main.ts` exports only `main()`. Helpers live in `ping.ts`, because the CRE WASM build rejects exported functions that take parameters. | Observed on 28 Oct |
| D10 | Chain scripts (`seed-testnet.ts`, `sign-attestations.ts`) live in the `scripts/` workspace package. Root-level `viem` and `tsx` were removed. | pnpm 12.3.4 wrote a broken root link for `viem` (peer suffix missing), so root-level imports failed. The contracts package links correctly |

## Scenario timing: T1 and T2 share on-chain history (28 Oct)

Every scenario reads the same chain history. A transfer that falls inside another scenario's 72 h lookback counts there too. If T2's single payment lands inside T1's lookback, T1 gets 6 linked voices instead of 5. If T1's payments land inside T2's lookback, T2 gets 5 linked voices and becomes BLOCK.

- T1 is seeded first (5 payments, personas 1–5).
- T2 is seeded at least 84 h (72 h lookback + 11 h gap) after T1's latest payment block. `scripts/seed-testnet.ts` refuses T2 before then.
- T3, T4, T5 and T6 reuse T1's on-chain transfers. They differ only in posts, attestations or provider state.

## Wallet state

- Deployer, CRE writer and campaign source each hold 0.05 ETH (28 Oct, read over RPC). Keys match the addresses above (`contracts/scripts/check-balances.ts`).
- Nothing has been deployed or seeded yet. Deploy and seed each need an explicit go-ahead.
