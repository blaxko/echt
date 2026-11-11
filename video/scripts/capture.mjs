// Screen capture for the Echt demo, from the live site, with real clicks and key presses.
//   node scripts/capture.mjs          (run from video/)
// Uses Playwright's recordVideo at 1920x1080 in the locally installed Chrome. Writes the raw
// recordings to assets/capture/raw/ and assets/capture/marks.json: when each step happened
// (seconds into the main recording) plus values read from the page. Nothing on screen is faked.
// The page.evaluate and waitForFunction callbacks run inside the browser, where these exist.
/* global document, window */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://echt-sepia.vercel.app";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const RAW = join(ROOT, "assets", "capture", "raw");
const SIZE = { width: 1920, height: 1080 };
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--window-size=1920,1080", "--headless=new"] });
const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: RAW, size: SIZE } });
const page = await context.newPage();
const t0 = Date.now();
const marks = {};
const mark = (name) => { marks[name] = Number(((Date.now() - t0) / 1000).toFixed(2)); console.log(`${marks[name].toFixed(2)}s ${name}`); };
const pause = (ms) => page.waitForTimeout(ms);
const wheel = async (dy, steps = 8, gap = 60) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await pause(gap); } };
const tab = (label) => page.getByRole("button", { name: label, exact: false });

// 1. Landing hero
await page.goto(`${SITE}/#/`, { waitUntil: "networkidle" });
await page.mouse.move(960, 540);
mark("landing");
await pause(4000);

// 2. Open the dashboard on T1 and scroll through the summary, the four numbers and "Who paid whom"
await page.getByRole("link", { name: "Open dashboard" }).first().click();
await page.waitForSelector(".banner-title");
await pause(800);
mark("dashboard");
await pause(3500);
const read = async (label) => page.evaluate((l) => {
  const all = [...document.querySelectorAll("main *")];
  const el = all.find((e) => e.children.length === 0 && e.textContent.trim() === l);
  return el?.parentElement?.innerText.replace(l, "").trim() ?? null;
}, label);
marks.screen = {
  banner: (await page.locator(".banner-title").innerText()).trim(),
  accountsWatched: await read("Accounts watched"),
  paidByOneWallet: await read("Paid by one wallet"),
  paymentToPost: await read("Payment to post"),
  decision: await read("Agent's decision"),
};
mark("summary");
await wheel(420);
await pause(2500);
mark("numbers");
await wheel(520);
await pause(2500);
await page.getByText("Who paid whom", { exact: false }).first().scrollIntoViewIfNeeded();
await wheel(-120, 4);
await pause(800);
mark("whoPaidWhom");
await pause(3500);

// 3. Click a red payment line; Sepolia Etherscan opens the real transaction in a new tab
const edge = page.locator(".graph a").first();
marks.clickedTx = await edge.getAttribute("href");
await edge.hover();
await pause(700);
mark("clickEdge");
const [etherscan] = await Promise.all([context.waitForEvent("page"), edge.click()]);
await etherscan.waitForLoadState("domcontentloaded");
const tEther = Date.now();
await etherscan.waitForTimeout(3500);
marks.etherscan = { url: etherscan.url(), title: await etherscan.title(), openedAt: Number(((tEther - t0) / 1000).toFixed(2)) };
await etherscan.close();
await page.bringToFront();
await pause(600);

// 4. T5 (REVIEW), then 5. T2
await page.evaluate(() => window.scrollTo({ top: 0 }));
await pause(500);
await tab("T5").click();
await page.waitForFunction(() => /REVIEW/.test(document.querySelector(".banner-title")?.textContent ?? ""));
mark("t5");
marks.screen.t5Banner = (await page.locator(".banner-title").innerText()).trim();
await pause(4500);
await tab("T2").click();
await page.waitForFunction(() => /ELIGIBLE/.test(document.querySelector(".banner-title")?.textContent ?? ""));
mark("t2");
marks.screen.t2Banner = (await page.locator(".banner-title").innerText()).trim();
await pause(4500);

// 6. Back to T1, press R: Replay shows MATCH. Then T6 and R: HASH_MISMATCH
await tab("T1").click();
await page.waitForFunction(() => /BLOCK/.test(document.querySelector(".banner-title")?.textContent ?? ""));
await pause(1200);
await tab("T1").focus();
await page.keyboard.press("r");
await page.waitForSelector("dialog.replay[open]");
mark("replayMatch");
marks.screen.replayT1 = (await page.locator("dialog.replay").innerText()).replace(/\s+/g, " ").trim();
await pause(3500);
await page.keyboard.press("Escape");
await pause(600);
await tab("T6").click();
await page.waitForFunction(() => /BLOCK/.test(document.querySelector(".banner-title")?.textContent ?? ""));
await pause(1200);
await page.keyboard.press("r");
await page.waitForSelector("dialog.replay[open]");
mark("replayMismatch");
marks.screen.replayT6 = (await page.locator("dialog.replay").innerText()).replace(/\s+/g, " ").trim();
await pause(3500);
await page.keyboard.press("Escape");
await pause(600);

// 7. Back to T1 and press E for the Evidence Brief
await tab("T1").click();
await pause(1200);
await page.keyboard.press("e");
await page.waitForSelector("article.brief");
mark("brief");
await pause(3000);
await wheel(600);
await pause(2500);
mark("end");

const mainVideo = page.video();
const etherVideo = etherscan.video();
await context.close();
await browser.close();
renameSync(await mainVideo.path(), join(RAW, "main.webm"));
renameSync(await etherVideo.path(), join(RAW, "etherscan.webm"));
writeFileSync(join(ROOT, "assets", "capture", "marks.json"), JSON.stringify(marks, null, 2) + "\n");
console.log(JSON.stringify(marks.screen, null, 2));
console.log("raw files:", readdirSync(RAW).join(", "));
