import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { CSP_DIRECTIVES } from "./csp.ts";

// Local: the API server on :8787 is proxied, so no key reaches the page.
// Public build (VITE_PUBLIC_DEMO=1): relative paths for a GitHub Pages sub-path, and a Content Security
// Policy in a <meta> tag. The Vercel deployment sends the same policy as a header (vercel.json).
const isPublic = process.env.VITE_PUBLIC_DEMO === "1";
const CSP = CSP_DIRECTIVES.join("; ");

const publicCsp: Plugin = {
  name: "echt-public-csp",
  transformIndexHtml(html) {
    return isPublic ? html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`) : html;
  },
};

export default defineConfig({
  plugins: [react(), publicCsp],
  base: isPublic ? "./" : "/",
  server: { proxy: { "/api": "http://localhost:8787" } },
});
