// Builds the HyperFrames composition for the Echt demo from measured inputs.
//   node scripts/build.mjs            (run from video/, after voiceover.py and capture.mjs)
// Reads: each voice-over clip's real length (ffprobe) and word timings (assets/vo/*.words.json),
// the capture's on-screen values (assets/capture/marks.json), and the source URL from the web app.
// Writes: index.html and compositions/*.html. Every timed element is written into the HTML.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const W = 1920, H = 1080;
const LIME = "#c2ee55", BG = "#121212", CARD = "#262626", INK = "#f2f2f2", MUTED = "#a3a3a3";
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---- Inputs ----------------------------------------------------------------------------------------
const VO = ["01-anchor", "02-problem", "03-proposal", "04-check", "05-verdict", "06-transactions", "07-edge-cases", "08-proof", "09-close"];
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const vo = VO.map((name) => ({
  name,
  len: probe(join(ROOT, "assets", "vo", `${name}.mp3`)),
  words: JSON.parse(readFileSync(join(ROOT, "assets", "vo", `${name}.words.json`), "utf8")).words,
}));
const marks = JSON.parse(readFileSync(join(ROOT, "assets", "capture", "marks.json"), "utf8"));
const content = readFileSync(join(ROOT, "..", "apps", "web", "src", "content.ts"), "utf8");
const theBlock = content.match(/theBlock:\s*"([^"]+)"/)?.[1];
if (!theBlock) throw new Error("SOURCES.theBlock not found in apps/web/src/content.ts");

// The voice-over says "about twelve hours". The number on screen must agree, read from the recording.
const gap = Number.parseFloat(marks.screen?.paymentToPost ?? "");
if (!(Math.abs(gap - 12) < 1)) throw new Error(`screen shows payment-to-post ${marks.screen?.paymentToPost}, which is not about twelve hours`);
if (!/MATCH/.test(marks.screen?.replayT1 ?? "") || !/HASH_MISMATCH/.test(marks.screen?.replayT6 ?? "")) throw new Error("replay results missing from the capture");

// ---- Timeline: each section holds its voice-over, 0.4 s lead and 0.6 s tail -----------------------------
const LEAD = 0.4, TAIL = 0.6;
let cursor = 0;
const sections = vo.map((v) => {
  const start = r2(cursor);
  const voStart = r2(start + LEAD);
  const len = r2(LEAD + v.len + TAIL);
  cursor += len;
  return { ...v, start, voStart, slot: len };
});
const END_CARD = 5.0;
sections[8].slot = r2(sections[8].slot + END_CARD); // the close holds the end card after its line
const TOTAL = r2(sections[8].start + sections[8].slot);
if (TOTAL > 120) throw new Error(`film is ${TOTAL} s, over 120 s`);

// ---- Shared styles ---------------------------------------------------------------------------------
const FONTS = `
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-600-normal.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-700-normal.woff2") format("woff2"); font-weight: 700; }`;

const scene = (id, body, script, extraCss = "") => `<template>
  <style>
    ${FONTS}
    #root { position: absolute; inset: 0; background: ${BG}; overflow: hidden; font-family: "Manrope", sans-serif; color: ${INK}; }
    ${extraCss}
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
${body}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${script}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;

// ---- Title cards (sections 1, 2 and 9) -------------------------------------------------------------
// Words blur in one by one (motion.md: 0.13 s each, 0.067 s apart), then hold still until the exit.
function titleLines(id, lines, enterAt, exitAt) {
  let html = "", js = "", n = 0;
  lines.forEach((line, li) => {
    const words = line.text.split(" ");
    const spans = words.map((w, wi) => {
      const accent = line.accent?.includes(w.replace(/[.,]/g, "")) ? ` style="color:${LIME}"` : "";
      return `<span class="w" id="${id}-w${li}-${wi}"${accent}>${esc(w)}</span>`;
    }).join(" ");
    html += `      <p class="line ${line.cls}" id="${id}-l${li}">${spans}</p>\n`;
    words.forEach((_, wi) => {
      const t = r2(enterAt + (line.delay ?? 0) + n * 0.067);
      // A word timed at 0 s starts visible, so the first frame (the thumbnail) is never empty.
      const from = t === 0 ? '{ opacity: 1, filter: "blur(0px)" }' : '{ opacity: 0, filter: "blur(6px)" }';
      js += `    tl.fromTo("#${id}-w${li}-${wi}", ${from}, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power4.out" }, ${t});\n`;
      n++;
    });
  });
  js += `    tl.to("#${id}-stack", { opacity: 0, filter: "blur(8px)", duration: 0.2, ease: "power2.in" }, ${r2(exitAt - 0.22)});\n`;
  return { html: `    <div class="stack" id="${id}-stack">\n${html}    </div>`, js };
}

