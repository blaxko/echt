"""Voice-over for the Echt demo: one clip per section, with word-level subtitles.

python scripts/voiceover.py        (run from video/)

For each section this writes assets/vo/NN-name.mp3, the matching .vtt (one cue per word),
and .words.json (each word with start and end in seconds). Voice en-US-AndrewNeural at -5%,
falling back to en-GB-RyanNeural for every section if Andrew fails. The text is the script as given.
"""
import asyncio
import json
from pathlib import Path

import edge_tts

VOICES = ["en-US-AndrewNeural", "en-GB-RyanNeural"]
RATE = "-5%"
OUT = Path(__file__).resolve().parent.parent / "assets" / "vo"

SECTIONS = [
    ("01-anchor", "Last year, a leaked campaign showed about one hundred and sixty crypto influencers took paid promotions. Fewer than five labelled them as ads."),
    ("02-problem", "Now AI trading agents read those same feeds. When seven voices suddenly agree on one token, a naive agent buys."),
    ("03-proposal", "This is Echt. Our practice agent sees seven bullish accounts and proposes a four-hundred-dollar practice trade on ETH."),
    ("04-check", "Before it opens, a Chainlink CRE workflow reads every account’s wallet payments at a pinned block on Ethereum Sepolia, and asks one question: were these independent voices paid by the same wallet before they posted?"),
    ("05-verdict", "Five of seven were, about twelve hours before posting, with no disclosure. The policy threshold is met. The agent changes its mind. No position."),
    ("06-transactions", "Every line is a real testnet transaction. Click one, and Etherscan opens it."),
    ("07-edge-cases", "When data is missing, Echt doesn’t guess. With the transfer provider down, the verdict is review, never eligible. And when there’s no shared wallet, the check passes."),
    ("08-proof", "The verdict and a hash of the evidence are written on-chain. Replay recomputes it in your browser and gets a match. Change one byte, and it’s caught."),
    ("09-close", "Echt doesn’t decide who broke the law. It shows the pattern, so an agent never trades on hype it can’t trust."),
]


def vtt_time(seconds: float) -> str:
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


async def synth(name: str, text: str, voice: str) -> str:
    last_error = None
    for attempt in range(4):
        try:
            words = []
            audio = bytearray()
            comm = edge_tts.Communicate(text, voice, rate=RATE, boundary="WordBoundary")
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    end = (chunk["offset"] + chunk["duration"]) / 1e7
                    words.append({"text": chunk["text"], "start": round(start, 3), "end": round(end, 3)})
            if not audio or not words:
                raise RuntimeError("no audio or no word timings returned")
            (OUT / f"{name}.mp3").write_bytes(bytes(audio))
            cues = ["WEBVTT", ""]
            for i, w in enumerate(words):
                cues += [str(i + 1), f"{vtt_time(w['start'])} --> {vtt_time(w['end'])}", w["text"], ""]
            (OUT / f"{name}.vtt").write_text("\n".join(cues), encoding="utf-8")
            for i, w in enumerate(words):
                w["id"] = f"w{i}"
            (OUT / f"{name}.words.json").write_text(json.dumps({"voice": voice, "rate": RATE, "text": text, "words": words}, indent=1), encoding="utf-8")
            return voice
        except Exception as e:  # transient service errors: wait and retry the same voice
            last_error = e
            print(f"  {name} {voice} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError(f"{name}: {voice} failed: {last_error}")


async def main() -> None:
    # One voice for the whole film: Andrew for every section, or Ryan for every section if Andrew fails.
    OUT.mkdir(parents=True, exist_ok=True)
    for voice in VOICES:
        try:
            for name, text in SECTIONS:
                await synth(name, text, voice)
                print(f"{name}: {voice}")
            return
        except RuntimeError as e:
            print(f"falling back from {voice}: {e}")
    raise SystemExit("no voice produced every section")


asyncio.run(main())
