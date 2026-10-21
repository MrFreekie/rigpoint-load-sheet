# RigPoint Load Sheet

A static web app that calculates and documents the load on a single flown loudspeaker hang, replacing the `The_Ballroom_Array_Weights_v6.xlsx` workbook. Everything runs in the browser: no server, no accounts, no tracking. Show files never leave your device unless you move them.

> **Status:** phase 5 of 5 – calculation engine, editing interface, show files, the printed Load Sheet, offline use and desktop save-in-place. See `BRIEF.md` for the full plan.

**Live site:** https://mrfreekie.github.io/rigpoint-load-sheet/

## What it calculates

A hang is split into five zones, top-down: top rigging, hoist, hook / junction, load path 1 (array) and load path 2 (cables). Each rated component is checked against the load it carries, plus a single contingency percentage (default 5%). Results are in kilograms only. There are no dynamic, derating or safety factors; SWL/WLL figures are used exactly as stored in the Spec library.

The governing component is the rated item with the highest utilisation. The static load at the connection point (unfactored) is the figure for structural engineers.

## Development

Requires Node.js 24 or later. The differential test also needs Python 3.

```bash
npm install
```

```bash
npm run ci
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:5173/rigpoint-load-sheet/ |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | ESLint, including a rule that keeps the engine free of DOM and storage code |
| `npm test` | Engine scenarios, unit, property and differential tests; schema tests |
| `npm run e2e` | Playwright end-to-end tests on Chromium, Firefox, iPhone SE (WebKit) and Android, against the production build, including the one-page print checks. Run `npx playwright install` once first |
| `npm run validate:spec` | Spec library validation and the `spec_version` check |
| `npm run reference` | Runs the Python reference engine against the scenarios |
| `npm run icons` | Renders `public/favicon.svg` into the PNG app icons. Run after changing the SVG; the PNGs are committed |

### Layout

| Path | Contents |
|---|---|
| `src/engine/` | Pure calculation: `calculate(hang, contingency)` |
| `src/schema/` | Zod schemas for the Spec library and show files, with plain-English errors |
| `src/print/` | The Load Sheet print view, its stylesheet and the fixed small print |
| `src/files/` | Open, save, save in place, recent files, autosave, migrations and compare-on-open |
| `src/sw.ts` | The service worker: offline precache and the Android share target |
| `e2e/` | Playwright end-to-end tests |
| `src/ui/` | React editing interface; displays engine results and calculates nothing itself |
| `src/testing/` | Test helpers: fixture loading and seeded random hangs |
| `data/spec-library.json` | Equipment library. Changes go through pull requests – see `CONTRIBUTING.md` |
| `fixtures/` | Test scenarios with expected results, and the Ballroom sample show file |
| `reference/` | The workbook (the specification) and the Python reference engine |

### How the engine is tested

- **Scenarios** – the nine cases in `fixtures/scenarios.json`, taken from the recalculated workbook.
- **Unit tests** – LEN?, TBC, quantity 0, empty zones, note-only rows, items no longer in the library, contingency 0, ties, traffic lights, point capacity and rounding.
- **Property test** – increasing any row's quantity never decreases any utilisation (500 random hangs).
- **Differential test** – 400 random hangs built from the real library are run through both the TypeScript engine and `reference/engine_reference.py`; every value must match exactly.

## Show files

A show is saved as `<Job> - <Hang>.loadsheet.json` (with ` - Rev B` added once it has a revision). Open reads a file you choose; Save downloads one. Files never leave your device unless you move them, so keep them in a folder your cloud service already syncs if you want them backed up.

- **Autosave** keeps a copy of unsaved changes in this browser only, as a safety net. The saved file is the record.
- **Compare on open** lists any item whose weight, per or SWL differs from the current Spec library. Nothing changes unless you choose *Update selected*.
- **Approved and superseded** shows open read-only. *Create new revision* makes an editable draft copy with the next revision letter (blank, A, B, …), saved under a new name.

## Install, offline and desktop saving

- **Install and offline.** In Chrome or Edge, use *Install* in the address bar (on Android, *Add to home screen*). Once the app has loaded, it and the Spec library are stored in the browser and it works with no network, installed or not. It says "Ready to work offline" the first time.
- **Save, Save As and Recent (Chrome and Edge desktop).** *Save As* chooses a file; after that, *Save* writes straight back to it instead of downloading a copy. Opening a file there does the same. *Recent* lists the last few show files you opened or saved, so you can reopen them without hunting through folders; the browser may ask again for permission to use a file. Other browsers keep the download behaviour described above.
- **Double-click to open.** With the app installed on Chrome or Edge desktop, `.loadsheet.json` files can open in it directly from your file manager.
- **Sharing from Android.** With the app installed on Android, share a show file from another app (email, a file manager, a chat) and choose Load Sheet to open it.
- **Updates.** A new version never replaces the app in the middle of an edit. When one is ready the app shows *Update available – reload*; choose *Reload* when it suits you. Unsaved changes are kept by autosave and offered back after the reload.

## Printing the Load Sheet

**Print** produces the Load Sheet: one A4 portrait page laid out like the workbook's Load Sheet tab, scaled to fit as the workbook's "fit to 1 page" setting does. Drafts carry a faint DRAFT watermark. The footer records the app version, spec version, file name and print time, so every printout can be traced to the code and data that produced it; it says "(unsaved changes)" or "(not saved)" when the printout does not match a saved file.

## Disclaimer

This software is provided as-is, without warranty. It is a calculation aid and does not replace assessment by a competent person.

**SCOPE** — Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed.

**DATA** — Weights and SWL/WLL figures are taken from the Spec library in this app and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked.

**LOADS** — Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg.

## Licence

MIT – see `LICENCE`.
