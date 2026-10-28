# Implementation Plan: Echt Day 0 (rest) + Day 1

Scope: CLAUDE.md §4 Day 0 leftovers and Day 1 only. Day 2 (CRE end-to-end, orchestrator) is out of scope.
Status: **DRAFT, awaiting approval. No code written yet.**

## Overview
Build the dependency-free policy package, the EchtVerdicts contract, seeded Sepolia test payments with persona attestations, and a CRE workflow that makes one real Etherscan V2 `txlist` call. The gate for today: `pnpm test` green, seeded transactions visible on sepolia.etherscan.io, and the CRE simulation makes the Etherscan call.

## Current state (checked 27 Oct, `main` clean)
- `cre/echt-verdict/echt-verdict/` is still the cron hello-world. `@chainlink/cre-sdk` is `^1.22.0`; CLAUDE.md §2 pins `1.23.0`.
- No root `package.json`, no pnpm workspace, no `apps/`, `packages/`, `contracts/` yet.
- `docs/DECISIONS.md` wallet table is still placeholders (`[paste public address]`). Deployer, CRE writer and campaign funding is **not confirmed**.
- `scenarios/fixtures/` has the RYO error fixtures only. There is no `ok` envelope yet, which is fine for Day 1.
- Pre-existing docs: `docs/PRD.md` v0.6, `docs/DECISIONS.md`, `docs/PHASE_0_CHECKLIST.md`, `docs/project-brief.md`.

## Architecture decisions
- **pnpm workspace** members: `apps/web`, `apps/server`, `packages/policy`, `contracts`. `cre/echt-verdict/echt-verdict` is **not** a pnpm member: it is a Bun project with its own lockfile.
- **packages/policy has zero runtime dependencies** (CLAUDE.md §3). Canonical hashing is RFC 8785 implemented in-house (see Q1). Zod is not used there.
- **Policy tests use synthetic timestamps**, so the seeding timeline does not affect them (see Q2).
- **Contract**: `EchtVerdicts` takes the forwarder address in its constructor. Deploy with the CRE **mock** forwarder `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` (DECISIONS.md). Never hardcode it in code.
- **Secrets**: scripts and the CRE CLI read `process.env` or `-e ..\..\.env`. No code opens `.env`. I never read or print `.env` or `*.local.json`.
- **Commits**: one per green task on a branch `day1-build` off `main`. No push. No attribution lines. `gitleaks detect` runs before the gate, if installed.
- **Spending gate**: deploy and seed each stop for your OK before any broadcast. Dry runs and estimates are free.

## Task list

### Phase A: Day 0 leftovers

