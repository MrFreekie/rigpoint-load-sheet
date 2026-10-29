# Contributing

## Changing the Spec library

Every weight or rating in `data/spec-library.json` ends up on a Load Sheet that someone uses to decide whether a rig is within limits. So library changes always go through a pull request, and **a second person reviews every weight or SWL change** before it is merged.

1. Make a branch and edit `data/spec-library.json`.
2. Set `spec_version` to today's date (`yyyy-mm-dd`). If the library has already changed today, add a change number: `2026-10-21.2`, then `.3` for a third change the same day, and so on. CI fails if the library changes without `spec_version` moving forward.
3. Give a source for every figure. Record where each new or changed figure came from:
   - `weight_note` – how the figure was derived, e.g. `"27.82 kg / 40 m"`.
   - `source` – the manufacturer data sheet, certificate or measurement.
   - `verified` – the ISO date the figure was checked, when known.
4. Never guess a weight. If it is not known, leave `kg` as `null` (shown as TBC).
5. SWL/WLL figures are entered exactly as the manufacturer states them; they already include the manufacturer's design factor. If a manufacturer publishes a rating for a different configuration (a choke hitch, say), add it as a separate item named for that configuration, with the manufacturer's figure.
6. Keep figures within the app's limits: a weight (`kg`) of 100,000 kg or less, and an SWL of 1,000,000 kg or less. Show files over these limits are rejected.
7. Never edit `fixtures/spec-library.workbook.json`. It is a frozen copy used by the test scenarios and the Python reference, not the live library.
8. If you change the number of items, TBC items or rated items, update the counts in `src/schema/spec-library.test.ts`.
9. Open a pull request listing each changed item with its old and new values and the source.

CI checks that names are unique, `per` is `each` or `m`, numbers are not negative, and `spec_version` has moved forward.

## Code

- UK English everywhere: interface text, comments, file names and documentation.
- Units are kilograms only.
- The calculation engine (`src/engine/`) stays pure: no DOM, framework or storage code.
- Every new dependency needs a reason in the pull request description.
- If the TypeScript engine and `reference/engine_reference.py` disagree, do not edit the expected values in `fixtures/scenarios.json`. Raise it.

Run everything CI runs with:

```bash
npm run ci
```
