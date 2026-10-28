# Bug log

Every bug found in the hardening sweep (branch `day4-hardening`): what it was, the root cause, the fix, and the test that now guards it. Entries are added as they are found.

| # | Bug | Root cause | Fix | Test |
|---|---|---|---|---|
| 1 | After a tab switch, the previous scenario's record could render for one frame before the loading state appeared. | The loading state was reset inside an effect, after the first render had already used the old record. | The load state is tagged with the scenario it was requested for. A record for another scenario counts as loading (`shownFor`). The effect no longer calls `setState` synchronously. | `load.test.ts`: "never shows a record for another scenario, even for one frame after a tab switch" |
| 2 | The Brief route could show the previous scenario's record for one frame. | The scenario was copied from the hash into state in an effect, so the first render used the wrong scenario. | The scenario on screen is derived during render: the Brief route's scenario when open, otherwise the tab picked. | Same test as bug 1, plus the `shownFor` contract |
| 3 | Running `scripts/build-run-records.ts` overwrote the real T1 and T2 records with dry-run data. Found by running it, not by a test. | The script rebuilt every record unconditionally. Nothing checked whether a record was real. | The script keeps any record whose `dryRun` is `false`, and says so. | Verified by running the script: "kept the real record (dryRun false); not overwritten". Records restored from git first. |
| 4 | Lint: a raw byte-order mark sat inside a regex in five files. | An earlier edit wrote the BOM as a literal character. | Replaced with the `﻿` escape. No behaviour change. | `pnpm lint` (no-irregular-whitespace) |
| 5 | Lint: an unused destructured binding and two unused imports. | Left over from earlier edits. | Removed. | `pnpm lint` |
| 6 | Lint: `any` in the run-record builder hid the shape of the scenario files. | Quick script, untyped. | Typed the fields the script reads. | `pnpm lint` and `pnpm typecheck` |
| 7 | The tabs and the Brief showed a retry button that did not refetch. | The retry changed the loading state but not the value the effect depends on. | The retry increments an attempt counter that the effect depends on. | `load.test.ts` (retry path) |
