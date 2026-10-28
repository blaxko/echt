# CLAUDE.md — Echt

**Echt stops an AI trading agent from following coordinated crypto hype before it places a practice trade.**

Source of truth for scope: `docs/PRD.md` (v0.6). If this file and the PRD disagree, the PRD wins. Update both in the same commit.

---

## 1. What we're building and why it qualifies

Seven watched voices turn bullish on one token, so the agent proposes a practice long. Before the position opens:
1. Echt pulls live market evidence from RYO.
2. A **Chainlink CRE workflow** checks, at a pinned block, whether the converging voices' verified wallets received transfers from the same campaign source before they posted.
3. A deterministic policy returns `BLOCK` / `REVIEW` / `ELIGIBLE`.
4. The verdict is written on-chain (Ethereum Sepolia).
5. The dashboard shows the cancelled trade, every transfer, and an Evidence Brief anyone can replay.

| Entry | Deadline | Why we qualify |
|---|---|---|
| **BLI Legal Tech Hackathon 2** (DoraHacks) | Submit by **Sat 31 Oct, 20:00 Lagos** (portal locks 1 Nov 02:01) | Legal track: turns disclosure law (FTC material-connection rule, SEC anti-touting) into an auditable evidence check. Deliverables: public repo, architecture doc, video. |
| ↳ Chainlink CRE bounty (2 × $1,000) | same | The CRE workflow is the orchestration layer: chain ↔ external transfer API, consensus, EVM write, proven via `cre workflow simulate` |
| ↳ RYO-CHAN Autonomous Agents ($6,000) | same | The Multi-KOL Narrative spotlight, plus a practice trade with cause and effect and a repeatable trail |
| **RYO-CHAN Hackathon 2026** (ryobuild.com) | **11 Nov 15:59 Lagos** (ryobuild.com says 23:59 JST, the app says 23:59 UTC; we plan to the earlier) | Track 1 Agents + Track 2 Dashboards. Private repo issued via their Discord, `.env.example`, Submission Form PDF, video |

**RYO judging** (per track, 100 points): 40 common points (combining sources 20, coping with failure 20) + 60 track points.
- Track 1: real thinking 25, cause and effect 20, repeatability 10, advanced execution 5.
- Track 2: easy to read 25, sorted by importance 25, works for everyone 10.
- **Disqualifiers:** committing a real key; passing fabricated data off as real.

---

## 2. Tech stack (pin exactly; versions checked 24 Oct 2026)

| Layer | Package / tool | Version |
|---|---|---|
| Runtime | Node.js LTS | 24.x |
| Package manager | pnpm (workspaces) | 10.x or newer, set once in `packageManager` |
| CRE workflow runtime | Bun (required by `@chainlink/cre-sdk`, engines `bun >=1.2.21`) | 1.4.x |
| CRE CLI | `cre` | ≥ 1.39.0 |
| CRE SDK | `@chainlink/cre-sdk` | 1.23.0 (bundles zod 3.25.76 and viem ^2.54) |
| Language | TypeScript | 7.0.2 in apps/packages; **`cre/` keeps whatever version `cre init` pins** |
| Web | vite 8.3.5 · react / react-dom 19.3.1 · @vitejs/plugin-react 6.1.2 | |
| Styling | tailwindcss 4.3.3 · @tailwindcss/vite 4.3.3 | |
| Graph | @xyflow/react | 12.12.0 |
| Server | hono 4.13.13 · @hono/node-server 2.1.5 | |
| Validation | zod 4.6.7 (**server/web only, never in `packages/policy`**) | |
| Chain client | viem | 2.57.11 |
| Contracts | hardhat 3.21.0 · @nomicfoundation/hardhat-toolbox-viem 5.0.7 | Solidity 0.8.x |
| LLM | `openai` SDK 7.45.1 against any OpenAI-compatible endpoint, set by `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`. Default: **Groq free tier**, `openai/gpt-oss-120b` (fallback `openai/gpt-oss-20b`; verified 27 Oct with JSON mode). Groq retires models often: check `GET $LLM_BASE_URL/models` if a call returns `model_not_found`. Also works: xAI Grok (`https://api.x.ai/v1`), Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`) | extraction only; JSON mode + zod validation |
| Hashing | canonicalize 5.1.0 (RFC 8785) + node:crypto sha256 | |
| Tests | vitest 5.0.5 · @axe-core/cli 4.14.0 | |
| Dev | tsx 4.23.15 · concurrently 10.0.6 · dotenv 18.0.9 | |
| Secrets scan | gitleaks (binary, via winget or scoop) | latest |
| Chain | Ethereum Sepolia (chain id 11155111) | |
| Transfer history | Etherscan V2 API (`chainid=11155111`, free tier); fallback Alchemy `alchemy_getAssetTransfers` | Base Sepolia rejected: "Paid Tier Only" on Etherscan |
| Explorer links | `https://sepolia.etherscan.io/tx/{hash}` | |
| Market data | RYO MCP/REST `https://app-ryochan.com/api/mcp` | protocol 2024-11-05 |

