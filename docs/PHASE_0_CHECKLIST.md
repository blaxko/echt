# PHASE 0 — Echt: everything done before opening Claude Code

Target: finish by Tue 27 Oct (evening). Every box must be provably true. Where a value is produced, write it into `.env` (secret) or `docs/DECISIONS.md` (not secret).
Windows + PowerShell. No Docker. Use `curl.exe`, not `curl`.

---

## 0. Blocking decision (do first, it changes the docs)

- [x] **Chain decided (27 Oct): Ethereum Sepolia (chain id 11155111).**
  - **Base Sepolia (84532) is "Paid Tier Only" on Etherscan's API**, checked today on docs.etherscan.io/supported-chains. The transfer lookup would fail on a free key.
  - Ethereum Sepolia is free on Etherscan, supported by CRE, and its Glamsterdam upgrade already happened (6 Oct), so the write-failure window has passed.
  - Fallback: Arbitrum Sepolia (421614): also free on Etherscan and supported by CRE.
- [ ] Record in `docs/DECISIONS.md`: `chain = ethereum-sepolia (11155111); explorer = sepolia.etherscan.io; transfer provider = Etherscan V2 tokentx`
- [x] PRD v0.4 and CLAUDE.md updated to Ethereum Sepolia. Check with `Select-String -Path docs\PRD.md,CLAUDE.md -Pattern "Base Sepolia|84532|basescan"` → 0 matches.

---

## 1. Accounts and API keys

| ✓ | Account | Where | Exact steps | Done when |
|---|---|---|---|---|
| [ ] | **DoraHacks (BLI)** | https://dorahacks.io/hackathon/legal-hack-2026/detail | Log in → Register. Note the deadline shown in *your* timezone. | The Register button reads "Registered"; deadline noted in DECISIONS.md |
| [ ] | **RYO Discord** (gets your private repo) | https://discord.gg/Pqd3gMd7KF | Join → follow the registration steps for "RYO-CHAN Virtual Hackathon 2026". | Your Discord ID is confirmed by an organiser |
| [ ] | **RYO account + builder key** | https://app-ryochan.com/login?redirect=%2Fhackathon | Create an account → find the builder MCP key. If it isn't shown, ask in the Help Desk https://discord.gg/qkWPjxzxtC | `RYO_MCP_KEY` in `.env`; `/whoami` returns your quota (§9) |
| [ ] | **Chainlink CRE** | https://app.chain.link/cre/discover | Create an account. After installing the CLI (§3): `cre login`, then `cre account access` to request deploy access. | `cre whoami` (or `cre login` success) shows your org; access request submitted |
| [ ] | **Etherscan API** | https://etherscan.io/myapikey | Sign up → API Keys → Add. One V2 key works across chains. | `ETHERSCAN_API_KEY` in `.env`; test call in §9 returns `"status":"1"` or `"No transactions found"` |
| [ ] | **Alchemy** (RPC + backup transfer API) | https://dashboard.alchemy.com | Create app → network = your chosen testnet → copy the HTTPS URL. | `SEPOLIA_RPC_URL` in `.env`; `eth_blockNumber` works (§9) |
| [ ] | **Groq API** (post extraction, free, no card) | https://console.groq.com/keys | Sign up (Google or GitHub login) → API Keys → Create API Key "echt-dev" | `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_KEY=gsk_...`, `LLM_MODEL=openai/gpt-oss-120b` in `.env`; test call in §9 returns JSON |
| [ ] | **GitHub** | https://github.com/new | Create **public** repo `blaxko/echt` (BLI needs public). No README; Claude Code creates files. | Repo URL in DECISIONS.md |
| [ ] | **X account for the RYO Social Media Award** | — | Confirm you can post publicly and tag @ryodigital later. | — |

- [ ] Send the questions in §6.4 (BLI email, RYO Discord). Paste the replies into DECISIONS.md when they arrive.

---

## 2. Wallets and credentials

> **Safety rules (non-negotiable)**
> - Create **new** wallets for Echt. Never use, import, or reuse a wallet that has ever held real funds.
> - Private keys live only in `.env` (gitignored) and your wallet app. **Never** paste a key into Claude, Discord, a screenshot, or a commit. One leaked key also disqualifies the RYO entry.
> - Testnet only. If a tool ever asks you to switch to mainnet, stop.

