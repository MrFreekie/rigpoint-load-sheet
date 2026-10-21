# Contributing

## Changing the Spec library

Every weight or rating in `data/spec-library.json` ends up on a Load Sheet that someone uses to decide whether a rig is within limits. So library changes always go through a pull request, and **a second person reviews every weight or SWL change** before it is merged.

1. Make a branch and edit `data/spec-library.json`.
2. Set `spec_version` to today's date (`yyyy-mm-dd`). CI fails if the library changes without `spec_version` moving forward.
3. Record where each new or changed figure came from:
   - `weight_note` – how the figure was derived, e.g. `"27.82 kg / 40 m"`.
   - `source` – the manufacturer data sheet, certificate or measurement.
   - `verified` – the ISO date the figure was checked, when known.
4. Never guess a weight. If it is not known, leave `kg` as `null` (shown as TBC).
5. SWL/WLL figures are entered exactly as the manufacturer states them; they already include the manufacturer's design factor. Derated configurations are separate items, named for the configuration, e.g. `Roundsling 2t (choke) SWL 1,600 kg`.
6. If you change the number of items, TBC items or rated items, update the counts in `src/schema/spec-library.test.ts`.
7. Open a pull request listing each changed item with its old and new values and the source.

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
