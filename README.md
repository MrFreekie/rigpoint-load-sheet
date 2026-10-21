# RigPoint Load Sheet

A static web app that calculates and documents the load on a single flown loudspeaker hang, replacing the `The_Ballroom_Array_Weights_v6.xlsx` workbook. Everything runs in the browser: no server, no accounts, no tracking. Show files never leave your device unless you move them.

> **Status:** phase 1 of 5 – calculation engine and tests. There is no user interface yet. See `BRIEF.md` for the full plan.

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
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | ESLint, including a rule that keeps the engine free of DOM and storage code |
| `npm test` | Engine scenarios, unit, property and differential tests; schema tests |
| `npm run validate:spec` | Spec library validation and the `spec_version` check |
| `npm run reference` | Runs the Python reference engine against the scenarios |

### Layout

| Path | Contents |
|---|---|
| `src/engine/` | Pure calculation: `calculate(hang, contingency)` |
| `src/schema/` | Zod schemas for the Spec library and show files, with plain-English errors |
| `src/testing/` | Test helpers: fixture loading and seeded random hangs |
| `data/spec-library.json` | Equipment library. Changes go through pull requests – see `CONTRIBUTING.md` |
| `fixtures/` | Test scenarios with expected results, and the Ballroom sample show file |
| `reference/` | The workbook (the specification) and the Python reference engine |

### How the engine is tested

- **Scenarios** – the nine cases in `fixtures/scenarios.json`, taken from the recalculated workbook.
- **Unit tests** – LEN?, TBC, quantity 0, empty zones, note-only rows, items no longer in the library, contingency 0, ties, traffic lights, point capacity and rounding.
- **Property test** – increasing any row's quantity never decreases any utilisation (500 random hangs).
- **Differential test** – 400 random hangs built from the real library are run through both the TypeScript engine and `reference/engine_reference.py`; every value must match exactly.

## Disclaimer

This software is provided as-is, without warranty. It is a calculation aid and does not replace assessment by a competent person.

**SCOPE** — Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed.

**DATA** — Weights and SWL/WLL figures are taken from the Spec library in this workbook and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked.

**LOADS** — Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg.

## Licence

MIT – see `LICENCE`.
