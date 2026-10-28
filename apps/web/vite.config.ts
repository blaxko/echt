import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Local: the API server on :8787 is proxied, so no key reaches the page.
// Public build (VITE_PUBLIC_DEMO=1): relative paths for a GitHub Pages sub-path, and a Content Security
// Policy. Pages cannot send HTTP headers, so the policy is a <meta> tag. frame-ancestors is not honoured
// in a meta tag, so clickjacking protection is not provided here.
const isPublic = process.env.VITE_PUBLIC_DEMO === "1";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
