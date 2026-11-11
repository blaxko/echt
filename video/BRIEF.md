---
workflow: general-video
flow: automation
storyboard: no
message: "Echt stops an AI trading agent from trading on hype that was paid for by one wallet"
destination: hackathon-submission
aspect: 1920x1080
language: en
length: 120s
audience: RYO-CHAN hackathon judges
---

## Intent

A two-minute demo of Echt for the RYO submission, readable with the sound off. Nine
voice-over sections, script fixed by the person (see SCRIPT below). Title cards for sections
1, 2 and 9; screen recordings of the live site for sections 3 to 8 with gentle zoom and pan.

## Assets

- assets/vo/NN-name.mp3 and .vtt — edge-tts voice-over, one clip per section (en-US-AndrewNeural, rate -5%).
- assets/capture/*.mp4 — Playwright recordings of https://echt-sepia.vercel.app at 1920x1080, real clicks.
- assets/fonts/manrope-*.woff2 — from apps/web/public/fonts (SIL OFL).
- assets/brand/echt-mark-white.svg — from apps/web/public/brand.

## Customizations

- Burned-in word-by-word kinetic captions, lime on dark, bottom third, from the VTT timings.
- Section 1 label: "Source: ZachXBT, via The Block (2025). Not our data." plus the URL from apps/web/src/content.ts SOURCES.theBlock.
- Persistent corner tag: "SYNTHETIC accounts · TESTNET payments · Chainlink CRE local simulation".
- On screen clips: "Recorded from echt-sepia.vercel.app". Never "LIVE".
- Section 7 label: "T5 · provider fault injected for the test".
- End card: Echt logo, "echt-sepia.vercel.app", "github.com/blaxko/echt".

## Notes

- Palette: #121212 background, #262626 cards, #c2ee55 lime. Manrope.
- Words: "linked transfers", "disclosure not detected". Never "scam", "fraud", "illegal", "paid shill".
- Numbers on screen come from the recorded screen, never hard-coded.
- No music: the person asked for voice-over only.
- Render: video/out/echt-demo.mp4, H.264, at most 120 s.
