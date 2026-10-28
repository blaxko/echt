# Launch checklist: the public demo

Scope: the read-only site at https://blaxko.github.io/echt/, built from `main` by `.github/workflows/pages.yml`. It serves committed files only. There is no server, no database and no key in the browser.

## Pre-launch results

| Area | Item | Status | Evidence |
|---|---|---|---|
| Code quality | Tests pass | Done | `pnpm test`: 125 tests, plus 15 Bun tests for the CRE helpers (run by the `cre-tests` job) |
| Code quality | Build succeeds with no warnings | Done | `pnpm --filter @echt/web build:public` |
| Code quality | Lint and type checking | Typecheck done. No lint script exists | `pnpm typecheck` passes. The CLAUDE.md lint step was never set up; see Open items |
| Code quality | No TODOs or debug logging in shipped code | Done | Grep: `console.log` only in CLI scripts and the server's startup line. The one `console.error` is the error boundary |
| Code quality | Error handling for failure modes | Done | Loading and error states with retry; a page error boundary; a failed record is never shown as a verdict |
| Security | No secrets in the repo | Done | gitleaks: no leaks (allowlist for the extraction cache, which holds SHA-256 hashes, not secrets) |
| Security | Dependency audit | Done | `pnpm audit --audit-level=high`: no known vulnerabilities. One high finding (zod < 4.6.6, dev toolchain) fixed with a `pnpm.overrides` entry |
| Security | Content Security Policy | Done for the public build | `<meta>` CSP: `default-src 'self'`, no inline scripts. See limits below |
| Security | Input validation, auth, rate limits, CORS | Not applicable | The public site has no inputs that reach a server, no accounts and no API |
| Performance | Bundle size | Done | JS 245 kB (77 kB gzip). CSS 5 kB |
| Performance | Core Web Vitals | Not measured | No Lighthouse run recorded. Open item |
| Accessibility | Keyboard navigation | Done | Tab order follows the zones; Esc closes the run log; R and E shortcuts |
| Accessibility | axe-core: no violations | Done | Run in the browser on the dashboard, the Brief and every tab |
| Accessibility | Contrast, focus rings | Done | Visible focus ring on every control. Colour is never the only signal (icon and word) |
| Accessibility | Mobile | Done | 375 px: no horizontal page scroll. Graph hidden below 600 px; the table opens instead |
| Infrastructure | HTTPS | Done | GitHub Pages serves over HTTPS |
| Infrastructure | Environment variables | Not applicable | The public build reads no environment at run time |
| Infrastructure | Health check | Not applicable | Static files. The URL returning 200 is the check |
| Infrastructure | Logging and error reporting | Not configured | GitHub Pages gives no access logs or error reports. Open item |
| Documentation | README, ADR-style decisions, changelog | Done | README, `docs/DECISIONS.md` (the project's existing log, which this repo continues), `CHANGELOG.md` |

## Rollback plan

Trigger: the live page shows a wrong verdict, a broken link, or the Replay result changes for a committed record.

1. Revert the bad commit on `main` (`git revert <commit>`) and push. The `pages` workflow runs the gates and redeploys the previous state. Typical time: a few minutes.
2. To stop the site entirely: GitHub repo → Settings → Pages → Source, then choose "Deploy from a branch" with nothing selected. The site goes offline.
3. Verify after rollback: the URL returns 200, the T1 and T2 verdicts match the chain links in the README, and Replay returns MATCH on T1.

Nothing on the public site writes to a chain or stores user data, so a rollback never needs a data migration.

## Monitoring

GitHub Pages does not report traffic, errors or uptime to the repository. Monitoring for this site is therefore manual:
- Each push to `main` runs the gates. A failing gate blocks the deploy.
- The post-launch check is the list in step 3 above, done by hand after each deploy.
- Dependabot opens weekly pull requests for npm and GitHub Actions updates (`.github/dependabot.yml`).

## Limits of this launch

- **No security headers beyond CSP.** Pages cannot set HTTP headers, so the CSP is a `<meta>` tag. `frame-ancestors` (clickjacking) is not honoured in a meta tag, so the site can be framed. The site has no sensitive actions, so this is accepted.
- **No error reporting.** Client errors are logged to the browser console only.
- **Read-only by design.** The "Run check" button is replaced with "Runs require local setup. See README." Replay runs in the browser, so it stays offline.

## Open items

- Set up the lint step that CLAUDE.md §5 names (there is no lint script yet).
- Run a Lighthouse pass and record the Core Web Vitals numbers.
- Decide whether to add an error reporting service. It would need a key, so it is a decision for the owner.