**Machine:** Windows, PowerShell, **no Docker, no WSL** unless the CRE CLI forces it. Disk is tight, so avoid heavy installs.

---

## 3. Repo structure

```
echt/
  CLAUDE.md                 this file
  docs/
    PRD.md                  requirements, acceptance criteria (source of truth)
    ARCHITECTURE.md         diagrams, data flow, CRE limits table (BLI deliverable)
    LIMITATIONS.md          what Echt does NOT prove; synthetic vs real
    evidence-brief.html     printable Evidence Brief template
  apps/
    web/                    Vite + React decision dashboard (one screen, five zones)
    server/                 Hono API + SSE; run orchestrator; RYO, LLM, CRE runner clients
  packages/
    policy/                 PURE TS: types, echt-policy@2, canonical snapshot + hashing. Zero runtime deps, no I/O
  cre/
    echt-verdict/           CRE TS workflow (Bun): HTTP trigger → transfer lookups → consensus → policy → writeReport
  contracts/
    contracts/EchtVerdicts.sol   receiver contract; stores verdicts by runId; forwarder-only
    ignition/ or scripts/        deploy script
  scripts/
    load-env.ps1            dot-source to load .env into a PowerShell session: . .\scripts\load-env.ps1
    seed-testnet.ts         sends small native Sepolia ETH payments from the campaign wallet to persona wallets (T1–T3), writes scenarios/addresses.json (committed, so cloners reuse it)
    sign-attestations.ts    signs echt:{handle}:{nonce} with each persona wallet
  scenarios/
    fixtures/               real RYO responses captured 27 Oct during a RYO market-data outage: ryo-tools-catalog.json (tool schemas), ryo-market_overview.json (status partial, nulls), ryo-scan_market.json (status unavailable), ryo-*-error.json (HTTP errors, VALIDATION_FAILED). Re-capture an ok envelope when RYO recovers (ryo-analyze_token-<SYM>.json). Use these for response shapes and the failure path
    T1-coordinated.json … T6-tampered.json   inputs + expected outputs
    addresses.json          generated; testnet addresses and tx hashes
    wallets.local.json      generated persona keys, gitignored, never read or print
  .claude/settings.json     denies Read on .env and *.local.json
  .env.example              every variable, no values
  .gitattributes            * text=auto eol=lf
  .gitignore                .env, .env.local, *.local.json, *.key, node_modules, dist
```

