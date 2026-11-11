// Builds the HyperFrames composition for the Echt demo from measured inputs.
//   node scripts/build.mjs            (run from video/, after voiceover.py and capture.mjs)
// Reads each voice-over clip's real length (ffprobe) and word timings (assets/vo/*.words.json), the
// capture's on-screen values (assets/capture/marks.json) and the source URL from the web app.
// Writes index.html and compositions/*.html. Every timed element is written into the HTML.
//
// Look: editorial and still. One ease, cubic-bezier(0.2, 0, 0, 1), and 400-600 ms for every move.
// Hard cuts land on sentence pauses. The camera moves only to point at what the voice names, then holds.
// Focus: a thin lime outline draws on around the named thing and the rest dims to about 60 %.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const W = 1920, H = 1080;
const LIME = "#c2ee55", BG = "#121212", CARD = "#262626", INK = "#f4f4f2", MUTED = "#a3a3a3";
const D = 0.5; // every move: 500 ms
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

// The voice-over says "about twelve hours" and the film shows the recording: they must agree.
const gap = Number.parseFloat(marks.screen?.paymentToPost ?? "");
if (!(Math.abs(gap - 12) < 1)) throw new Error(`screen shows payment-to-post ${marks.screen?.paymentToPost}, which is not about twelve hours`);
if (!/MATCH/.test(marks.screen?.replayT1 ?? "") || !/HASH_MISMATCH/.test(marks.screen?.replayT6 ?? "")) throw new Error("replay results missing from the capture");

// ---- Timeline --------------------------------------------------------------------------------------
const OPEN = 2.0, LEAD = 0.4, TAIL = 0.6, END_HOLD = 3.5;
let cursor = OPEN;
const sections = vo.map((v) => {
  const start = r2(cursor);
  const len = r2(LEAD + v.len + TAIL);
  cursor += len;
  return { ...v, start, voStart: r2(start + LEAD), slot: len };
});
sections[8].slot = r2(sections[8].slot + END_HOLD);
const TOTAL = r2(sections[8].start + sections[8].slot);
if (TOTAL > 120) throw new Error(`film is ${TOTAL} s, over 120 s`);

// Scene-local time of a spoken word (nth occurrence), so cuts and focus follow the voice.
function at(secIdx, text, nth = 0) {
  const hits = sections[secIdx].words.filter((w) => w.text.toLowerCase().startsWith(text.toLowerCase()));
  if (!hits[nth]) throw new Error(`word "${text}" not in section ${secIdx + 1}`);
  return r2(LEAD + hits[nth].start);
}

// ---- Shared ----------------------------------------------------------------------------------------
const FONTS = `
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-400-normal.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-600-normal.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "Manrope"; src: url("assets/fonts/manrope-latin-700-normal.woff2") format("woff2"); font-weight: 700; }`;

// cubic-bezier(0.2, 0, 0, 1) as a GSAP ease: one curve for every move in the film.
const EASE_JS = `const E = (() => { const cx = 0.6, bx = -1.2, ax = 1.6, cy = 0, by = 3, ay = -2;
      const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
      return (p) => { if (p <= 0) return 0; if (p >= 1) return 1; let t = p; for (let i = 0; i < 10; i++) { const e = sx(t) - p; const d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t = Math.min(1, Math.max(0, t - e / d)); } return sy(t); }; })();`;