**Task 1: Root pnpm workspace and test harness**
- Description: root `package.json` (`packageManager` pnpm 10.x, engines Node 24), `pnpm-workspace.yaml` (apps/*, packages/*, contracts), `tsconfig.base.json`, a root `vitest` config, and skeleton packages for `apps/web` (Vite + React 19 placeholder) and `apps/server` (Hono placeholder). No UI work (CLAUDE.md §8: no polish before the CRE gate).
- Acceptance:
  - [ ] `pnpm install` completes with no errors
  - [ ] `pnpm test` runs, with one smoke test per package, green
  - [ ] Pinned versions match CLAUDE.md §2
  - [ ] `cre/` is excluded from the workspace
- Verification: `pnpm install ; pnpm test`
- Dependencies: none
- Files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `apps/web/**`, `apps/server/**`, `packages/policy/package.json`, `contracts/package.json`
- Scope: M

### Phase B: Day 1, policy

**Task 2: `packages/policy` types and canonical hash**
- Description: PRD §9.3 types (`Persona`, `Post`, `Extraction`, `Transfer`, `RyoEnvelope`, `Decision`, `ReasonCode`) and `echt-policy@2` constants. Canonical JSON serializer (RFC 8785) and `sha256` over the canonical bytes using `node:crypto`, or `crypto.subtle` if the workflow needs it (see Q1). Section sub-hashes so Replay can name the changed section.
- Acceptance:
  - [ ] Types match PRD §9.3 exactly
  - [ ] Canonical bytes are stable across key order; `1` and `1.0` serialize identically to JCS
  - [ ] Hash changes for any 1-byte change
  - [ ] Cross-check test against `canonicalize` 5.1.0 as a devDependency only
  - [ ] No runtime dependencies in `package.json`
- Verification: `pnpm --filter @echt/policy test`
- Dependencies: 1
- Files: `packages/policy/src/types.ts`, `src/canonical.ts`, `src/hash.ts`, `src/index.ts`, `test/canonical.test.ts`
- Scope: M

**Task 3: `packages/policy` echt-policy@2 engine and failure mapping**
- Description: `policy.config.ts` with the §6.6 thresholds (DECISIONS.md values). Payment verdict (BLOCK / REVIEW / ELIGIBLE), disclosed-link handling, campaign-source detection from transfers, the market gate, final-action combiner, and the §10.2 failure mapping. Pure functions only.
- Acceptance:
  - [ ] Every row of §6.6 tables has a test
  - [ ] Every row of §10.2 has a test
  - [ ] A failure never yields ELIGIBLE (property test)
  - [ ] Removing any qualifying transfer from T1 never raises severity (PRD §11 F6)
  - [ ] No I/O imports
- Verification: `pnpm --filter @echt/policy test`
- Dependencies: 2
- Files: `packages/policy/src/policy.config.ts`, `src/verdict.ts`, `src/market.ts`, `src/final.ts`, `src/failures.ts`, `test/policy.test.ts`, `test/failures.test.ts`
- Scope: L (split into two commits: verdict, then failures)

**Task 4: Scenario inputs T1–T6 and policy tests**
- Description: `scenarios/T1-coordinated.json` … `T6-tampered.json` as inputs with expected outputs (PRD §10.1). Synthetic posts, personas and transfers, all clearly labelled `SYNTHETIC` / `TESTNET` in provenance fields. T5 is the `provider_down` fault. T6 is T1 with one amount changed. No real handles. Persona handles `@echt_persona_NN`.
- Acceptance:
  - [ ] T1 → `BLOCK · THRESHOLD_MET`, T2 → `ELIGIBLE`, T3 → `ELIGIBLE + DISCLOSED_CAMPAIGN`, T4 → `REVIEW · INSUFFICIENT_VERIFIED_WALLETS`, T5 → `REVIEW · PROVIDER_FAILED`, T6 → hash differs from T1
  - [ ] Tests read the scenario files; they do not inline data
- Verification: `pnpm --filter @echt/policy test`
- Dependencies: 3
- Files: `scenarios/T1-…T6-*.json`, `packages/policy/test/scenarios.test.ts`
- Scope: M
- Note: the posts' real-chain timing is handled in Task 6 (see Q2). These fixtures use synthetic times.

### Phase C: Day 1, contract

**Task 5: `EchtVerdicts` contract and tests**
- Description: PRD §9.4 struct, event, `getVerdict`. Constructor takes the forwarder. `onReport` (or the receiver entry point the CRE SDK expects; confirm in docs before writing) accepts only the forwarder. A second report for the same `runId` reverts with `AlreadyRecorded(runId)`.
- Acceptance:
  - [ ] Compiles with Hardhat 3 (`pnpm --filter contracts compile`)
  - [ ] Non-forwarder call reverts
  - [ ] Second report for the same `runId` reverts with `AlreadyRecorded`
  - [ ] `getVerdict` returns the stored struct
- Verification: `pnpm --filter contracts test` (local Hardhat network, no spend)
- Dependencies: 1
- Files: `contracts/contracts/EchtVerdicts.sol`, `contracts/hardhat.config.ts`, `contracts/test/EchtVerdicts.test.ts`
- Scope: M
- Note: the exact receiver interface depends on the CRE docs, checked in source-driven mode during this task.

**Task 6: Deploy script to Ethereum Sepolia, then record the address** ⚠️ *spends testnet ETH; needs your OK*
- Description: `contracts/scripts/deploy.ts`, using the deployer key from `process.env`. Constructor argument is the mock forwarder from DECISIONS.md. On success, write the address and tx hash to `docs/DECISIONS.md`.
- Acceptance:
  - [ ] Dry run prints the chain id, the constructor args and the estimated gas cost, with no broadcast
  - [ ] After your OK: deployed, verified on sepolia.etherscan.io
  - [ ] You paste `ECHT_VERDICTS_ADDRESS` into `.env`. I do not touch `.env`
- Verification: `pnpm --filter contracts deploy:sepolia`
- Dependencies: 5. Needs your funded deployer (DECISIONS.md wallet table is still placeholders, so confirm the address first).
- Scope: S

### Phase D: Day 1, testnet seeding

**Task 7: Persona wallets and attestations (no spend)**
- Description: `scripts/seed-testnet.ts` (generate-only mode) creates 7 persona wallets into `scenarios/wallets.local.json`, gitignored. `scripts/sign-attestations.ts` signs `echt:{handle}:{nonce}` with each persona wallet, for `signed_challenge` on the personas T1 and T2 need. Output: public addresses and signatures only, to `scenarios/attestations.json`.
- Acceptance:
  - [ ] `wallets.local.json` exists and is gitignored (verified with `git check-ignore`)
  - [ ] Signatures verify with viem `verifyMessage` against the public addresses
  - [ ] No private key is printed or logged
- Verification: `pnpm seed:testnet -- --generate-only ; pnpm sign:attestations`
- Dependencies: 1
- Files: `scripts/seed-testnet.ts`, `scripts/sign-attestations.ts`, `scenarios/attestations.json`
- Scope: M

**Task 8: Seed T1 and T2 payments** ⚠️ *spends testnet ETH; needs your OK*
- Description: the campaign wallet sends native Sepolia ETH: T1 is 5 personas × 0.002 ETH, T2 is 1 persona × 0.002 ETH. The script runs a dry run first, prints the total, and broadcasts only with a `--confirm` flag I pass after your OK. It writes public addresses and tx hashes to `scenarios/addresses.json`, which is committed.
- Budget: 6 × 0.002 = 0.012 ETH in transfers, plus about 6 × 21,000 gas. Expect under 0.013 ETH in total. Deploy (Task 6) adds a small amount on top.
- Acceptance:
  - [ ] Dry run prints the total before any broadcast
  - [ ] Each tx is visible on sepolia.etherscan.io
  - [ ] Etherscan V2 `txlist` for the campaign wallet returns all 6 transfers
- Dependencies: 7 and a funded campaign wallet. The timing rule in Q2 must be settled first.
- Scope: M

### Phase E: Day 1, CRE

**Task 9: CRE HTTP trigger plus one Etherscan `txlist` call**
- Description: replace the cron hello-world in `main.ts`. HTTP trigger with a zod-free payload check (the payload is plain JSON validated by hand). One Etherscan V2 `txlist` call with `chainid=11155111`, bounded by `startblock`/`endblock`, trimmed to the fields we use. No `Date.now()`, `Math.random()` or `Promise.race()`. Pin the SDK to `1.23.0` exactly. Update `main.test.ts`.
- Acceptance:
  - [ ] `cre workflow simulate echt-verdict --http-payload …` runs with `-e ..\..\.env`
  - [ ] The log shows the Etherscan call and its status (`"1"` or `"No transactions found"`), not "Free API access is not supported"
  - [ ] The workflow makes ≤ 12 HTTP calls
  - [ ] `bun test` green
- Verification: from `cre/echt-verdict`: `bun install --cwd ./echt-verdict ; cre workflow simulate echt-verdict --http-payload ..\..\scenarios\payloads\T1-ping.json -e ..\..\.env`
- Dependencies: 1, 8 (for a real address to query)
- Files: `cre/echt-verdict/echt-verdict/main.ts`, `main.test.ts`, `package.json`, `scenarios/payloads/T1-ping.json`, plus a new `config.echt.json` referenced from `workflow.yaml` (see Q4)
- Scope: M

### Phase F: Gate

**Task 10: Gate check and record**
- Description: run the full gate, then paste the outputs (keys redacted) and addresses into `docs/DECISIONS.md`.
- Acceptance:
  - [ ] `pnpm test` green
  - [ ] Seeded transactions visible on sepolia.etherscan.io (links in the report)
  - [ ] CRE simulation makes the Etherscan call and logs its status
  - [ ] `gitleaks detect --no-banner` reports 0 leaks (if gitleaks is installed; otherwise the gap is reported)
  - [ ] `git log` has one commit per green task, no attribution lines
- Scope: S

## Checkpoints
- **After Task 4:** `pnpm test` green; policy matches T1–T6.
- **After Task 6:** contract deployed; address recorded; `.env` updated by you.
- **After Task 8:** seeded transactions visible on the explorer.
- **After Task 10:** the Day 1 gate.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Real-chain timing: transfers must come before posts, and each post needs a mined `postBlock` (Q2) | High | Settle Q2 before Task 8; fill `postBlock` from RPC once the post time has passed |
| CRE receiver interface differs from the PRD sketch | High (Day 2) | Read the CRE docs during Task 5; keep the struct and adapt only the entry point |
| Etherscan key reaches the CRE workflow in simulation | Medium | Check the CRE secrets model during Task 9; if it can't be done, report it and stop |
| Campaign or deployer wallet not funded (DECISIONS.md still placeholders) | Medium | Confirm addresses and balances before Task 6 or 8 |
| Policy hash drifts from the canonical standard | Medium | Cross-check against `canonicalize` (Task 2) |
| `cre init` file edits | Low | Only `main.ts`, tests and `workflow.yaml` change; generated `config.*.json` is left alone |

## Open questions (decide before Task 2 or 8)
- **Q1. Canonical hashing.** CLAUDE.md §2 lists `canonicalize` 5.1.0, but §3 says `packages/policy` has zero runtime deps. My recommendation: implement RFC 8785 in-house (the data holds only strings, integers, booleans, nulls, arrays and objects, plus 0–1 floats that ECMAScript serializes correctly), and cross-check against `canonicalize` as a devDependency. This keeps the policy package dependency-free and still hashes to the standard.
- **Q2. Timing of the 24–48 h gap.** Transfers must precede each post, and each post's `postBlock` must already be mined. So if we seed today (Tue 27), the T1 posts can be dated Wed 28 to Thu 29, and their `postBlock` values get filled from RPC after those times pass. That keeps the "24–48 h" demo wording true. The alternative is a shorter gap, which means changing the PRD copy. My recommendation: seed today, date the posts 24–48 h later, and fill `postBlock` later. Please confirm.
- **Q3. Persona wallet and attestation scope.** I'm proposing 7 personas with attestations for all 7, so T1 has 5 verified and T4 has only 2 (its fault case). Confirm.
- **Q4. Where the contract address goes for CRE.** `config.staging.json` is generated by `cre init`, so I would not hand-edit it. Plan: a new `config.echt.json` referenced from `workflow.yaml`. Confirm, or name a different place.

## Approvals I need before running anything
1. Approve this plan, and answer Q1–Q4 (or accept my recommendations).
2. Task 6 deploy: OK to broadcast to Ethereum Sepolia from the deployer (dry run first).
3. Task 8 seeding: the total in Task 8 (under 0.013 ETH), and OK to broadcast.
4. Confirm the deployer, CRE writer and campaign addresses, plus their balances, since DECISIONS.md still has placeholders.

## Commands I'll use (PowerShell, no `&&`)
```powershell
pnpm install ; pnpm test
pnpm --filter @echt/policy test
pnpm --filter contracts compile ; pnpm --filter contracts test
pnpm --filter contracts deploy:sepolia      # after your OK only
pnpm seed:testnet -- --generate-only
pnpm sign:attestations
pnpm seed:testnet -- --confirm              # after your OK only
cd cre\echt-verdict ; cre workflow simulate echt-verdict --http-payload ..\..\scenarios\payloads\T1-ping.json -e ..\..\.env
gitleaks detect --no-banner
```

## Status (28 Oct, 00:05 Lagos)

| Task | State | Evidence |
|---|---|---|
| 1 pnpm workspace + test harness | done | commit `84f02cf` |
| 2 policy types, RFC 8785, pure SHA-256 | done | `13cc772`; 15 tests incl. cross-check against `canonicalize` |
| 3 echt-policy@2 engine + failure mapping | done | `e9afa7b`; 61 tests |
| 4 T1–T6 fixtures | done (unit fixtures in `packages/policy/test/fixtures/`, not `scenarios/`) | `150fe03`; real TESTNET scenarios come after Task 8 |
| 5 EchtVerdicts + Hardhat 3 | done | `8367359`; 7 contract tests; compiled with solc 0.8.28 |
| 6 deploy to Sepolia | **dry run done, waiting for your OK** | deployer 0.05 ETH; estimate ≈ 0.007 ETH at 2 gwei, 0.035 ETH at 10 gwei |
| 7 persona wallets + signed attestations | done | `155de73`; 7 signatures verified; `wallets.local.json` gitignored |
| 8 seed T1 and T2 | **T1 dry run done, waiting for your OK; T2 blocked until ≥ 84 h after T1** | T1 = 0.010 ETH plus gas |
| 9 CRE HTTP trigger + Etherscan txlist | done | simulation returned `status: "1"` from the campaign wallet; 8 bun tests; SDK pinned 1.23.0 |
| 10 gate | pending: needs Task 6 and Task 8 on chain | |

Deviations from this plan, recorded in DECISIONS.md: pnpm root-link bug, so chain scripts moved to `scripts/` (D10); the T1/T2 shared-history rule (D2 and "Scenario timing").