- [ ] Create a fresh browser wallet profile, e.g. a new MetaMask or Rabby profile named **"Echt TESTNET ONLY"**, and back up its seed phrase **offline** (paper).
- [ ] Account 1 → **deployer**. Export the private key → `DEPLOYER_PRIVATE_KEY`
- [ ] Account 2 → **CRE writer**. Export the private key → `CRE_ETH_PRIVATE_KEY`
- [ ] Account 3 → **campaign source** (pays the scenario personas). Export the key → `CAMPAIGN_PRIVATE_KEY`
- [ ] Persona wallets (7): **don't create by hand.** `scripts/seed-testnet.ts` generates them into `scenarios/wallets.local.json` (gitignored), Day 2.
- [ ] Fund the deployer with ≥ **0.2 test ETH** on the chosen chain. Faucets (try in order):
  - Google Cloud Web3 faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
  - Chainlink faucet: https://faucets.chain.link
  - Alchemy faucet: https://www.alchemy.com/faucets
- [ ] Send 0.03 test ETH from the deployer to the CRE writer and to the campaign source.
- [ ] Check all three balances on sepolia.etherscan.io and paste the addresses (**addresses only**) into DECISIONS.md.

---

## 3. Tools to install (exact commands, PowerShell)

| ✓ | Tool | Command | Verify (expected) |
|---|---|---|---|
| [ ] | Git for Windows | `winget install Git.Git` | `git --version` → 2.4x+ |
| [ ] | Node.js 24 LTS | `winget install OpenJS.NodeJS.LTS` | `node -v` → v24.x |
| [ ] | pnpm via corepack | `corepack enable ; corepack prepare pnpm@latest --activate` | `pnpm -v` → prints a version |
| [ ] | Bun (required by the CRE TS SDK, ≥ 1.2.21) | `powershell -c "irm bun.sh/install.ps1 \| iex"` | New terminal: `bun --version` → ≥ 1.2.21 |
| [ ] | CRE CLI (≥ 1.39.0) | `irm https://app.chain.link/cre/install.ps1 \| iex` | New terminal: `cre version` → ≥ 1.39.0 |
| [ ] | gitleaks | `winget install Gitleaks.Gitleaks` | `gitleaks version` |
| [ ] | GitHub CLI (optional, for repo and push auth) | `winget install GitHub.cli ; gh auth login` | `gh auth status` → logged in |
| [ ] | Claude Code desktop app | already installed | Opens; signed in |

- [ ] Disk check: `Get-PSDrive C` → **≥ 5 GB free**. Clear space first if not.
- [ ] Everything above verified in **one new PowerShell window**, so PATH is confirmed.

---

## 4. Read before coding (tick only after reading)

**Our own docs**
- [ ] `docs/PRD.md` v0.3: §6.6 policy, §10 test matrix, §11 acceptance criteria
- [ ] `CLAUDE.md`: §8 known errors, §9 do-nots
- [ ] *Echt — Competitive Review & Upgrade Plan*: P0 table and the safer decision wording

**Sponsor docs**
- [ ] RYO Builder MCP Guide: https://ryobuild.com/docs/MCP-Builder-Guide.md (envelope fields, `isError`, rate limits)
- [ ] RYO rules and rubric: https://ryobuild.com/hackathon (the two disqualification rules)
- [ ] CRE overview + TS getting started: https://docs.chain.link/cre
- [ ] CRE supported networks (TS): https://docs.chain.link/cre/supported-networks-ts.md
- [ ] CRE templates: https://docs.chain.link/cre/templates (pick the HTTP-trigger + EVM-write starting point)
- [ ] CRE CLI releases: https://github.com/smartcontractkit/cre-cli/releases
- [ ] Chainlink CRE bounty: https://dorahacks.io/hackathon/bounty/1362
- [ ] RYO bounty: https://dorahacks.io/hackathon/bounty/1380
- [ ] BLI deliverables (public repo, architecture doc, video): https://bli.tools/international-hackathon-with-ryo-digital-chainlink-labs-focuses-on-ai-payrails-stablecoins-more/

**Data provider and legal**
- [ ] Etherscan V2 docs, account `tokentx` endpoint with `startblock` / `endblock`: https://docs.etherscan.io
- [ ] Etherscan chain tiers: https://docs.etherscan.io/supported-chains
- [ ] FTC Endorsement Guides FAQ (disclosure language): https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking

---

## 5. Risk and policy parameters (decide now, write to `docs/DECISIONS.md`)

Defaults come from PRD v0.3. Changing one later bumps `policyVersion`.