**Env vars (`.env.example`):** `RYO_MCP_URL`, `RYO_MCP_KEY`, `RYO_RATE_PER_MINUTE`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `ETHERSCAN_API_KEY`, `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `CRE_ETH_PRIVATE_KEY`, `CAMPAIGN_PRIVATE_KEY`, `ECHT_VERDICTS_ADDRESS`

Code reads these from `process.env`. Never open, print or log `.env`. The RYO client must throttle to `RYO_RATE_PER_MINUTE`.

---

## 4. Build phases

Build starts **Tue 27 Oct evening**: 4 days to BLI. Each phase ends with a **gate**. Don't start the next phase until the gate passes.

0. [ ] **Day 0 — Tue 27 (evening): truth tests + scaffold**
   - [x] RYO key issued; `/health`, `/whoami`, catalog and `analyze_token` / `deep_analysis` fixtures saved in `scenarios/fixtures/`
   - [x] Install Bun 1.4.4 + CRE CLI v1.39.0; `cre login`; `cre account access` (request submitted 27 Oct)
   - [ ] `cre workflow supported-chains`: confirm Ethereum Sepolia; note the forwarder address in `docs/DECISIONS.md`
   - [ ] Etherscan V2 `txlist` on `chainid=11155111` returns `status` 1 or "No transactions found"
   - [x] `cre init` TS project at `cre/echt-verdict`; hello-world `cre workflow simulate echt-verdict` passed 27 Oct 23:00 Lagos
   - [ ] pnpm workspace scaffolded (apps/web, apps/server, packages/policy, contracts); `pnpm test` runs
   - **Gate:** one CRE hello-world simulation runs; one Etherscan call works.
1. [ ] **Day 1 — Wed 28: policy + chain + CRE skeleton**
   - [ ] `packages/policy`: types, policy@2, canonical hash, unit tests for T1–T6 and every rule in PRD §6.6 / §10.2
   - [ ] Deploy `EchtVerdicts` (forwarder-only, idempotent by runId)
   - [ ] `seed-testnet.ts`: T1/T2 transfers; `sign-attestations.ts`
   - [ ] `cre/echt-verdict`: HTTP trigger + one Etherscan call simulates
   - **Gate:** `pnpm test` green; seeded transactions visible on sepolia.etherscan.io.
2. [ ] **Day 2 — Thu 29: CRE end-to-end (CRITICAL)**
   - [ ] Workflow: HTTP trigger → ≤12 provider calls at pinned `endblock` → identical consensus → `packages/policy` → `writeReport` → `EchtVerdicts`
   - [ ] Minimal orchestrator: snapshot, cached extraction, convergence, proposal, RYO client (backoff + rate limit), triggers the simulation
   - **Gate:** a T1 `BLOCK` verdict on Ethereum Sepolia from the simulation, started by the server.
   - **If missed by 18:00:** cut to 3 wallets and T1 only; no new features.
3. [ ] **Day 3 — Fri 30: dashboard + proof** (use the `design-stack` skill)
   - [ ] Five zones: decision banner → payment graph → proposal → market evidence → proof; run log
   - [ ] States BLOCK / REVIEW / ELIGIBLE; edges link to `sepolia.etherscan.io/tx/...`
   - [ ] Evidence Brief, JSON export, Replay; T5 fault flag; `pnpm test:scenarios`
   - **Gate:** T1, T2, T5 run end-to-end; Replay MATCH on T1, HASH_MISMATCH on T6.
4. [ ] **Day 4 — Sat 31: film + submit BLI by 20:00 Lagos.** No features after 12:00.
   - [ ] 2-minute video; README (≤5 commands to run); ARCHITECTURE.md; LIMITATIONS.md
   - [ ] DoraHacks BUIDL; apply to the Chainlink CRE bounty
5. [ ] **1–11 Nov: RYO entry**
   - [ ] T3/T4 end-to-end; remaining dashboard states; keyboard + axe pass; hallway test; naive-agent baseline; cold-run review
   - [ ] Push to the RYO private repo `main`; Submission Form PDF; X post tagging @ryodigital
   - [ ] Submit by **11 Nov 15:59 Lagos**

---

## 5. Commands (PowerShell)

```powershell
# one-time installs
winget install OpenJS.NodeJS.LTS
corepack enable
powershell -c "irm bun.sh/install.ps1 | iex"
irm https://app.chain.link/cre/install.ps1 | iex      # then open a NEW terminal
cre version ; cre login ; cre account access
winget install gitleaks

# every new terminal, from the repo root
. .\scripts\load-env.ps1

# repo
pnpm install
pnpm dev                      # server :8787 + web :5173 (concurrently)
pnpm test                     # vitest: policy, snapshot, server
pnpm test:scenarios           # all 6 scenarios end-to-end → expected-vs-actual table
pnpm lint ; pnpm typecheck
gitleaks detect --no-banner   # must report 0 leaks before every push

