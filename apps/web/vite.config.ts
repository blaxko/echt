import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local: the API server on :8787 is proxied, so no key reaches the page.
// Public build (VITE_PUBLIC_DEMO=1): relative paths, so it works under a GitHub Pages sub-path.
const isPublic = process.env.VITE_PUBLIC_DEMO === "1";

export default defineConfig({
  plugins: [react()],
  base: isPublic ? "./" : "/",
  server: { proxy: { "/api": "http://localhost:8787" } },
});