| ✓ | Parameter | Default | Your value |
|---|---|---|---|
| [ ] | Convergence: minimum voices | 5 | |
| [ ] | Convergence: window | 6 h | |
| [ ] | Watchlist size | 20 (scenario uses 7 converging) | |
| [ ] | Payment lookback before each post | 72 h | |
| [ ] | Minimum qualifying transfer | $50 (test token priced at $1 = 1 token) | |
| [ ] | BLOCK threshold (linked + undisclosed voices) | 3 | |
| [ ] | Minimum verified wallets to judge at all | 3 (else REVIEW) | |
| [ ] | Practice position: max size | $400 | |
| [ ] | Stop-loss | 8% | |
| [ ] | Risk budget per trade | $32 | |
| [ ] | Pin depth behind chain head | 12 blocks | |
| [ ] | CRE HTTP call budget | ≤ 12 of 15 | |
| [ ] | Timeouts: RYO / provider / LLM | 60 s / 10 s / 30 s | |
| [ ] | RYO retries on 429/503 | 3, 1 s base, jitter | |
| [ ] | Disclosure terms counted as "detected" | `#ad`, `#sponsored`, "paid partnership", "sponsored by", "I was paid" | |
| [ ] | Exchange / hot-wallet rule | Source with > 10,000 txs → REVIEW | |
| [ ] | **Real symbol personas mention** (for live RYO evidence) | Choose after §9 shows `analyze_token` returns `status: ok` for it | |
| [ ] | Policy version string | `echt-policy@2` | |

---

## 6. Content to pre-write (save each to the path shown)

### 6.1 Extraction system prompt → `apps/server/prompts/extract.v1.md`
- [ ] Saved verbatim:

```text
You extract structured fields from one short social-media post about crypto.
Return ONLY JSON matching the provided schema. No prose.

Fields:
- token_symbol: the single token the post is mainly about, as an uppercase ticker without "$". null if none or more than one is equally central.
- sentiment: "bullish" | "bearish" | "neutral" toward that token.
- conviction: 0..1, how certain the author sounds (hedged = low, absolute = high).
- urgency: 0..1, how strongly the post pushes acting now ("now", "last chance", countdowns = high).
- disclosure_detected: true only if the post itself states a paid or material relationship (e.g. "#ad", "#sponsored", "paid partnership", "I was paid", "sponsored by"). Vague words like "partner" or "collab" alone are false.
- disclosure_evidence: the exact disclosing phrase, or null.

Rules: Judge only the text given. Do not guess about the author. Do not infer payment. If unsure about any field, use the most conservative value (neutral, 0.0, false, null).
```

### 6.2 Scenario content → `scenarios/personas.md`
- [ ] 7 persona handles fixed: `@echt_persona_02, _04, _07, _09, _11, _13, _16`. Each gets a one-line bio ending "(synthetic persona for Echt demo)".
- [ ] For each of T1–T5: 7 posts written (35 total). Each names the real symbol from §5, timestamps fit inside the 6 h window, and T3's posts contain a clear disclosure.
- [ ] Each post is under 280 characters, contains no real person's name, no links, and no price promises with numbers.

### 6.3 Required wording → `docs/LIMITATIONS.md`
- [ ] Saved:

```text
Echt identifies evidence patterns: transfers into verified wallets from a common source before those wallets' owners posted, and whether a disclosure was detected. It does not determine that anyone was paid for promotion, that any law was broken, or that a token is safe. Personas and posts are synthetic. Transfers are real testnet transactions we created. Market evidence is live RYO data. The Chainlink CRE workflow runs in the CRE CLI's local simulator, which makes real API and testnet calls; it is not a deployed DON run unless stated otherwise. Positions are practice only; no funds move.
```

### 6.4 Questions to send today
- [ ] **RYO Discord (Help Desk):**
  > Building "Echt" for Track 1 + Track 2. (1) Can a BUIDL also submitted to the BLI Legal Tech Hackathon enter RYO-CHAN Hackathon 2026? (2) Is the DoraHacks "RYO-CHAN Autonomous Agents" bounty on BLI the same prize as RYO Track 1? (3) In `deep_analysis`, which field holds the deterministic verdict? (4) Builder key quota per day?
- [ ] **hello@bli.tools:**
  > Team Echt (BLI Legal Tech Hackathon 2). Please confirm: (1) exact submission lock time and timezone, (2) whether main tracks award prizes beyond the two bounties, and in what currency, (3) required artifacts beyond public repo, architecture doc and video.

### 6.5 Judge copy → `docs/pitch.md`
- [ ] The 60-second pitch from `CLAUDE.md` §7 saved, read aloud once, timed at ≤ 60 s.

---

## 7. Demo target (visualize the end state)

- [ ] Opened the **Echt Decision Dashboard** canvas (Claude artifact) and clicked through all three tabs: T1 BLOCK, T5 REVIEW, T2 ELIGIBLE.
- [ ] Can say the final frame from memory:
  - Banner: **NO POSITION** · BLOCK · "5 of 7 converging voices received transfers from one source 24–48 h before posting. No disclosure detected."
  - The proposal card is struck through but still visible.
  - Five orange edges run from one campaign source; each opens an explorer transaction.
  - The proof strip shows an evidence hash equal to the on-chain record, and Replay shows MATCH.
