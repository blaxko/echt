# Changelog

## Unreleased: public demo and launch (28 Oct 2026)

### Added
- Public read-only site on GitHub Pages, built from `main` (`.github/workflows/pages.yml`). It replays committed records in the browser with no server and no keys.
- Loading state: nothing (not even "IDLE") is shown until the record request settles. Failed requests retry, then show an error with a retry button.
- Page error boundary with a reload button.
- Content Security Policy for the public build.
- Real T1 and T2 verdicts on Ethereum Sepolia, read back with `getVerdict` (see README).
- Extraction of each post by a model (PRD F2), cached and labelled `MODEL`. Disclosure flags feed the run.
- `docs/submission.md`, `docs/launch.md`, `docs/demo-script.md`, `docs/LIMITATIONS.md`, `docs/ARCHITECTURE.md`.
- Dependabot for npm and GitHub Actions.

### Fixed
- Write gas limit raised from 500,000 to 2,000,000. The receiver needs about 1.36M gas, and the earlier limit let the forwarder swallow the revert (DECISIONS D25).
- The server counts the campaign source's transactions the same way the workflow does (D26).
- An empty `ECHT_VERDICTS_ADDRESS` in `.env` is treated as unset (D27).
- The zod dev dependency is pinned to 4.6.6 or later (high-severity audit finding).
- Tables and the payment graph are readable at 375 px. Wide tables scroll inside their own box.

### Changed
- The T2 banner explains the outcome: "ELIGIBLE: no qualifying payment pattern. No position, because live market data (RYO) is unavailable."
- pnpm is pinned to 10.34.9 (`packageManager`).
- `viem` and `openai` are normal server dependencies.

### Known limits
- RYO market data was unavailable for BTC, ETH and SOL throughout the build, so no practice position can open.
- The CRE step is a local simulation, not a deployed DON.
- The personas, posts and payments are synthetic or testnet data. See `docs/LIMITATIONS.md`.
