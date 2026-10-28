import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API server runs on :8787. The browser only talks to it through this proxy, so no key reaches the page.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
});