- [ ] Wrote the one sentence a judge should repeat afterwards in `docs/pitch.md`: *"Seven bullish voices. One funding wallet. The agent changed its mind."*

---

## 8. Git identity (before the first commit)

```powershell
git config --global user.name "Oladipupo Ayoola"
git config --global user.email "<your GitHub noreply address>"   # GitHub → Settings → Emails → copy the @users.noreply.github.com address
git config --global init.defaultBranch main
git config --global core.autocrlf false        # repo enforces LF via .gitattributes (hash stability)
git config --global pull.rebase true
```

- [ ] `git config --global --list` shows the name, the noreply email, `init.defaultBranch=main`, and `core.autocrlf=false`.
- [ ] GitHub → Settings → Emails → **"Block command line pushes that expose my email"** is ON.
- [ ] Commit rule acknowledged: **no `Co-Authored-By` or AI attribution lines**, ever (it's in CLAUDE.md §9).
- [ ] Repo files ready to add on the first commit: `.gitignore` containing `.env`, `*.local.json`, `node_modules/`, `dist/`; and `.gitattributes` containing `* text=auto eol=lf`.

---

## 9. Final sanity check (all must pass; paste outputs into DECISIONS.md, keys redacted)

```powershell
# load .env into this session first, e.g.:
Get-Content .env | ? { $_ -match '^\s*[^#].*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }

node -v ; pnpm -v ; bun --version ; cre version ; gitleaks version ; git --version

curl.exe -s "$env:RYO_MCP_URL/health"
curl.exe -s "$env:RYO_MCP_URL/whoami" -H "Authorization: Bearer $env:RYO_MCP_KEY"
curl.exe -s -X POST "$env:RYO_MCP_URL/tools/analyze_token/call" -H "Authorization: Bearer $env:RYO_MCP_KEY" -H "Content-Type: application/json" -d '{\"symbol\":\"SOL\"}'

curl.exe -s "https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=tokentx&address=<deployer>&startblock=0&endblock=99999999&sort=asc&apikey=$env:ETHERSCAN_API_KEY"
curl.exe -s -X POST $env:SEPOLIA_RPC_URL -H "Content-Type: application/json" -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_blockNumber\",\"params\":[]}'

$llmBody = @{ model = $env:LLM_MODEL; response_format = @{ type = "json_object" }; messages = @(@{ role = "user"; content = 'Reply with the JSON object {"ok": true} and nothing else.' }) } | ConvertTo-Json -Depth 5
(Invoke-RestMethod "$env:LLM_BASE_URL/chat/completions" -Method Post -Headers @{ Authorization = "Bearer $env:LLM_API_KEY" } -ContentType "application/json" -Body $llmBody).choices[0].message.content

cre workflow supported-chains
```

- [ ] Tool versions meet §3: Node 24, Bun ≥ 1.2.21, CRE ≥ 1.39.0.
- [ ] RYO `/health` → `"status":"ok"`, `"tools":6`.
- [ ] RYO `/whoami` → your key label + quota (not 401).
- [ ] `analyze_token` returns an envelope with `status` and `data_mode`. Saved to `scenarios/fixtures/ryo-analyze-SOL.json`.
- [ ] Etherscan returns `"status":"1"`, or `"0"` with "No transactions found". **Not** "Free API access is not supported for this chain".
- [ ] RPC returns a hex block number.
- [ ] LLM test prints `{"ok": true}` (or `{"ok":true}`). A 401 means a wrong `LLM_API_KEY`; a 404 means a wrong `LLM_MODEL` or `LLM_BASE_URL`.
- [ ] `cre workflow supported-chains` lists your chosen chain. Its forwarder address is pasted into DECISIONS.md.
- [ ] `.env` contains all of: `RYO_MCP_URL, RYO_MCP_KEY, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, ETHERSCAN_API_KEY, SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, CRE_ETH_PRIVATE_KEY, CAMPAIGN_PRIVATE_KEY`, and `.env` is in `.gitignore`.
- [ ] Deployer, CRE writer and campaign wallets hold test ETH (visible on the explorer).
- [ ] §5 parameters filled in. §6 files saved. §6.4 questions sent.
- [ ] `docs/PRD.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/LIMITATIONS.md`, `docs/pitch.md` sit in the repo folder, ready for Claude Code's first session.

**When every box is ticked:** open Claude Code in the repo folder and start Day 1 / phase 1 of CLAUDE.md §4.
