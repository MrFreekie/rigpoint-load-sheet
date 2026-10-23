---
name: library-change
description: Add, change or remove equipment in the RigPoint Load Sheet Spec library (data/spec-library.json) - weights, SWLs, per-metre items, weight notes, sources - including the spec_version bump, count tests and the review pull request. Use whenever the owner supplies equipment data.
---

# Changing the Spec library

Every figure ends up on a signed Load Sheet. Enter data exactly as supplied; never guess.

## 1. Check what you were given

- Name, weight in kg (or kg per metre), `each` or `m`, SWL/WLL in kg. Missing weight → `null` (TBC). Missing SWL → `null` (not rated).
- Compare with existing items by name (`data/spec-library.json`). Say which are new and which change, with old → new.
- Anything odd (identical figures on different items, a per-metre item without a note on how length is measured, a unit that does not look like kg) → ask, or record it as a reviewer question. Do not fix it yourself.
- `weight_note` explains how a figure is used or derived (e.g. "Per metre of height of lift (HOL)…", "27.82 kg / 40 m"). `source` and `verified` only if the owner gives them.

## 2. Branch

Use the existing library PR branch if one is open (`gh pr list`), otherwise `git checkout -b library/<short-name>` from an up-to-date `main`.

## 3. Edit `data/spec-library.json`

- Keep the file's formatting: 2-space indent, `ensure_ascii=False`, **no** trailing newline at the end of the file. Check `git diff` shows only your change.
- Insert new items next to similar ones (chains with chains, hoists with hoists).
- Names must be unique. Copy them exactly, including ×, –, commas in decimals.
- Bump `spec_version`: today's date `yyyy-mm-dd`; if the library already changed today (on this branch or `main`), add `.2`, `.3`… It must move forward on **every commit** that changes the file, not just once per PR.

## 4. Tests

- Update the counts in `src/schema/spec-library.test.ts` (items, TBC, rated) to match.
- Never touch `fixtures/spec-library.workbook.json` or `fixtures/scenarios.json`.
- If an item used by the Ballroom example (`fixtures/ballroom.loadsheet.json`) changes, e2e tests that open that file as a user file will now show the library-changes dialog. Update those tests to close it; do not change the example's snapshots.
- Run: `npm test`, `node scripts/check-spec-version.mjs origin/main`, and the e2e projects that open files.

## 5. Pull request

Commit, push, and open or update the PR. The description lists every changed item in a table (name, kg, per, SWL; old → new for changes), the new `spec_version`, the counts, any effect on results (e.g. a newly rated chain now ties with the hoist), and **questions for the reviewer**. Never merge it: a second person must check the figures.