const TITLE_CSS = `
    .stack { position: absolute; left: 192px; right: 192px; top: 300px; display: flex; flex-direction: column; gap: 28px; }
    .line { margin: 0; letter-spacing: -0.02em; line-height: 1.08; }
    .hero { font-size: 76px; font-weight: 700; }
    .sub { font-size: 48px; font-weight: 600; color: ${MUTED}; }
    .w { display: inline-block; }
    .source { position: absolute; left: 192px; right: 192px; top: 132px; font-size: 30px; color: ${MUTED}; line-height: 1.4; }
    .source b { color: ${INK}; font-weight: 600; }
    .source .url { font-size: 28px; color: ${MUTED}; word-break: break-all; }`;

function s1() {
  const s = sections[0];
  const t = titleLines("s1", [
    { text: "About 160 crypto influencers took paid promotions.", cls: "hero", accent: ["160"] },
    { text: "Fewer than 5 labelled them as ads.", cls: "sub", delay: 2.8 },
  ], 0, s.slot);
  const body = `${t.html}
    <p class="source" id="s1-source"><b>Source: ZachXBT, via The Block (2025). Not our data.</b><br /><span class="url">${esc(theBlock)}</span></p>`;
  const js = `${t.js}    tl.to("#s1-source", { opacity: 0, duration: 0.2, ease: "power2.in" }, ${r2(s.slot - 0.22)});\n`;
  return scene("s1", body, js, TITLE_CSS);
}

function s2() {
  const s = sections[1];
  const t = titleLines("s2", [
    { text: "AI trading agents read the same feeds.", cls: "hero" },
    { text: "Seven voices agree. A naive agent buys.", cls: "sub", delay: 3.6, accent: ["buys"] },
  ], 0.5, s.slot);
  return scene("s2", t.html, t.js, TITLE_CSS);
}

function s9() {
  const s = sections[8];
  const lineEnd = r2(LEAD + s.len + TAIL);
  const t = titleLines("s9", [
    { text: "Echt doesn't decide who broke the law.", cls: "hero" },
    { text: "It shows the pattern.", cls: "sub", delay: 2.6, accent: ["pattern."] },
  ], 0.5, lineEnd);
  const body = `${t.html}
    <div class="endcard" id="s9-end">
      <img id="s9-logo" src="assets/brand/echt-mark-white.svg" alt="Echt" />
      <p class="url1" id="s9-site">echt-sepia.vercel.app</p>
      <p class="url2" id="s9-repo">github.com/blaxko/echt</p>
    </div>`;
  const js = `${t.js}    tl.fromTo("#s9-end", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, ${r2(lineEnd + 0.1)});\n`;
  const css = `${TITLE_CSS}
    .endcard { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
    .endcard img { width: 260px; height: auto; margin-bottom: 24px; }
    .url1 { margin: 0; font-size: 56px; font-weight: 700; color: ${LIME}; letter-spacing: -0.01em; }
    .url2 { margin: 0; font-size: 36px; font-weight: 600; color: ${INK}; }`;
  return scene("s9", body, js, css);
}

