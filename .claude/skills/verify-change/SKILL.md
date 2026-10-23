---
name: verify-change
description: Run the full RigPoint Load Sheet verification - typecheck, lint, unit tests, build, Python reference, spec_version check, Playwright on all browser profiles including the print one-page checks, and optionally the live site. Use before opening or merging a pull request, after a deploy, or when CI fails.
---

# Verifying a change

Run from the repository root. Report each step as passed / failed / not run, with counts. Never call something passed that you did not see pass.

## 1. Local checks

```bash
npm ci
npm run ci
```
(typecheck for app and service worker, lint, unit tests, production build; a failure stops the chain, so a successful build means the earlier steps passed)

```bash
python reference/engine_reference.py fixtures/scenarios.json fixtures/spec-library.workbook.json
```
Use `python3` on Linux and macOS. All nine scenarios must say PASS.

```bash
node scripts/check-spec-version.mjs origin/main
```

## 2. Browser tests

First time on a machine: `npx playwright install chromium firefox webkit`.

```bash
npx playwright test --project=chromium --project=iphone-se --project=android
```

Add `--project=firefox` except on Windows, where Playwright's Firefox may fail to start ("side-by-side configuration"); CI on Linux runs Firefox. Print tests (one A4 page and nothing clipped) and PWA tests run in Chromium only; skips on other projects are expected.

On a failure, rerun one test with `--reporter=line` and read `test-results/<test>/error-context.md`.

## 3. CI

After pushing: `gh pr checks <n>` or `gh run watch <id> --exit-status`. A library branch runs twice (push and pull_request); the push run compares `spec_version` with the previous commit on the branch.

## 4. Live site (after a deploy)

```bash
E2E_BASE_URL=https://mrfreekie.github.io/rigpoint-load-sheet/ npx playwright test e2e/print.spec.ts e2e/pwa.spec.ts e2e/theme.spec.ts --project=chromium --project=iphone-se
```

## Things that are expected, not failures

- 14-ish skipped tests (Chromium-only print and PWA tests on other projects).
- CRLF warnings from git on Windows.

## Things that need the owner

Installed-app double-click (file handlers), real-phone checks, and comparing a printout with the workbook cannot be automated. Say so in the report.
