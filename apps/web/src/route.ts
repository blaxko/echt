// The hash is the whole router. GitHub Pages and Vercel both serve one index.html, so every page lives after a `#`.
//   #/                landing (home)
//   #/how-it-works    section pages, one per landing section
//   #/app             the decision dashboard
//   #/brief/T1        the Evidence Brief for one scenario (unchanged from the first release)
// Old dashboard links that used #/dashboard are rewritten to #/app. The bare root moved to the landing page.

export const SITE_PAGES = ["how-it-works", "proof", "why-it-matters", "built-with", "limits", "faq"] as const;
export type SitePage = "home" | (typeof SITE_PAGES)[number];

export type Route =
  | { kind: "site"; page: SitePage }
  | { kind: "app" }
  | { kind: "brief"; scenario: string };

const APP_ALIASES = new Set(["/app", "/dashboard"]);

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return { kind: "site", page: "home" };
  if (APP_ALIASES.has(path)) return { kind: "app" };
  const brief = path.match(/^\/brief\/(T\d)$/);
  if (brief) return { kind: "brief", scenario: brief[1]! };
  const page = SITE_PAGES.find((p) => path === `/${p}`);
  return { kind: "site", page: page ?? "home" };
}

// The hash a legacy alias should be replaced with, or null when the hash is already canonical.
export function canonicalHash(hash: string): string | null {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "");
  return APP_ALIASES.has(path) && path !== "/app" ? "#/app" : null;
}