const scene = (id, body, script, css = "", bg = BG) => `<template>
  <style>
    ${FONTS}
    #root { position: absolute; inset: 0; background: ${bg}; overflow: hidden; font-family: "Manrope", sans-serif; color: ${INK}; }
    .pill { position: absolute; top: 28px; margin: 0; padding: 10px 20px; border-radius: 999px; background: ${CARD}; color: ${INK}; font-size: 28px; font-weight: 600; line-height: 1.2; white-space: nowrap; }
    .pill.white { background: ${INK}; color: ${BG}; }
    ${css}
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
${body}
  </div>
  <script>
    ${EASE_JS}
    const tl = gsap.timeline({ paused: true });
${script}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
const fadeIn = (sel, t) => `    tl.fromTo("${sel}", { opacity: 0 }, { opacity: 1, duration: ${D}, ease: E }, ${r2(t)});\n`;
const fadeOut = (sel, t) => `    tl.to("${sel}", { opacity: 0, duration: 0.4, ease: E }, ${r2(t)});\n`;

// The Echt mark as inline strokes, so it can draw on.
const MARK_PATHS = ["M68 40 H124 C140 40 140 20 156 20 H216", "M28 80 H108 C124 80 124 60 140 60 H176", "M44 120 H92 C108 120 108 100 124 100 H200"];
const mark = (id, width) => `<svg id="${id}" class="mark" viewBox="8 0 228 140" width="${width}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">${MARK_PATHS.map((d, i) => `<path id="${id}-p${i}" pathLength="1" d="${d}" />`).join("")}</svg>`;

// ---- Opening: black, the mark draws on ------------------------------------------------------------
function s0() {
  const body = `    <div class="center">${mark("s0-mark", 300)}</div>`;
  let js = "";
  MARK_PATHS.forEach((_, i) => {
    js += `    tl.fromTo("#s0-mark-p${i}", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: E }, ${r2(0.2 + i * 0.15)});\n`;
  });
  return scene("s0", body, js, `.center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }`, "#000000");
}

// ---- Title cards: type does the work ---------------------------------------------------------------
const TITLE_CSS = `
    .row { position: absolute; left: 192px; right: 192px; display: flex; align-items: baseline; gap: 40px; margin: 0; }
    .num { font-size: 220px; font-weight: 700; letter-spacing: -0.04em; line-height: 0.9; }
    .say { font-size: 60px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; max-width: 1100px; }
    .say.muted { color: ${MUTED}; }
    .head { font-size: 76px; font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; max-width: 1450px; }
    .lime { color: ${LIME}; }
    .src { position: absolute; left: 192px; top: 112px; }
    .srcurl { position: absolute; left: 212px; top: 176px; max-width: 1200px; margin: 0; font-size: 28px; color: ${MUTED}; word-break: break-all; line-height: 1.3; }`;

function s1() {
  const s = sections[0];
  const body = `    <p class="pill src" id="s1-src">Source: ZachXBT, via The Block (2025). Not our data.</p>
    <p class="srcurl" id="s1-url">${esc(theBlock)}</p>
    <p class="row" id="s1-a" style="top: 300px"><span class="num">160</span><span class="say">crypto influencers took paid promotions.</span></p>
    <p class="row" id="s1-b" style="top: 600px"><span class="say muted">Fewer than</span><span class="num lime">5</span><span class="say">labelled them as ads.</span></p>`;
  const js = fadeIn("#s1-a", 0) + fadeIn("#s1-b", at(0, "Fewer")) + `    tl.set("#s1-src, #s1-url", { opacity: 1 }, 0);\n` + fadeOut("#s1-a, #s1-b, #s1-src, #s1-url", s.slot - 0.45);
  return scene("s1", body, js, TITLE_CSS);
}

function s2() {
  const s = sections[1];
  const body = `    <p class="row" id="s2-a" style="top: 220px"><span class="head">AI trading agents read the same feeds.</span></p>
    <p class="row" id="s2-b" style="top: 420px"><span class="num">7</span><span class="say">voices suddenly agree on one token.</span></p>
    <p class="row" id="s2-c" style="top: 720px"><span class="head">A naive agent <span class="lime">buys.</span></span></p>`;
  const js = fadeIn("#s2-a", 0.1) + fadeIn("#s2-b", at(1, "When")) + fadeIn("#s2-c", at(1, "naive")) + fadeOut("#s2-a, #s2-b, #s2-c", s.slot - 0.45);
  return scene("s2", body, js, TITLE_CSS);
}

function s9() {
  const s = sections[8];
  const lineEnd = r2(LEAD + s.len + TAIL);
  const body = `    <p class="row" id="s9-a" style="top: 330px"><span class="head">Echt doesn’t decide who broke the law.</span></p>
    <p class="row" id="s9-b" style="top: 520px"><span class="head">It shows the <span class="lime">pattern.</span></span></p>
    <div class="end" id="s9-end">
      ${mark("s9-mark", 240)}
      <p class="u1">echt-sepia.vercel.app</p>
      <p class="u2">github.com/blaxko/echt</p>
    </div>`;
  const js = fadeIn("#s9-a", 0.1) + fadeIn("#s9-b", at(8, "It")) + fadeOut("#s9-a, #s9-b", lineEnd - 0.45) + fadeIn("#s9-end", lineEnd);
  const css = `${TITLE_CSS}
    .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; }
    .end .mark { margin-bottom: 28px; }
    .u1 { margin: 0; font-size: 60px; font-weight: 700; letter-spacing: -0.01em; color: ${INK}; }
    .u2 { margin: 0; font-size: 36px; font-weight: 600; color: ${MUTED}; }`;
  return scene("s9", body, js, css);
}

// ---- Screen scenes (sections 3 to 8) ---------------------------------------------------------------
// The recording sits in an inset card below the label band, so labels never cover the app.
const CARD_SCALE = 0.85, CARD_X = (W - W * CARD_SCALE) / 2, CARD_Y = 92;
// Rectangles are in recording pixels (1920x1080), measured from frames of assets/capture/main.mp4.
const R = {
  watched: [320, 404, 314, 140, 22], step2: [636, 544, 328, 134, 22],
  paid5: [636, 272, 328, 136, 22], gap: [960, 272, 324, 136, 22], noTrade: [1284, 272, 324, 136, 22],
  line: [340, 744, 690, 246, 16], banner: [312, 72, 1296, 184, 22],
  match: [684, 532, 460, 56, 10], mismatch: [684, 532, 520, 56, 10],
};
// Segments: a range of the recording, the scene time it fills (cuts on sentence pauses), an optional
// camera hold (scale toward a point) and focus outlines that start on the word the voice names.
const SCREENS = {
  2: () => [
    { from: 3.0, to: 5.24, start: 0, end: at(2, "Our"), label: "rec" },
    { from: 57.0, to: 61.9, start: at(2, "Our"), end: sections[2].slot, label: "rec", camera: { t: at(2, "Our"), x: 960, y: 571, s: 1.07, cut: true },
      focus: [{ rect: R.watched, from: at(2, "seven"), to: at(2, "proposes") }, { rect: R.step2, from: at(2, "four"), to: sections[2].slot - 0.05 }] },
  ],
  3: () => [{ from: 15.0, to: 21.6, start: 0, end: sections[3].slot, label: "rec" }],
  4: () => [{ from: 28.0, to: 34.8, start: 0, end: sections[4].slot, label: "rec", camera: { t: at(4, "Five"), x: 960, y: 400, s: 1.25 },
    focus: [{ rect: R.paid5, from: at(4, "Five"), to: at(4, "about") }, { rect: R.gap, from: at(4, "about"), to: at(4, "with") }, { rect: R.noTrade, from: at(4, "The", 1), to: sections[4].slot - 0.05 }] }],
  5: () => [
    { from: 22.0, to: 26.05, start: 0, end: at(5, "Click"), label: "rec", focus: [{ rect: R.line, from: at(5, "line"), to: at(5, "Click") }] },
    { ether: true, start: at(5, "Click"), end: sections[5].slot, label: "ether" },
  ],
  6: () => [
    { from: 36.0, to: 39.9, start: 0, end: at(6, "And"), label: "t5", focus: [{ rect: R.banner, from: at(6, "verdict"), to: at(6, "And") }] },
    { from: 41.0, to: 45.9, start: at(6, "And"), end: sections[6].slot, label: "rec", focus: [{ rect: R.banner, from: at(6, "check"), to: sections[6].slot - 0.05 }] },
  ],
  7: () => [
    { from: 62.0, to: 65.0, start: 0, end: at(7, "Replay"), label: "rec" },
    { from: 47.0, to: 50.9, start: at(7, "Replay"), end: at(7, "Change"), label: "rec", camera: { t: at(7, "Replay") + 0.1, x: 960, y: 665, s: 1.3 },
      focus: [{ rect: R.match, from: at(7, "gets"), to: at(7, "Change") }] },
    { from: 53.0, to: 56.9, start: at(7, "Change"), end: sections[7].slot, label: "rec", camera: { t: at(7, "Change"), x: 960, y: 665, s: 1.3, cut: true },
      focus: [{ rect: R.mismatch, from: at(7, "Change"), to: sections[7].slot - 0.05 }] },
  ],
};

function camState({ x, y, s }) {
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - s * x));
  const ty = Math.min(0, Math.max(H - H * s, H / 2 - s * y));
  return `{ scale: ${s}, x: ${r2(tx)}, y: ${r2(ty)} }`;
}

const SCREEN_CSS = `
    .card { position: absolute; left: ${CARD_X}px; top: ${CARD_Y}px; width: ${W * CARD_SCALE}px; height: ${H * CARD_SCALE}px; border-radius: 16px; overflow: hidden; border: 1px solid ${CARD}; background: ${BG}; }
    .stage { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform: scale(${CARD_SCALE}); transform-origin: 0 0; }
    .cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    .cam video { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: contain; }
    .focus { position: absolute; border-radius: 14px; }
    .focus .dim { position: absolute; inset: 0; border-radius: 14px; box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.4); }
    .focus svg { position: absolute; inset: -3px; width: calc(100% + 6px); height: calc(100% + 6px); overflow: visible; }
    .ethcard { position: absolute; left: ${CARD_X}px; width: ${W * CARD_SCALE}px; border-radius: 16px; overflow: hidden; border: 1px solid ${CARD}; background: #fff; }
    .ethcard video { display: block; width: 100%; height: auto; }`;

function screenScene(idx) {
  const id = `s${idx + 1}`;
  const segs = SCREENS[idx]();
  let body = "", stage = "", js = "";
  segs.forEach((seg, i) => {
    const start = r2(seg.start), dur = r2(seg.end - seg.start);
    if (seg.ether) {
      // Section 6: the team's own recording of the real transaction page, cropped to the page content.
      const h = Math.round((W * CARD_SCALE) * 515 / 1350);
      const top = Math.round(CARD_Y + (H * CARD_SCALE - h) / 2);
      js += `    tl.set("#${id}-card", { opacity: 0 }, ${start});
`;
      body += `    <div class="ethcard" style="top: ${top}px"><video id="${id}-eth" class="clip" src="assets/capture/etherscan-clip.mp4" data-start="${start}" data-duration="${dur}" data-media-start="0" data-playback-rate="${r2(3.9 / dur)}" data-track-index="3" muted playsinline></video></div>\n`;
    } else {
      const rate = r2((seg.to - seg.from) / dur);
      if (rate < 0.1 || rate > 10) throw new Error(`${id} segment ${i}: playback rate ${rate} out of range`);
      const camId = `${id}-cam${i}`;
      let focusHtml = "";
      (seg.focus ?? []).forEach((f, k) => {
        const [x, y, w, h, rad] = f.rect;
        const fid = `${id}-f${i}${k}`;
        const fStart = r2(f.from - seg.start), fDur = r2(f.to - f.from);
        focusHtml += `        <div class="focus clip" id="${fid}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${rad}px" data-start="${r2(start + fStart)}" data-duration="${fDur}" data-track-index="5"><div class="dim" id="${fid}-dim" style="border-radius:${rad}px"></div><svg viewBox="0 0 ${w + 6} ${h + 6}"><rect id="${fid}-ring" x="1.5" y="1.5" width="${w + 3}" height="${h + 3}" rx="${rad + 1}" fill="none" stroke="${LIME}" stroke-width="3" vector-effect="non-scaling-stroke" pathLength="1" /></svg></div>\n`;
        const t0 = r2(start + fStart);
        js += `    tl.fromTo("#${fid}-dim", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: E }, ${t0});\n`;
        js += `    tl.fromTo("#${fid}-ring", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: ${D}, ease: E }, ${t0});\n`;
      });
      stage += `      <div class="cam" id="${camId}" data-layout-allow-overflow>
        <video id="${id}-v${i}" class="clip" src="assets/capture/main.mp4" data-start="${start}" data-duration="${dur}" data-media-start="${seg.from}" data-playback-rate="${rate}" data-track-index="${i + 1}" muted playsinline></video>