// ---- Screen scenes (sections 3 to 8) ---------------------------------------------------------------
// Each segment cuts a range of the recording (assets/capture/main.mp4, times read from its contact sheet)
// and fills a share of the section. "at" is a focus point in recording pixels; the camera eases between them.
const SCREENS = {
  2: { // 3 Proposal: the landing, then the dashboard steps (the $400 practice trade)
    segments: [
      { from: 3.0, to: 6.6, share: 0.36, focus: [{ t: 0, x: 960, y: 420, s: 1.0 }, { t: 0.4, x: 960, y: 330, s: 1.25 }] },
      { from: 57.0, to: 61.9, share: 0.64, focus: [{ t: 0, x: 960, y: 420, s: 1.0 }, { t: 0.5, x: 640, y: 600, s: 1.6 }, { t: 2.6, x: 800, y: 600, s: 1.85 }] },
    ],
  },
  3: { // 4 Check: scroll from the numbers through "Who paid whom" to the pinned block in Proof
    segments: [
      { from: 15.0, to: 21.6, share: 1, focus: [{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 1.0, x: 960, y: 540, s: 1.15 }] },
    ],
  },
  4: { // 5 Verdict: 5 paid by one wallet, the payment-to-post gap, no trade
    segments: [
      { from: 28.0, to: 34.8, share: 1, focus: [{ t: 0, x: 960, y: 420, s: 1.0 }, { t: 0.4, x: 840, y: 340, s: 1.8 }, { t: 2.2, x: 1120, y: 340, s: 1.9 }, { t: 6.2, x: 960, y: 420, s: 1.2 }, { t: 9.6, x: 1445, y: 340, s: 1.9 }] },
    ],
  },
  5: { // 6 Transactions: the payment lines and the click
    segments: [
      { from: 22.0, to: 28.0, share: 1, focus: [{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 0.4, x: 700, y: 880, s: 1.55 }] },
    ],
  },
  6: { // 7 Edge cases: T5 (provider fault), then T2 (no shared wallet)
    segments: [
      { from: 36.0, to: 39.9, share: 0.58, label: "T5 · provider fault injected for the test", focus: [{ t: 0, x: 960, y: 420, s: 1.0 }, { t: 0.4, x: 800, y: 170, s: 1.6 }] },
      { from: 41.0, to: 45.9, share: 0.42, focus: [{ t: 0, x: 960, y: 420, s: 1.0 }, { t: 0.4, x: 900, y: 170, s: 1.55 }] },
    ],
  },
  7: { // 8 Proof: the Brief, Replay MATCH on T1, HASH_MISMATCH on T6
    segments: [
      { from: 62.0, to: 65.0, share: 0.3, focus: [{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 0.4, x: 960, y: 540, s: 1.2 }] },
      { from: 47.0, to: 50.9, share: 0.32, focus: [{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 0.3, x: 960, y: 540, s: 1.9 }] },
      { from: 53.0, to: 56.9, share: 0.38, focus: [{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 0.3, x: 960, y: 540, s: 1.9 }] },
    ],
  },
};

// Scale s around point (x, y), centred in frame, clamped so no edge of the recording shows.
function cam({ x, y, s }) {
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - s * x));
  const ty = Math.min(0, Math.max(H - H * s, H / 2 - s * y));
  return `{ scale: ${s}, x: ${r2(tx)}, y: ${r2(ty)} }`;
}

const SCREEN_CSS = `
    .cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    .cam video { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: contain; }
    .pill { position: absolute; left: 96px; padding: 10px 18px; border-radius: 999px; background: rgba(18,18,18,0.88); border: 1px solid #3a3a3a; font-size: 28px; font-weight: 600; color: ${INK}; }
    .rec { top: 40px; }
    .t5 { top: 112px; color: ${LIME}; border-color: ${LIME}; }
    .linkcard { position: absolute; right: 96px; top: 300px; width: 640px; padding: 26px 30px; border-radius: 18px; background: ${CARD}; border: 1px solid #3a3a3a; box-shadow: 0 24px 48px -24px rgba(0,0,0,0.7); }
    .linkcard .k { margin: 0 0 8px; font-size: 28px; font-weight: 600; color: ${MUTED}; }
    .linkcard .v { margin: 0; font-size: 28px; font-weight: 700; color: ${LIME}; word-break: break-all; line-height: 1.3; }`;

