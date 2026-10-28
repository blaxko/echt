// The one Content Security Policy for the public build. The <meta> tag (vite.config.ts) and the response
// header (vercel.json) must carry the same directives. A test in test/csp.test.ts checks that they match.
export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

// frame-ancestors only works as a header, so the header adds it and the meta tag omits it.
export const CSP_HEADER_ONLY = ["frame-ancestors 'none'"] as const;
