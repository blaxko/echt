// Landing and section copy. Every fact here comes from README.md, docs/PRD.md, docs/LIMITATIONS.md or docs/project-brief.md.
// Landing sections stay under about 40 words each. Section pages carry the fuller text.

export const DASHBOARD = "#/app";

export const REPO_URL = "https://github.com/blaxko/echt";
export const ETHERSCAN = "https://sepolia.etherscan.io";
export const CONTRACT = "0x2bc4819848efd784995ff6eab33be28b2b85bf8f";
export const T1_TX = "0xc0141cba6a540fce98f3ea414e9523d44c1a1a7ff4d2276aa0032497fc01a7be";

// The recorded T1 run, as the landing shows it. A test checks every value against scenarios/runs/T1.json.
export const T1_FACTS = {
  verdict: "NO POSITION · BLOCK",
  voices: 7,
  linked: 5,
  payments: 5,
  gapHours: "11.9 h",
  pinnedBlock: 12013685,
  evidenceHash: "0x83953d258191a53b3e274751d6cc014f5da6951bdb0c75912c17fa1e344d010e",
};
export const T2_TX = "0x97d2b04e85dca1e5aa02664795019b73b50af954dc720065bc7347c5868d5c63";

export const SOURCES = {
  theBlock: "https://www.theblock.co/post/368956/zachxbt-says-over-100-crypto-influencers-accepted-promo-deals-without-disclosing-paid-ads",
  proMarket: "https://www.promarket.org/2023/04/17/crypto-influencers-give-poor-investment-advice-and-the-sec-is-taking-notice/",
  ershov: "https://causalclaims.trfetzer.com/paper/DP18554.html",
};

export const NAV = [
  { page: "how-it-works", label: "How it works" },
  { page: "proof", label: "Proof" },
  { page: "why-it-matters", label: "Why it matters" },
  { page: "built-with", label: "Built with" },
  { page: "limits", label: "What it doesn't claim" },
  { page: "faq", label: "FAQ" },
] as const;

export const HERO = {
  title: "Seven bullish voices. One funding wallet. The agent changed its mind.",
  sub: "Echt checks whether a wave of crypto voices was paid from one source before an AI trading agent places a practice trade.",
};

export const PROBLEM = {
  id: "problem",
  title: "Paid posts often go undisclosed",
  facts: [
    { figure: "~160", text: "influencers accepted paid promotions in a 2025 leak. Fewer than 5 labelled them as ads.", source: "ZachXBT, reported by The Block", href: SOURCES.theBlock },
    { figure: "−18.9%", text: "average return of tokens those influencers recommended, measured 90 days later.", source: "ProMarket summary", href: SOURCES.proMarket },
    { figure: "~96%", text: "of influencer marketing posts in a study of over 100 million tweets were undisclosed.", source: "Ershov, He and Seiler", href: SOURCES.ershov },
  ],
  more: "why-it-matters" as const,
  moreLabel: "why it matters",
};