function screenScene(idx) {
  const sec = sections[idx];
  const id = `s${idx + 1}`;
  const plan = SCREENS[idx];
  let body = "", js = "", at = 0;
  plan.segments.forEach((seg, i) => {
    const dur = r2(sec.slot * seg.share);
    const rate = r2((seg.to - seg.from) / dur);
    if (rate < 0.1 || rate > 10) throw new Error(`${id} segment ${i}: playback rate ${rate} out of range`);
    const camId = `${id}-cam${i}`;
    body += `    <div class="cam" id="${camId}" data-layout-allow-overflow>
      <video id="${id}-v${i}" class="clip" src="assets/capture/main.mp4" data-start="${r2(at)}" data-duration="${dur}" data-media-start="${seg.from}" data-playback-rate="${rate}" data-track-index="${i + 1}" muted playsinline></video>
    </div>\n`;
    const f = seg.focus;
    js += `    tl.set("#${camId}", { transformOrigin: "0 0" }, 0);\n`;
    js += `    tl.set("#${camId}", ${cam(f[0])}, ${r2(at)});\n`;
    for (let k = 1; k < f.length; k++) {
      const start = r2(at + f[k].t);
      const next = k + 1 < f.length ? f[k + 1].t : f[k].t + 1.4;
      const d = r2(Math.min(1.1, Math.max(0.5, next - f[k].t - 0.2)));
      js += `    tl.fromTo("#${camId}", ${cam(f[k - 1])}, { ...${cam(f[k])}, duration: ${d}, ease: "power2.inOut" }, ${start});\n`;
    }
    if (seg.label) {
      body += `    <p class="pill t5 clip" id="${id}-label${i}" data-start="${r2(at + 0.2)}" data-duration="${r2(dur - 0.3)}" data-track-index="9">${esc(seg.label)}</p>\n`;
    }
    at += dur;
  });
  body += `    <p class="pill rec" id="${id}-rec">Recorded from echt-sepia.vercel.app</p>\n`;
  if (idx === 5) {
    // Section 6: the clicked line's real link target, read from the page during capture.
    const href = marks.clickedTx;
    if (!/^https:\/\/sepolia\.etherscan\.io\/tx\/0x[0-9a-f]{64}$/.test(href ?? "")) throw new Error(`clicked link is not a Sepolia transaction: ${href}`);
    body += `    <div class="linkcard clip" id="${id}-link" data-start="3.3" data-duration="${r2(sec.slot - 3.6)}" data-track-index="9">
      <p class="k">The clicked line opens</p>
      <p class="v">${esc(href.replace("https://", ""))}</p>
    </div>\n`;
    js += `    tl.fromTo("#${id}-link .v", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.25, ease: "expo.out" }, 3.35);\n`;
  }
  return scene(id, body, js, SCREEN_CSS);
}