${focusHtml}      </div>\n`;
      js += `    tl.set("#${camId}", { transformOrigin: "0 0", scale: 1, x: 0, y: 0 }, 0);\n`;
      if (seg.camera) {
        const c = seg.camera;
        if (c.cut) js += `    tl.set("#${camId}", ${camState(c)}, ${start});\n`;
        else js += `    tl.fromTo("#${camId}", { scale: 1, x: 0, y: 0 }, { ...${camState(c)}, duration: ${D}, ease: E }, ${r2(c.t)});\n`;
      }
    }
    // Labels, timed to their segment: the site recording, the Etherscan page, or T5's injected fault.
    if (seg.label === "rec" || seg.label === "t5") body += `    <p class="pill clip" id="${id}-rec${i}" style="left:${CARD_X}px" data-start="${start}" data-duration="${dur}" data-track-index="8">Recorded from echt-sepia.vercel.app</p>\n`;
    if (seg.label === "t5") body += `    <p class="pill white clip" id="${id}-t5${i}" style="right:${CARD_X + 16}px; top:${CARD_Y + 14}px" data-start="${start}" data-duration="${dur}" data-track-index="9">T5 · provider fault injected for the test</p>\n`;
    if (seg.label === "ether") body += `    <p class="pill clip" id="${id}-eth-label" style="left:${CARD_X}px" data-start="${start}" data-duration="${dur}" data-track-index="8">Opened on sepolia.etherscan.io</p>\n`;
  });
  body = `    <div class="card" id="${id}-card"><div class="stage">\n${stage}    </div></div>\n${body}`;
  return scene(id, body, js, SCREEN_CSS);
}

// ---- Captions: at most two lines, white on a solid plate, the current word lime --------------------
function captions() {
  const groups = [];
  sections.forEach((sec) => {
    let cur = [];
    sec.words.forEach((w, i) => {
      const word = { text: w.text, start: r2(sec.voStart + w.start), end: r2(sec.voStart + w.end) };
      const prev = sec.words[i - 1];
      const pause = prev ? w.start - prev.end : 0;
      if (cur.length && (cur.length >= 8 || pause >= 0.25)) { groups.push(cur); cur = []; }
      cur.push(word);
    });
    if (cur.length) groups.push(cur);
  });
  let body = "", js = "";
  groups.forEach((g, gi) => {
    const next = groups[gi + 1];
    const start = r2(Math.max(OPEN + 0.1, g[0].start - 0.05));
    const naturalEnd = r2(g[g.length - 1].end + 0.3);
    const end = next ? r2(Math.min(naturalEnd, next[0].start - 0.05)) : naturalEnd;
    const words = g.map((w, wi) => `<span class="cw" id="c${gi}-${wi}">${esc(w.text)}</span>`).join(" ");
    body += `    <div class="cg clip" id="c${gi}" data-start="${start}" data-duration="${r2(end - start)}" data-track-index="1"><span class="plate">${words}</span></div>\n`;
    g.forEach((w, wi) => {
      js += `    tl.set("#c${gi}-${wi}", { color: "${LIME}" }, ${w.start});\n`;
      const off = g[wi + 1] ? g[wi + 1].start : end;
      js += `    tl.set("#c${gi}-${wi}", { color: "${INK}" }, ${r2(off)});\n`;
    });
  });
  const css = `
    #root { background: transparent; }
    .cg { position: absolute; left: 0; right: 0; bottom: 72px; text-align: center; }
    .plate { display: inline-block; max-width: 1400px; padding: 14px 28px 16px; border-radius: 16px; background: ${BG}; font-size: 50px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; color: ${INK}; }
    .cw { color: ${INK}; }`;
  return scene("captions", body, js, css, "transparent");
}

// ---- Persistent corner tag -------------------------------------------------------------------------
function overlay() {
  const body = `    <p class="pill" id="tag" style="right: 96px">SYNTHETIC accounts · TESTNET payments · Chainlink CRE local simulation</p>`;
  return scene("overlay", body, fadeIn("#tag", OPEN), `#root { background: transparent; }`, "transparent");
}

// ---- Root ------------------------------------------------------------------------------------------
const host = (id, start, dur, track, kind = "graphics") =>
  `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${dur}" data-track-index="${track}" data-track-kind="${kind}" data-width="${W}" data-height="${H}" style="z-index:${track}"></div>`;
const hosts = [host("s0", 0, OPEN, 1), ...sections.map((s, i) => host(`s${i + 1}`, s.start, s.slot, 1))];
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
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; background: #000; }
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
  "compositions/s0.html": s0(),
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
