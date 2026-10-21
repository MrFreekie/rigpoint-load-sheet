# Development

Notes for anyone changing the code or the equipment list. If you only use the app, see the [user guide](user-guide.md) instead.

The app was built from a build brief that the owner keeps privately. Code comments such as "BRIEF.md section 10" refer to sections of that brief; ask the owner if you need it. The workbook in `reference/` is the source of truth for the calculation: where it and the code disagree, ask before changing anything.

## Ground rules

- UK English everywhere: interface text, comments, file names and documentation.
- Kilograms only. No dynamic, derating or safety factors; the only adjustment is the contingency.
- Never invent equipment data. Weights and ratings come only from `data/spec-library.json`.
- The calculation engine in `src/engine/` stays pure: no DOM, framework or storage code.
- Never edit the expected values in `fixtures/scenarios.json` to make a test pass.
- The small print in `src/print/small-print.ts` and `DISCLAIMER.md` is fixed text.
- No server, no accounts, no tracking and no third-party network calls. Keep the strict Content Security Policy in `vite.config.ts` as it is.
- Every new dependency needs a reason in the pull request.

## Getting started

You need Node.js 24 or later. The differential test also needs Python 3.

```bash
npm install
npm run dev
```

The development server runs at http://localhost:5173/rigpoint-load-sheet/.

On Windows, if PowerShell refuses to run `npm`, use `npm.cmd` instead (for example `npm.cmd run dev`), or run the commands from Command Prompt.

To try the production build, including offline use and installing the app:

```bash
npm run build
npm run preview
```

Then open http://localhost:4173/rigpoint-load-sheet/ in Chrome or Edge. Browsers allow installing from `localhost`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serves the production build |
| `npm run typecheck` | TypeScript in strict mode, for the app and the service worker |
| `npm run lint` | ESLint, including a rule that keeps the engine free of DOM and storage code |
| `npm test` | Engine scenarios, unit, property and differential tests; schema and file tests |
| `npm run e2e` | Playwright end-to-end tests on Chromium, Firefox, iPhone SE (WebKit) and Android, against the production build. Run `npx playwright install` once first |
| `npm run validate:spec` | Spec library validation and the `spec_version` check |
| `npm run reference` | Runs the Python reference engine against the scenarios |
| `npm run icons` | Renders `public/favicon.svg` into the PNG app icons. Run after changing the SVG; the PNGs are committed |
| `npm run ci` | Typecheck, lint, unit tests and build, as CI runs them |

## Layout

| Path | Contents |
|---|---|
| `src/engine/` | Pure calculation: `calculate(hang, contingency)` |
| `src/schema/` | Zod schemas for the Spec library and show files, with plain-English errors |
| `src/files/` | Open, save, save in place, recent files, autosave, migrations and compare-on-open |
| `src/ui/` | React editing interface. It displays engine results and calculates nothing itself |
| `src/print/` | The Load Sheet print view, its stylesheet and the fixed small print |
| `src/sw.ts` | The service worker: offline precache and the Android share target |
| `src/testing/` | Test helpers: fixture loading and seeded random hangs |
| `e2e/` | Playwright end-to-end tests |
| `data/spec-library.json` | The equipment list |
| `fixtures/` | Test scenarios with expected results, and the Ballroom sample show file |
| `reference/` | The workbook (the specification) and the Python reference engine |

## How the engine is tested

- **Scenarios**: the nine cases in `fixtures/scenarios.json`, taken from the recalculated workbook.
- **Unit tests**: LEN?, TBC, quantity 0, empty zones, note-only rows, items no longer in the library, contingency 0, ties, traffic lights, point capacity and rounding.
- **Property test**: increasing any row's quantity never decreases any utilisation (500 random hangs).
- **Differential test**: 400 random hangs built from the real library go through both the TypeScript engine and `reference/engine_reference.py`, and every value must match exactly.

## Show files

Show files are JSON, named `<Job> - <Hang>.loadsheet.json`. The format is versioned (`"format": "loadsheet/1"`). Each row keeps a snapshot of its item's weight and rating, and the engine calculates from the snapshot, so a file reopened later gives the same answer. Every opened file is validated with Zod and treated as untrusted. A future format version needs a migration in `src/schema/` and a test for it.

Saving works in three layers:

1. Open with a file input and save as a download, in every browser.
2. Save in place and recent files with the File System Access API, on Chrome and Edge desktop. Detected by feature, never by user agent.
3. Autosave to IndexedDB in every browser, as a safety net only.

## Offline, install and updates

`vite-plugin-pwa` builds the web manifest and the service worker (`src/sw.ts`, `injectManifest` strategy). The service worker precaches the app shell, the bundled Spec library and the icons.

- `registerType: 'prompt'`: a new version waits until the user presses **Reload** on the "Update available – reload" banner (`src/ui/UpdatePrompt.tsx`). Open sessions check for a new version every hour.
- `file_handlers` with `launchQueue` (`src/files/launch.ts`) opens a double-clicked show file in the installed app on Chrome and Edge desktop.
- `share_target` lets Android share a show file into the installed app. The service worker receives the POST, keeps the file in a cache and redirects; `src/files/share-target.ts` then opens it.

## Releasing

Pushing to `main` deploys to GitHub Pages. `deploy.yml` runs the whole CI workflow first and only publishes if it passes. So all work goes on a branch with a pull request, and merging the pull request is the release.

Once a release is live, users see the update banner the next time their app checks.

## Changing the equipment list

See [CONTRIBUTING.md](../CONTRIBUTING.md). Every weight or rating change goes through a pull request and is reviewed by a second person, and `spec_version` must move forward.
