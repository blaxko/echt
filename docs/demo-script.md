# Demo script (two minutes, readable with sound off)

Follows CLAUDE.md §6. Every chain link is a real Sepolia transaction. Label anything that is not live as it appears on screen. Never call a recording live.

| Time | Screen | What the viewer sees | Real link to show |
|---|---|---|---|
| 0:00–0:12 | Title card | Anchor: a 2025 leak cited by ZachXBT, about 160 influencers paid and fewer than 5 disclosing. Attributed to the cited reporting, not our data | Cite the reporting in the caption |
| 0:12–0:25 | Dashboard, T1 selected | Watchlist of seven **SYNTHETIC** personas. Convergence: seven voices bullish on ETH inside six hours | — |
| 0:25–0:40 | Proposal card | "Practice long · ETH · $400 · stop −8%" appears with its rationale. Market evidence panel reads **UNAVAILABLE** with RYO's message and trace id. Do not show LIVE market data: there is none | Trace id `30922f4421b44fddab01198bfad3eba9` (ETH retry, 28 Oct) |
| 0:40–1:15 | Run log drawer, then the payment graph | Click **Run check for T1**. Log lines stream from the CRE workflow. The graph shows one source linked to five voices, each edge with its measured gap from block timestamps | Edges open the five payments: [persona_01](https://sepolia.etherscan.io/tx/0xcbcb1806ae5953cca2279e0f185782707024e81b6d109bd86d34c65fd725a231), [persona_02](https://sepolia.etherscan.io/tx/0x93b918c3f737d31e485e8a1c7ef7d72ea74c8f0e053a0c4eb393c6c9818e724b), [persona_03](https://sepolia.etherscan.io/tx/0x7b4e5aa61433ec7027f1a70fcc1e4fac408f14087765f3f3714da0270084ac83), [persona_04](https://sepolia.etherscan.io/tx/0xc342a2f0c4bbe0292acaaa4b2ec97401193328628366a09d42b20ec9c2b4f4ce), [persona_05](https://sepolia.etherscan.io/tx/0x78986292395a4090702b765ebc00e880c8fd79d1ad280934fe277b7ee9f8ab1c) |
| 1:15–1:30 | Banner flips | Proposal struck through. Banner: **NO POSITION · BLOCK**, with the policy sentence. Click one edge: the real Etherscan transaction opens | Verdict tx: fill from `scenarios/runs/T1.json` after the 17:20 broadcast |
| 1:30–1:40 | T2 tab | **NO POSITION · ELIGIBLE, market unavailable**. One grey edge labelled "not from a campaign source (paid only 1 voice)" | [persona_08](https://sepolia.etherscan.io/tx/0xe8dc499fb0eed479e76589cdd9489c6725f82d3258a8059346041ffbfbbfcb33) |
| 1:40–1:45 | T5 tab | Injected provider fault: **NO POSITION · REVIEW**, with the reason "a provider lookup failed". Label reads "SIMULATED · injected provider fault" | — |
| 1:45–2:00 | Proof strip and Evidence Brief | Press **E**: the one-page brief with the evidence hash, the verdict transaction, the converging posts with gaps, and the limitations line. Press **R**: Replay returns **MATCH**. Then T6 (tampered snapshot): **HASH_MISMATCH · section changed: transfers** | Evidence hash and verdict tx from the record |

## Closing line

"Echt reports a pattern in transfers and a policy result. It does not make a legal finding, and every number here links to the chain."

## Before you record

- Run `pnpm scenarios:fill` after the post times have passed, then the two broadcasts from the server, so `scenarios/runs/T1.json` and `T2.json` hold real `TESTNET · CRE local simulation` records.
- Check the Brief and the dashboard show the real verdict tx links, not the dry-run label.
- Say "local simulation" the first time the CRE step appears on screen.
- If the broadcast gives a different result from the expected one (T1 BLOCK with 5 linked, T2 ELIGIBLE with 0 linked), do not record. Investigate first.