// ---- Captions: word by word, groups of up to 5, a new group at each pause ----------------------------
function captions() {
  const groups = [];
  sections.forEach((sec) => {
    let cur = [];
    sec.words.forEach((w, i) => {
      const word = { text: w.text, start: r2(sec.voStart + w.start), end: r2(sec.voStart + w.end) };
      const prev = sec.words[i - 1];
      const pause = prev ? w.start - prev.end : 0;
      if (cur.length && (cur.length >= 5 || pause >= 0.15)) { groups.push(cur); cur = []; }
      cur.push(word);
    });
    if (cur.length) groups.push(cur);
  });
  let body = "", js = "";
  groups.forEach((g, gi) => {
    const next = groups[gi + 1];
    const start = r2(Math.max(0.1, g[0].start - 0.08));
    const naturalEnd = r2(g[g.length - 1].end + 0.35);
    const end = next ? r2(Math.min(naturalEnd, next[0].start - 0.1)) : naturalEnd;
    const words = g.map((w, wi) => `<span class="cw" id="c${gi}-${wi}">${esc(w.text)}</span>`).join(" ");
    body += `    <div class="cg clip" id="c${gi}" data-start="${start}" data-duration="${r2(end - start)}" data-track-index="1"><span class="cbox">${words}</span></div>\n`;
    g.forEach((w, wi) => {
      const t = r2(w.start - start);
      js += `    tl.fromTo("#c${gi}-${wi}", { color: "${INK}", y: 0 }, { color: "${LIME}", y: -4, duration: 0.12, ease: "power2.out" }, ${r2(start + t)});\n`;
    });
    js += `    tl.fromTo("#c${gi} .cbox", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.16, ease: "expo.out" }, ${start});\n`;
    js += `    tl.to("#c${gi} .cbox", { opacity: 0, duration: 0.1, ease: "power2.in" }, ${r2(end - 0.1)});\n`;
  });
  const css = `
    #root { background: transparent; }
    .cg { position: absolute; left: 0; right: 0; bottom: 96px; text-align: center; overflow: visible; }
    .cbox { display: inline-block; max-width: 1600px; padding: 14px 30px 18px; border-radius: 18px; background: rgba(18,18,18,0.94); font-size: 60px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
    .cw { display: inline-block; }`;
  return scene("captions", body, js, css);
}

// ---- Persistent corner tag -------------------------------------------------------------------------
function overlay() {
  const body = `    <p class="tag" id="tag">SYNTHETIC accounts · TESTNET payments · Chainlink CRE local simulation</p>`;
  const css = `
    #root { background: transparent; }
    .tag { position: absolute; right: 96px; top: 40px; margin: 0; padding: 10px 18px; border-radius: 999px; background: rgba(18,18,18,0.9); border: 1px solid ${LIME}; font-size: 28px; font-weight: 600; color: ${INK}; }`;
  return scene("overlay", body, `    tl.fromTo("#tag", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0.2);\n`, css);
}

// ---- Root ------------------------------------------------------------------------------------------
const host = (id, start, dur, track, kind = "graphics") =>
  `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${dur}" data-track-index="${track}" data-track-kind="${kind}" data-width="${W}" data-height="${H}" style="z-index:${track}"></div>`;

const hosts = sections.map((s, i) => host(`s${i + 1}`, s.start, s.slot, 1));
const audio = sections.map((s, i) =>
  `      <audio id="vo${i + 1}" class="clip" src="assets/vo/${s.name}.mp3" data-start="${s.voStart}" data-duration="${r2(s.len)}" data-volume="1" data-track-index="6"></audio>`);

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${BG}; }
      #root { position: relative; width: 100%; height: 100%; background: ${BG}; }
    </style>
  </head>
  <body>
    <!-- Generated by scripts/build.mjs from the measured voice-over and the capture. Edit the script, not this file. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
${hosts.join("\n")}
${host("captions", 0, TOTAL, 4, "captions")}
${host("overlay", 0, TOTAL, 5)}
${audio.join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;

const files = {
  "index.html": index,
  "compositions/s1.html": s1(),
  "compositions/s2.html": s2(),
  "compositions/s9.html": s9(),
  "compositions/captions.html": captions(),
  "compositions/overlay.html": overlay(),
};
for (const idx of [2, 3, 4, 5, 6, 7]) files[`compositions/s${idx + 1}.html`] = screenScene(idx);
for (const [rel, text] of Object.entries(files)) writeFileSync(join(ROOT, rel), text);

console.log(`film ${TOTAL} s`);
for (const s of sections) console.log(`${s.name.padEnd(17)} start ${String(s.start).padStart(6)}  voice ${String(s.voStart).padStart(6)} +${r2(s.len)}  slot ${s.slot}`);
console.log(`screen read: ${JSON.stringify(marks.screen.paymentToPost)} payment-to-post; clicked ${marks.clickedTx}`);