# contracts (Hardhat 3)
pnpm --filter contracts compile
pnpm --filter contracts deploy:sepolia
pnpm seed:testnet             # tsx scripts/seed-testnet.ts → scenarios/addresses.json
pnpm sign:attestations

# CRE (run inside cre/echt-verdict)
cd cre/echt-verdict ; bun install
cre workflow supported-chains
cre workflow simulate echt-verdict --http-payload ../../scenarios/payloads/T1.json --broadcast
#   if --broadcast is rejected, check `cre workflow simulate --help` for the on-chain write flag in this CLI version
cre workflow simulate echt-verdict --listen   # re-runs on each POST to :2000 (used by the server in dev)

# RYO checks
curl.exe -s "$env:RYO_MCP_URL/health"
curl.exe -s "$env:RYO_MCP_URL/whoami" -H "Authorization: Bearer $env:RYO_MCP_KEY"
curl.exe -s "$env:RYO_MCP_URL/tools" -H "Authorization: Bearer $env:RYO_MCP_KEY"

# accessibility
pnpm --filter web build ; pnpm --filter web preview
npx @axe-core/cli http://localhost:4173 --exit
```

Use `;` between commands (Windows PowerShell 5.1 has no `&&`). Use `curl.exe`, not the `curl` alias.

---

## 6. Demo plan: what the judge sees, in order (~2 min, readable with sound off)

| Time | Screen |
|---|---|
| 0:00–0:12 | **Anchor:** the cited 2025 ZachXBT finding (~160 influencers paid, fewer than 5 disclosed). Attributed, not our data |
| 0:12–0:25 | Watchlist of 7 **SYNTHETIC**-badged personas; posts arrive; convergence alert |
| 0:25–0:40 | Agent proposes **Practice long · $400** with its rationale. RYO market evidence appears, labelled **LIVE** |
| 0:40–1:15 | Live run log: "Checking 7 wallets up to block …". The CRE simulation runs. **Payment graph lights up: one source → 5 wallets, posts measured 8–14 h after their payments** |
| 1:15–1:30 | Proposal struck through; banner flips to **NO POSITION · BLOCK**. Click an edge and the real Etherscan transaction opens |
| 1:30–1:45 | Switch to T5: provider down → **REVIEW**, with the reason named. Switch to T2 → **ELIGIBLE**, practice position opened |
| 1:45–2:00 | Evidence Brief, evidence hash = the on-chain record, Replay → MATCH. Limitations line: synthetic personas, testnet transfers, local CRE simulation |

Show one real failed run before the successful rerun. Never label a recording as live.

---

## 7. 60-second spoken pitch

> Crypto influencers get paid to push tokens, and almost none of them disclose it. A leaked campaign last year showed around 160 paid influencers, and fewer than five labelled the post as an ad.
>
> Now AI trading agents are reading those same feeds. When seven trusted voices suddenly agree, a naive agent buys.
>
> Echt is the check that runs before the trade. When our agent sees seven bullish voices, it proposes a practice position. Then a Chainlink CRE workflow pulls transfer history at a pinned block and asks one question: did these "independent" wallets get funded by the same source before they posted?
>
> Here, five of seven did, with no disclosure. The agent changes its mind. No position.
>
> Every transfer links to the chain. The verdict is written on-chain with the hash of the evidence, and anyone can replay it and get the same answer.
>
> Echt doesn't decide who broke the law. It shows the pattern, and it makes sure an agent never trades on hype it can't trust.

---

## 8. Known errors and bad patterns

**CRE**
- `Date.now()`, `Math.random()`, `Promise.race()` in the workflow cause non-determinism warnings and break consensus. Pass all time values in the payload.
- An unpinned `endblock` lets nodes see different histories, so consensus fails. Always pin `pinnedToBlock` (≥12 blocks behind head).
- EVM log reads only reach back 100 blocks. Get transfer history over HTTP, never via `eth_getLogs` in the workflow.
- Hard limits: 15 HTTP calls, 250 KB response, 100 KB workflow response, 5 min execution. Our budget is ≤12 calls. Trim provider responses to the fields we use.
- `packages/policy` importing zod 4 (or anything) clashes with the SDK's bundled zod 3.25.76. Keep the policy package dependency-free.
- `cre init` created a second `.env` at `cre/echt-verdict/.env` (gitignored by the root `.gitignore`). Don't copy secrets into it. Run CRE commands with `-e ..\..\.env` (from `cre/echt-verdict`) so the root `.env` is the only place keys live.
- Layout from `cre init` (27 Oct): project `cre/echt-verdict/` (project.yaml, secrets.yaml, .env) containing workflow `cre/echt-verdict/echt-verdict/` (main.ts, main.test.ts, workflow.yaml, config.staging.json, config.production.json). Install with `bun install --cwd ./echt-verdict`, simulate with `cre workflow simulate echt-verdict`, both from `cre/echt-verdict`.
- Running the workflow with Node instead of Bun fails. `cre/` is a Bun project.
- Hardcoding the forwarder address. Read it from `cre workflow supported-chains`; simulation and deployment may differ.
- Don't switch chains. Base Sepolia's Etherscan API is paid-only. Ethereum Sepolia already took its Glamsterdam upgrade (6 Oct); if a new network-upgrade notice appears before filming, avoid writes in the ~30 min around it.
- Callbacks are stateless. Never rely on module-level state between trigger fires.

**RYO**
- MCP tool failures come back as **HTTP 200 with `result.isError: true`**. Check it.
- REST tool failures come back as an **HTTP error with a JSON body** `{code, message, details, trace_id}`, e.g. `VALIDATION_FAILED` "Current USD market data is unavailable for SOL" (seen 27 Oct). Read the body, map it to market gate `UNAVAILABLE`, log `trace_id`, never retry it as if it were a 429. Saved as `scenarios/fixtures/ryo-*-error.json`.
- Coverage varies by symbol and over time. Pick the scenario symbol from a symbol that returned `status: ok` in a saved fixture, and keep the failure fixture as the T5-style market-unavailable case.
- **27 Oct 21:17 Lagos: RYO market data was down for every symbol tried** (BTC, ETH, SOL failed; `market_overview` partial with nulls; `scan_market` unavailable). Build the client against the error/partial fixtures first; never fake an `ok` envelope.
- Key facts (27 Oct): `scopes tools:read`, `rate_limit_per_min 60`, `expires_at 2026-12-17`.
- The MCP `text` content is a JSON string. Parse it once.
- `null` or unavailable ≠ 0. Never coerce.
- There is **no `check_safety` tool.** Tools take **symbols, not addresses.** Read `GET /tools` at startup; the live catalog is authoritative.
- On 429/503, use exponential backoff with jitter (3 tries, 1 s base). Read the `Retry-After` and `X-RateLimit-*` headers.
- The key must never reach the browser. All calls go through `apps/server`.

**Scenario timing (PRD v0.6.1)**
- Never hardcode "24–48 h" in UI, copy or fixtures. Post times are `payment block timestamp + 8–14 h`, and the gap shown is measured from block timestamps.
- A scenario whose posts are still in the future is refused. Do not fill `postBlock` before that time has passed.
- T1 and T2 read the same chain history. T2 uses its own personas 08–14, so the two scenarios read disjoint wallet sets. A test proves the sets are disjoint. Never reuse a T1 wallet in T2.

**Data and hashing**
- `JSON.stringify` for hashing gives a non-canonical hash. Use `canonicalize`.
- Windows CRLF in fixtures changes bytes. `.gitattributes eol=lf`, and hash canonical JSON, never raw file bytes.
- Assuming private keys start with `0x`. MetaMask/Rabby export 64 hex characters without it. Normalize on read (`k.startsWith('0x') ? k : '0x' + k`) and never log the value.
- Floats for ETH amounts. Use `amountWei` as a decimal string / `bigint`.
- Adding a test token, a faucet step or a wallet requirement for users. There is no test token: payments are native Sepolia ETH, read with Etherscan `txlist`. Testers need nothing but a browser (PRD §11b).
- Calling the LLM during Replay. Replay is offline: cached extraction only.

**LLM (free tier)**
- Provider-specific SDKs (`@anthropic-ai/sdk`, `groq-sdk`, `@google/genai`). Use only the `openai` SDK with `baseURL` from env, so switching provider is an `.env` change.
- Relying on `response_format: json_schema`. Not every provider or model supports it. Use `{ type: "json_object" }`, put the schema in the prompt, validate with zod, retry once, then mark `extraction_failed`.
- Hitting free-tier limits (Groq: ~30 requests/min, per-model tokens/min). Extract posts one at a time with a small delay, honour `retry-after` on 429, and cache by `sha256(postText + LLM_MODEL + promptVersion)` so each post is extracted once.
- Hardcoding a model name in code. Read `LLM_MODEL` from env; on `model_not_found`, fail with a message telling the user to pick a model from `GET $LLM_BASE_URL/models`.
- Free tiers may train on prompts. Only synthetic persona posts are ever sent. Never send keys, wallet data or real people's posts.
- Counting a transfer that came *after* the post, or an unpriced one as $0.

**Process**
- Polishing UI before the Thu 29 CRE gate.
- Adding a feature without a PRD acceptance criterion.
- A green demo built on one scenario. All six must pass.

---

## 9. Things NOT to do

- **Never commit secrets.** `.env` stays gitignored. Run `gitleaks detect` before every push. One leaked key disqualifies the RYO entry.
- **Never add AI attribution to commits or PRs.** No `Co-Authored-By` lines and no "Generated with" footers.
- Never present synthetic, simulated or model output as live or real. Every datum carries one provenance label: `SYNTHETIC`, `TESTNET`, `LIVE`, `MODEL`, or `SIMULATED`.
- Never claim a deployed DON verified a verdict unless one actually did. Default label: **"Chainlink CRE · local simulation"**.
- Never write "paid shill", "illegal", "fraud", "scam", or "proof of payment". Use "linked transfers", "disclosure not detected", "policy threshold met".
- Never use real people's handles or wallets in scenarios or on-chain. Hash persona IDs on-chain.
- Never let a failure produce `ELIGIBLE`. Missing or inconsistent data means `REVIEW`.
- Never let an LLM decide a verdict. Models extract; `packages/policy` decides.
- Never mock a RYO response and call it a RYO call. If RYO is down, the dashboard says so.
- Never change a policy threshold without bumping `policyVersion` and updating PRD §6.6.
- Never move real funds or add trading execution. RYO tools are read-only; positions are practice only.
- Don't add Docker, WSL, mainnet, extra chains, live X scraping, auth, or ML classifiers.
- Don't edit files under `cre/echt-verdict` generated by `cre init` or `cre generate-bindings` by hand. Regenerate them.

## 10. Skills to use (Claude Code)

| Task | Skill |
|---|---|
| UI work (`apps/web`) | `design-stack` (page-flows → untitled-ui free components → checklist-design audit) |
| Any multi-file change | `agent-skills` → `incremental-implementation` + `test-driven-development` |
| CRE / RYO / provider integration | `agent-skills` → `source-driven-development` (check the official docs first) |
| Before every push | `agent-skills` → `code-review-and-quality` + `security-and-hardening` |
| Commits | `agent-skills` → `git-workflow-and-versioning` (no AI attribution lines) |

## 11. Autonomy and spend limits

Standing approval from the user (28 Oct). Ethereum Sepolia only.

**Allowed without asking**
- Before every transaction, verify chain id = 11155111. Abort on anything else, mainnet above all.
- Spend caps for the whole build: deployer ≤ 0.02 ETH total; campaign source ≤ 0.02 ETH total; CRE writer ≤ 0.01 ETH total. If an estimate would exceed a cap, retry once when gas is lower. If it still would, stop.
- Balance floor: every wallet stays ≥ 0.005 ETH after each send.
- Commit after every green step. No AI attribution lines.
- Merge `day1-build` into `main` when a gate passes, and push to `origin`. Push only after `gitleaks` is clean and `git ls-files` shows no `.env` or `*.local.json`.

**Hard stops (ask the user)**
- A spend cap would be exceeded, or a balance would drop below the floor.
- A chain id mismatch.
- Anything that needs a secret, a new account, or editing `.env`.
- A failing test that is not fixed after 2 attempts.
- A change of scope beyond the PRD.