export const PAGES = {
  "how-it-works": {
    title: "How it works",
    intro: "Echt runs one check before a practice trade. Each step below is a separate part of the system, and each one can fail visibly.",
    body: [
      "Seven watched voices post about one token. The agent reads the same feed and proposes a practice long, with its rationale. It has no access to a wallet and moves no funds.",
      "A Chainlink CRE workflow then reads each voice's transfer history at a pinned block. It asks one question: did one sender reach at least two of the converging voices before they posted? The workflow sorts its rows and treats failed lookups as data, so the same input gives the same output on every node.",
      "A deterministic policy, echt-policy@2, decides the verdict. BLOCK needs three or more undisclosed linked voices. A missing or failed lookup gives REVIEW, never ELIGIBLE. A language model only reads each post into fields. It never decides.",
      "The verdict and a hash of its evidence are written to the EchtVerdicts contract on Ethereum Sepolia. The dashboard's Replay recomputes the decision in your browser from the stored inputs and reports MATCH or HASH_MISMATCH.",
    ],
    links: [{ label: "Open the dashboard", href: DASHBOARD }],
  },
  proof: {
    title: "Proof",
    intro: "Every verdict below is a public Sepolia transaction. Open the links and check them yourself.",
    body: [
      "The contract stores each verdict by run id and accepts writes only from the forwarder. Each verdict was read back with getVerdict before it was recorded on the dashboard.",
      "The first broadcast of each run failed silently: the receiver ran out of gas and the forwarder swallowed the revert. The transactions are kept on chain as evidence, and the fix is documented in the project's bug log.",
    ],
    list: [
      { label: "Contract EchtVerdicts", href: `${ETHERSCAN}/address/${CONTRACT}` },
      { label: "T1 verdict, BLOCK with 5 linked voices", href: `${ETHERSCAN}/tx/${T1_TX}` },
      { label: "T2 verdict, ELIGIBLE with 0 linked voices", href: `${ETHERSCAN}/tx/${T2_TX}` },
    ],
    links: [{ label: "Open the Evidence Brief for T1", href: "#/brief/T1" }, { label: "Open the dashboard", href: DASHBOARD }],
  },
  "why-it-matters": {
    title: "Why it matters",
    intro: "Coordinated promotion is hard to see from one post. It is easier to see in the payments.",
    body: [
      "Influencers were paid to promote tokens, and few said so. In a 2025 leak about 160 accepted paid promotions and fewer than 5 labelled them as ads. The payments were linked to on-chain receipts, which is how the pattern was found.",
      "AI trading agents read the same feeds. When seven trusted-looking voices agree at once, a naive agent buys. Echt is the check that asks whether those voices were independent before the agent acts.",
      "Echt does not decide that anyone broke a law. It shows linked transfers, whether disclosure was detected, and whether the policy threshold was met.",
    ],
    facts: PROBLEM.facts,
    links: [{ label: "Open the dashboard", href: DASHBOARD }],
  },
  "built-with": {
    title: "Built with",
    intro: "Each tool does one job, and each one's failure is shown on the dashboard.",
    body: [
      "Chainlink CRE is the orchestration layer. The workflow is TypeScript on Bun. It reads transfer history over HTTP, reaches consensus on the pinned block, and writes the verdict through a forwarder-gated receiver. It runs here as a local simulation with cre workflow simulate.",
      "RYO supplies live market data for the proposal. Its tools are read-only and take symbols, not addresses. RYO has been unavailable for every symbol tried since 27 October, so the dashboard reads UNAVAILABLE and never fills it in.",
      "Etherscan V2 gives the transfer history for each voice wallet. The language model is used only to extract fields from posts, through any OpenAI-compatible endpoint.",
      "Ethereum Sepolia is the chain for payments and verdicts. Nothing is written to mainnet.",
    ],
    links: [{ label: "Repository on GitHub", href: REPO_URL }],
  },
  limits: {
    title: "What Echt doesn't claim",
    intro: "A verdict is only as strong as its evidence. This is what the evidence does not show.",
    body: [
      "Echt reports patterns in transfers and whether disclosure was detected. It makes no legal finding. The words it uses are linked transfers, disclosure detected or not detected, and policy threshold met.",
      "The seven voices and their posts are synthetic, written for the test. The payments are testnet transfers. Sepolia ETH has no market value, and the payments are not trades.",
      "The CRE run is a local simulation. No Chainlink network verified the verdict, and the chain writes go through a mock forwarder.",
      "RYO market data is unavailable, so the market gate reads UNAVAILABLE on every record. The full list is in the repository's LIMITATIONS document.",
    ],
    links: [{ label: "Read LIMITATIONS on GitHub", href: `${REPO_URL}/blob/main/docs/LIMITATIONS.md` }],
  },
  faq: {
    title: "FAQ",
    intro: "Short answers. Each one links to the page that explains it.",
    qa: [
      { q: "Does Echt decide who broke the law?", a: "No. It reports linked transfers and whether disclosure was detected, and says when a policy threshold is met. It makes no legal finding." },
      { q: "Does it trade with real money?", a: "No. The agent proposes a practice position only. Nothing moves on mainnet, and the RYO tools are read-only." },
      { q: "Why is one scenario ELIGIBLE?", a: "T2 has one paid voice out of seven, so no pattern is found. A single payment is not a campaign. Missing data would give REVIEW, never ELIGIBLE." },
      { q: "Can I check a verdict myself?", a: "Yes. Each payment and verdict links to Sepolia Etherscan. Replay recomputes the decision in your browser from the stored inputs." },
      { q: "Is the market data live?", a: "Not right now. RYO market data has been unavailable since 27 October, so the dashboard shows the market gate as UNAVAILABLE." },
      { q: "Are the influencers real?", a: "No. The seven voices are synthetic personas, labelled SYNTHETIC everywhere they appear. The 2025 figures are cited from the reporting, not from Echt's data." },
    ],
    links: [{ label: "Open the dashboard", href: DASHBOARD }],
  },
} as const;
