import { serve } from "@hono/node-server";
import { app } from "./app.ts";

// Local development server. The Sepolia RPC URL, Etherscan key and CRE keys come from the root .env,
// loaded by `. .\scripts\load-env.ps1`. Nothing here reaches the browser.
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`echt server on http://localhost:${info.port}`);
});
