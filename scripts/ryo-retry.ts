// Retries RYO analyze_token for BTC, ETH and SOL. Saves an ok envelope as a fixture; never fakes one.
//   tsx ryo-retry.ts        (load-env first: . .\scripts\load-env.ps1)
// Run every 2 hours. If a symbol returns status ok, its fixture is saved as ryo-analyze_token-<SYM>.json.
// Error bodies are saved with a timestamp, so each attempt leaves a trace id on disk.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const FIXTURES = join(ROOT, "scenarios", "fixtures");
const url = process.env.RYO_MCP_URL;
const key = process.env.RYO_MCP_KEY;
if (!url || !key) throw new Error("RYO_MCP_URL and RYO_MCP_KEY must be set (load-env first)");

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
mkdirSync(FIXTURES, { recursive: true });
for (const symbol of ["BTC", "ETH", "SOL"]) {
  const res = await fetch(`${url}/tools/analyze_token/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  const body = await res.text();
  const ok = res.ok && /"status"\s*:\s*"ok"/.test(body);
  if (ok) {
    writeFileSync(join(FIXTURES, `ryo-analyze_token-${symbol}.json`), body + "\n");
    console.log(`${symbol}: ok, fixture saved`);
  } else {
    const trace = /"trace_id"\s*:\s*"([0-9a-f]+)"/.exec(body)?.[1] ?? "none";
    writeFileSync(join(FIXTURES, `ryo-analyze_token-${symbol}-error-${stamp}.json`), body + "\n");
    console.log(`${symbol}: HTTP ${res.status}, not ok (trace ${trace})`);
  }
}
