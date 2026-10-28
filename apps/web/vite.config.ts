import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { CSP_DIRECTIVES } from "./csp.ts";

// Local: the API server on :8787 is proxied, so no key reaches the page.
// Public build (VITE_PUBLIC_DEMO=1): relative paths for a GitHub Pages sub-path, the Content Security Policy
// in a <meta> tag (the Vercel deployment sends the same policy as a header), the stylesheet inlined so it
// does not block the first paint, and the T1 record preloaded so the first verdict arrives without a second
// round trip.
const isPublic = process.env.VITE_PUBLIC_DEMO === "1";
const CSP = CSP_DIRECTIVES.join("; ");

const publicBuild: Plugin = {
  name: "echt-public-build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      if (!isPublic) return html;
      let out = html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <link rel="preload" href="./demo/runs/T1.json" as="fetch" crossorigin="anonymous" />`);
      const bundle = ctx.bundle ?? {};
      for (const [name, asset] of Object.entries(bundle)) {
        if (!name.endsWith(".css") || asset.type !== "asset") continue;
        // The stylesheet is inlined into index.html at the site root, so font paths resolve from ./ and not ../.
        const css = String(asset.source).replace(/url\(\.\.\/fonts\//g, "url(./fonts/");
        const tag = out.match(/<link[^>]*rel="stylesheet"[^>]*>/)?.[0];
        if (tag && tag.includes(name)) out = out.replace(tag, `<style>${css}</style>`);
        delete bundle[name];
      }
      return out;
    },
  },
};

export default defineConfig({
  plugins: [react(), publicBuild],
  base: isPublic ? "./" : "/",
  server: { proxy: { "/api": "http://localhost:8787" } },
});
