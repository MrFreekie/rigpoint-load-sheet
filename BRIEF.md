# Build brief: Flown Array Load Sheet web app

You are building a static web app, hosted on GitHub Pages, that replaces an Excel workbook used to calculate and document the load on a single flown loudspeaker hang. The workbook is in `reference/The_Ballroom_Array_Weights_v6.xlsx`. It is the specification: where this brief and the workbook disagree, stop and ask.

This is a safety-related tool. People use its output to decide whether a rig is within limits. Correctness of the calculation, and honesty about what it does and does not check, matter more than features or polish.

Work in the phases set out in section 14. **Stop at the end of each phase**, summarise what you built and how you tested it, and wait for approval before starting the next.

---

## 1. Before you write any code, ask the user

1. **App and repo name.** Suggest a few if they have none.
2. **Public or private repo.** A public repo also publishes the Spec library. GitHub Pages on a private repo needs a paid GitHub plan.
3. **Licence.** Suggest MIT plus the disclaimer in section 10.
4. **Revision scheme.** Letters (A, B, C) or numbers (1, 2, 3), and whether it starts blank or at A/1 for the first issue.

Do not guess these.

---

## 2. Hard rules

These are decisions the user has made. Do not change them, and do not add features that undo them.

- **Units are kilograms only.** No newtons, no kN. Structural engineers do their own conversion.
- **No dynamic factor, no derating factor, no safety factor.** The only adjustment is a single contingency percentage (default 5%). Component SWL/WLL figures are used exactly as stored; they already include the manufacturer's design factor.
- **Derated configurations are separate library items**, named for example `Roundsling 2t (choke) SWL 1,600 kg`. Do not add a derating column.
- **One hang per calculation.** The file format holds a list of hangs, but each is calculated on its own. Do not build multi-point load sharing.
- **UK English** in all interface text, file names, comments and documentation (colour, metre, licence, organisation).
- **Never invent equipment data.** Weights and SWLs come only from `data/spec-library.json` or the user. Missing weights stay `null` (shown as TBC).
- **The small print in section 10 is fixed text.** Reproduce it exactly. Do not reword, shorten or "improve" it without asking.
- **No server, no accounts, no tracking, no analytics, no third-party network calls.** Everything runs in the browser. Show files never leave the user's device unless they move them.
- **The calculation engine is pure and separate.** No DOM, framework or storage code inside it.

## 3. Out of scope

Do not build these. If you think one is needed, raise it instead.

- Cloud integrations (Google Drive, Dropbox, OneDrive APIs). Users keep show files in folders their cloud service already syncs.
- Multi-point arrays, bridle geometry, sling angles, load transfer between points.
- Venue structure assessment.
- Asset tracking or LOLER certificate management.
- Kit or prep list generation.
- Editing the Spec library inside the app. Library changes go through pull requests on `data/spec-library.json` (see section 7.1).

---

## 4. Tech stack

Use current stable versions. Pin exact versions in `package.json` and commit the lockfile.

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict` mode |
| Build | Vite |
| UI | React |
| Schema validation | Zod |
| Unit tests | Vitest |
| End-to-end and print tests | Playwright |
| Offline/PWA | `vite-plugin-pwa` (Workbox) |
| Local storage | IndexedDB, through the small `idb-keyval` package or equivalent |
| CI and deploy | GitHub Actions to GitHub Pages |

Keep dependencies few. Every added dependency needs a reason in the pull request description.

## 5. Repository layout

```
/
├─ data/
│  └─ spec-library.json          equipment library (provided)
├─ src/
│  ├─ engine/                    pure calculation, no UI
│  │  ├─ types.ts
│  │  ├─ calculate.ts
│  │  └─ calculate.test.ts       driven by fixtures/scenarios.json
│  ├─ schema/                    Zod schemas, migrations, validation
│  ├─ files/                     open, save, autosave, compare-on-open
│  ├─ ui/                        React components
│  ├─ print/                     Load Sheet print view and print CSS
│  └─ main.tsx
├─ fixtures/
│  ├─ scenarios.json             test cases with expected results (provided)
│  └─ ballroom.loadsheet.json    sample show file (provided)
├─ reference/
│  ├─ The_Ballroom_Array_Weights_v6.xlsx
│  └─ engine_reference.py        Python version of the calculation (provided)
├─ public/                       icons, manifest assets
├─ .github/workflows/            ci.yml, deploy.yml
├─ LICENCE
├─ DISCLAIMER.md
└─ README.md
```

---

## 6. The calculation

`reference/engine_reference.py` implements this section and passes every case in `fixtures/scenarios.json`. Read it. Your TypeScript engine must produce the same results.

### 6.1 Zones

A hang is a load path from the connection point down. Items are grouped into five zones, always in this order:

| Key | Name | Contains |
|---|---|---|
| `top_rigging` | Top rigging | Everything above the hoist: steels, beam clamps, slings to structure |
| `hoist` | Hoist | Hoist body, chain, chain bag, hoist power and control cables and connectors |
| `hook` | Hook / junction | Below the hoist hook, feeding both paths: shackles, master link |
| `path1` | Load path 1 – array | Array frames and loudspeakers, e.g. M-BAR, then M-BUMP, then boxes |
| `path2` | Load path 2 – cables | Cable pick sling, multicores, splits. These hang from the junction, not the array frames |

Within each zone, rows are listed **top-down**, and order matters. A component carries only the rows listed **after** it in its own zone, plus whatever the zone rules below add. The UI must let users reorder rows.

The connection point sits above everything and carries the total.

### 6.2 Rows

A row has an optional `note` (a free-text label such as "Rigging Frame"), an optional library `item`, `qty`, and `length_m`. A row with a note and no item is allowed (for example "Hoist Chain Bag" with no weight yet). It weighs nothing and appears on the print.

For a row with an item, using the values snapshotted in the show file (section 7.2):

- `per = "each"`: line weight = `kg`
- `per = "m"`: line weight = `kg × length_m`. If `length_m` is empty or 0, the row is flagged **LEN?** and excluded from totals
- `kg = null`: the row is flagged **TBC** and excluded from totals
- Row total = line weight × `qty`. An empty quantity counts as 0
- An item that is no longer in the library keeps its snapshot values and is marked "not in current library". It is not an error

Zone subtotal = sum of row totals. **Total static weight** = sum of the five subtotals.

### 6.3 Carried load for each rated row

A row is rated when its `swl_kg` is a number greater than 0. Unrated rows contribute weight but are not checked.

Let `below` be the sum of row totals after this row in the same zone, and `S(zone)` a zone subtotal.

| Zone | Carried load (static) |
|---|---|
| `top_rigging` | `below + S(hoist) + S(hook) + S(path1) + S(path2)` |
| `hoist`, body down | `S(hoist) + S(hook) + S(path1) + S(path2)` (the whole hoist zone, including the hoist's own weight and every hoist-zone row, whatever its position) |
| `hoist`, body up | `S(hook) + S(path1) + S(path2)` (the hoist's own weight, chain and cables hang on the top rigging instead) |
| `hook` | `below + S(path1) + S(path2)` |
| `path1`, `path2` | `below` |

Body down (the hoist climbs its chain with the load) is the default and the usual touring setup.

A row's **own weight is never part of its own carried load**, except in the hoist zone with body down, where the whole zone counts.

If a rated row has `qty > 1`, or several rated rows share a zone, **each is checked against the full load**. Load is never divided between them. This is deliberately conservative and is stated in the small print.

### 6.4 Contingency and utilisation

- `contingency` is a job-level fraction, default `0.05`. It is applied to every carried load: `carried_design = carried_static × (1 + contingency)`.
- `used = carried_design ÷ swl_kg`.
- If contingency is set to 0, show a visible warning on screen. It is a deliberate decision, not a default.

### 6.5 Governing components

- **Per zone:** the rated row with the highest `used`. Report its item, SWL, carried load (with contingency) and `used`.
- **Overall governing component:** the highest `used` across all rated rows in all zones.
- **Ties:** if several rows share the top `used` (compare with a tolerance of 1e-9), name the first in zone order then row order, and say "(+N other at the same utilisation)". Scenario D tests this.
- If no rated rows exist, say "– no rated items listed –".

The governing component is the highest **utilisation**, not the lowest SWL. A small bumper carrying a lot can govern over a large hoist carrying little.

### 6.6 Connection point

- **Static load at point (unfactored)** = total static weight. This is the figure given to structural engineers. Label it as unfactored everywhere it appears.
- **Design load at point** = total static × (1 + contingency).
- Optional **stated point capacity** in kg, with a source and conditions. Status:

| Condition | Status | Message |
|---|---|---|
| No capacity entered | `for_approval` | No stated capacity – design load to be submitted for approval. |
| Capacity, no source | `no_source` | ⚠ CAPACITY STATED WITH NO SOURCE – attribute the figure before relying on it. |
| Design load ÷ capacity > 1 | `exceeded` | ⚠ DESIGN LOAD EXCEEDS STATED POINT CAPACITY |
| Otherwise | `recorded` | Stated capacity recorded. To be confirmed by the venue / structural engineer. |

The point is **not** included in the equipment governing component. It is a separate check.

### 6.7 Data check

If any row is flagged TBC or LEN?, show: "⚠ MISSING DATA – total understated. Resolve TBC / NOT FOUND / LEN? flags." Otherwise show: "OK – all line data resolved". The warning appears on screen and on the print.

### 6.8 Traffic lights

| `used` | Colour | Word |
|---|---|---|
| > 0 and < 0.85 | green | OK |
| ≥ 0.85 and ≤ 1.00 | amber | CHECK |
| > 1.00 | red | OVER |

Always show the word and the percentage next to the colour, never colour alone.

### 6.9 Formatting

- Weights: 2 decimal places, `en-GB` grouping, "kg" unit (e.g. `1,234.56 kg`)
- SWL: 0 decimal places (`1,000 kg`)
- Utilisation: 1 decimal place (`46.7%`)
- Dates: `dd/mm/yyyy`
- Round for display only. Never round inside the engine.

### 6.10 Engine interface

```ts
calculate(hang: Hang, contingency: number): HangResult
```

`HangResult` includes the zone subtotals, total static, contingency in kg, design load at point, flags with the row each came from, a per-row check list, per-zone governing, overall governing with tie count, and point status and utilisation. The UI and print view display these values and compute nothing themselves.

---

## 7. Data formats

### 7.1 Spec library: `data/spec-library.json`

Provided with 177 items: 27 with no weight yet (TBC) and 73 rated.

```json
{
  "format": "loadsheet-spec/1",
  "spec_version": "2026-10-21",
  "items": [
    { "name": "L-Acoustics M-BUMP", "kg": 25, "per": "each", "swl_kg": 832,
      "weight_note": null, "source": null, "verified": null }
  ]
}
```

- `name` is the unique key. Validate uniqueness in CI.
- `per` is `"each"` or `"m"`. For `"m"`, `kg` is kilograms per metre.
- `kg: null` means TBC.
- `weight_note` records how the figure was derived, e.g. `"27.82 kg / 40 m"`.
- `source` and `verified` (an ISO date) are for future use. Display them when present.
- `spec_version` is the date of the last library change. CI must fail if `spec-library.json` changes without `spec_version` changing.
- Library changes are made by pull request so a second person can review every weight or rating change. Write this in `CONTRIBUTING.md`.

The app loads the library at build time, bundled, so it works offline.

### 7.2 Show file: `*.loadsheet.json`

`fixtures/ballroom.loadsheet.json` is a complete example.

```json
{
  "format": "loadsheet/1",
  "app_version": "0.1.0",
  "spec_version": "2026-10-21",
  "saved_at": "2026-10-21T16:00:00+01:00",
  "job": { "name": "The Ballroom", "date": null, "designer": "",
           "venue": "", "status": "draft", "revision": "",
           "contingency": 0.05, "sheet_date": null },
  "hangs": [{
    "id": "h1", "name": "Main Hang Left", "point_id": "", "over_people": null,
    "hoist_orientation": "body_down", "top_rigging_included": true,
    "point_capacity": { "kg": null, "source": "", "conditions": "", "print": false },
    "zones": {
      "top_rigging": [], "hoist": [], "hook": [],
      "path1": [
        { "note": "Rigging Frame", "item": "L-Acoustics M-BUMP", "length_m": null,
          "qty": 1, "snapshot": { "kg": 25, "per": "each", "swl_kg": 832 } }
      ],
      "path2": []
    }
  }]
}
```

Rules:

- **Snapshots make a show file self-contained.** When an item is added to a row, copy its `kg`, `per` and `swl_kg` into `snapshot`. The engine calculates from the snapshot, never by looking up the library. A show file reopened years later shows exactly what was signed.
- `status` is one of `draft`, `issued`, `approved`, `superseded`.
- `over_people` is `true`, `false` or `null`. Null prints as "– not stated –".
- `format` is versioned. Write a migration function for each future version so old files are upgraded on open, never rejected. Keep a migration test for each version.
- Validate every opened file with Zod. Reject malformed files with a clear, plain-English message saying which field is wrong. Treat every opened file as untrusted. Never `eval` it or render its text as HTML.

---

## 8. Opening, saving and autosave

### 8.1 Three layers

1. **Works everywhere: open and download.** "Open" uses `<input type="file" accept=".json,application/json">`. "Save" downloads the file. This is the only path on Firefox, Safari, iOS and Android, so it must be fully usable.
2. **Save in place: Chrome and Edge desktop.** Use the File System Access API (`showOpenFilePicker`, `showSaveFilePicker`, `FileSystemFileHandle.createWritable`). Save overwrites the opened file and Save As picks a new one. Store recent file handles in IndexedDB and request permission again on reuse. Detect support at runtime and fall back to layer 1. Never user-agent sniff.
3. **Autosave: everywhere.** Write the current show to IndexedDB, debounced to about 1 second after each change. On start, if an autosave exists that is newer than the last explicit save, offer "Restore unsaved changes to <show name>?" with Restore and Discard. The interface must say clearly that autosave is a safety net for this browser only, and that the saved file is the record.

### 8.2 File naming

Default file name: `<Job> - <Hang>.loadsheet.json`, with characters that are illegal in file names removed. Keep `.json` last so phones accept it.

### 8.3 Unsaved changes

Show an unsaved indicator in the header, and warn on `beforeunload` when there are unsaved changes.

### 8.4 Compare on open

When a show is opened, compare each row's snapshot with the current library by item name. If anything differs, show a list, for example:

> **Library changes since this show was saved (spec 2026-10-21 → 2026-11-04)**
> Wire rope sling 10mm 1,280 Kg SWL — weight TBC → 0.50 kg
> L-Acoustics M-BUMP — no change
> Old Shackle X — no longer in library (snapshot kept)

Offer **Update selected** and **Keep as saved**. Nothing changes without the user choosing it. On an approved or superseded show, comparison is information only (see 8.5).

### 8.5 Approval lock

- A show with status `approved` or `superseded` opens **read-only**. Inputs are disabled and a banner explains why.
- **Create new revision** makes an editable copy with status `draft`, the next revision per the scheme the user chose in section 1, and an empty sheet date. Keep the original file untouched and save the copy under a new name.

### 8.6 PWA extras (phase 5)

- `file_handlers` in the manifest, so the installed app opens `.loadsheet.json` files on double-click in Chrome and Edge desktop, through `launchQueue`.
- `share_target` so Android can share a show file into the app.

Both must degrade silently where unsupported.

---

## 9. Interface

Design for a laptop first, and make sure it works one-handed on a phone at 375 px wide. Users may be on site with gloves, in poor light. Use large touch targets, high contrast and no hover-only controls.

### 9.1 Header bar

Show name, unsaved indicator, New, Open, Save, Save As (where supported), Print, and the app and spec versions.

### 9.2 Job panel

Job, Job Date, Designer, Venue, Status (dropdown), Revision, Contingency %.

### 9.3 Hang panel

Sub System (hang name), Point ID / Location, Load over people? (Yes / No / not stated), Top rigging included? (Yes / No), Hoist orientation (Body down / Body up, with a one-line explanation of each).

### 9.4 Zones

Show one card per zone, in order, laid out top-down like the rig. Each card has:

- Zone title, subtotal, and a one-line hint (e.g. "List top-down. Each item carries what is listed below it.")
- Rows with note, item picker, qty, length (only enabled for `per = m` items), line weight, total, SWL and, for rated rows, carried load (+contingency) and `used` with its traffic light
- Add row, delete row, move up, move down. Keyboard drag-and-drop is optional
- An item picker with type-to-search over the library, grouped or filterable by name. 177 items is too many for a plain dropdown

### 9.5 Summary panel

Kept visible on desktop, collapsible on mobile:

- Total static weight
- Connection point: static (unfactored), contingency, design load, point capacity block (capacity, source, conditions, "Print stated capacity on Load Sheet?"), status message
- Capacity table: Top rigging, Hoist, Hook / junction, Path 1, Path 2, each with governing component, SWL, carried load and used
- Governing component, large, with traffic light
- Data check message
- Soft warnings (new, not in the workbook): "Top rigging included? is Yes but the top rigging zone is empty", and "Top rigging included? is No but top rigging items are listed". Warnings only; they do not block anything

### 9.6 Library viewer

A read-only, searchable table of the Spec library showing name, kg, per, SWL, weight note, source and verified. TBC items are highlighted.

### 9.7 Accessibility

Meet WCAG 2.1 AA. Every input has a label, all controls work by keyboard, and traffic lights carry a word as well as a colour.

---

## 10. Print view (the Load Sheet)

This is the formal document. It must fit on **one A4 portrait page** for a hang with up to about 30 rows. Use a print stylesheet (`@page { size: A4 portrait; margin: 10mm; }`) and a dedicated print component. Do not just print the editing screen.

Match the layout of the `Load Sheet` tab in the workbook:

1. Title "FLOWN ARRAY LOAD SHEET" and subtitle "Static load-path analysis – single hang".
2. Header grid: Job, Venue, Sub System, Point ID / Location, Load over people?, Top rigging included? on the left. Status, Revision, Job Date, Designer, Hoist orientation and Sheet Date on the right. Sheet Date is a blank line for handwriting unless the user has filled it in.
3. Item table, grouped by zone with a shaded subtotal row per zone. Columns: Notes, Item, Qty, Length (m), Weight, SWL/WLL, Carried load (+N%), Used. Include empty ruled rows so pencilled additions are possible on site.
4. TOTAL STATIC WEIGHT.
5. **Connection point:** "Static load – UNFACTORED (figure for structural assessment / approval)", contingency, "DESIGN LOAD AT POINT (rigging capacity check)". Then "Point capacity:", which is either "Design load submitted for approval by the venue / structural engineer." or, **only if** a capacity is entered and "print" is true: "Stated 1,000 kg – 46.7% used. Source: … Conditions: …". If no source was given, show "Source: NOT STATED".
6. **Capacity summary table** (equipment zones only), then the governing component with its traffic light.
7. Data check line, then the top rigging statement (red when not included), then the hoist orientation statement:
   - Top rigging Yes: "Included – components above the hoist are listed in the top rigging zone and checked."
   - Top rigging No: "NOT INCLUDED – components above the hoist are not listed and not checked."
   - Body down: "Body down – hoist checked against its own weight, chain, bag and cables plus the hook load."
   - Body up: "Body up – hoist checked against the hook load; its own weight, chain and cables hang on the top rigging."
8. **Small print**, verbatim. TOP RIGGING and MULTI-POINT headings are red; the others are grey.

   **SCOPE** — Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed.

   **ARRAY FRAMES** — Frame and bumper SWL is checked as a simple vertical load. Array mechanical limits (box count, tilt, pick-up point) must be verified in the manufacturer's software (e.g. Soundvision).

   **TOP RIGGING** — Unless stated as included above, components above the hoist – beam clamps, steels, slings to structure and the structure itself – are NOT listed and NOT checked. The head rigger must verify the complete load path above the hoist.

   **MULTI-POINT** — Where an array is flown from 2 or 3 points, DO NOT assume each point carries a proportional share of the load. During build, breakout, trimming and levelling – and if an adjacent point fails – a single point may carry up to 100% of the total array weight. Each point must be rated for the full array load unless a competent person has assessed otherwise.

   **DATA** — Weights and SWL/WLL figures are taken from the Spec library in this workbook and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked.

   **LOADS** — Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg.

   In DATA, "in this workbook" refers to the spreadsheet. **Ask the user** whether to change it to "in this app" before shipping. Do not change it yourself.

9. Signature block: Prepared by / Signature / Date, then Checked by / Signature / Date.
10. **Footer on every print:** app version, spec version, file name and print date and time, e.g. `Load Sheet app 0.3.0 · Spec 2026-10-21 · The Ballroom - Main Hang Left.loadsheet.json · Printed 21/10/2026 16:02`. This makes every printout traceable to the exact code and data that produced it.
11. If status is `draft`, print a faint diagonal "DRAFT" watermark.

Print colours must survive black-and-white printing: traffic-light cells also carry the word, and the red headings are also bold.

`DISCLAIMER.md` and the README should carry the same SCOPE, DATA and LOADS text, plus: "This software is provided as-is, without warranty. It is a calculation aid and does not replace assessment by a competent person."

---

## 11. Offline and installability

- Use `vite-plugin-pwa` to precache the app shell and the bundled library. After the first visit, the app works with no network.
- Provide a web manifest with name, icons (192 and 512 px, maskable), theme colour and `display: standalone`.
- When a new version is deployed, show "Update available – reload" rather than updating mid-edit.

## 12. Security and privacy

- Add a strict Content Security Policy meta tag: `default-src 'self'`, no inline scripts, no third-party origins.
- No external fonts or CDNs. Self-host everything.
- Render all text from files as text, never as HTML.
- Never send file contents anywhere.

---

## 13. Testing and CI

### 13.1 Engine tests (most important)

- `calculate.test.ts` loads `fixtures/scenarios.json` and, for each scenario, builds rows with snapshots from `data/spec-library.json` (applying any `spec_override`), runs `calculate`, and asserts every field in `expected`. Compare utilisations to 4 decimal places and weights to 3.
- The nine scenarios are:

| ID | Scenario | Governs | Used |
|---|---|---|---|
| A | Ballroom baseline, body down | D8 LL hoist | 46.7% |
| B | Body up | M-BAR | 41.1% |
| C1 | 16 boxes | D8 LL hoist | 57.6% |
| C2 | 30 boxes (stress test) | M-BUMP | 98.4% |
| C3 | 31 boxes (stress test) | M-BUMP | 101.7% |
| D | Two identical 822 kg steels, body up (tie) | 8 mm steel, +1 other | 45.6% |
| E | Point 500 kg, no source | D8 LL hoist (point `no_source`, 93.4%) | 46.7% |
| F | Point 1,000 kg with source | D8 LL hoist (point `recorded`) | 46.7% |
| G | Steel weight filled in | D8 LL hoist, data check OK | 46.7% |

- Scenarios A–F have `data_ok: false` because the steel's weight is TBC. That is correct and must be asserted.
- Add unit tests for: per-m with no length (LEN?), qty 0, empty zones, note-only rows, a missing library item, contingency 0, and rounding staying out of the engine.
- Add a property test: increasing the qty of any row never decreases any `used` value.
- If the TypeScript engine and `engine_reference.py` ever disagree, the test fails. Never edit `expected` values to make a test pass. Raise it with the user.

### 13.2 Other tests

- Schema: valid fixture passes, and each kind of malformed file is rejected with a clear message.
- Migration: one test per format version.
- File round-trip: open, edit, save, reopen gives identical results.
- Compare-on-open: detects changed weight, changed SWL, and an item removed from the library.
- Approval lock: approved files open read-only; a new revision is editable.
- Playwright: load the Ballroom fixture, check the summary shows 46.7% and the hoist as governing, switch to body up and check the M-BAR governs at 41.1%, then print to PDF and assert **exactly one page**.

### 13.3 CI (`.github/workflows/ci.yml`, on every push and pull request)

Typecheck, lint, unit tests, Playwright, Spec library validation (unique names, valid `per`, non-negative numbers, `spec_version` bumped when the library changes), and a build.

### 13.4 Deploy (`.github/workflows/deploy.yml`, on push to `main`)

Build and publish to GitHub Pages using the official `actions/deploy-pages` workflow. Set the Vite `base` to the repo name.

---

## 14. Phases

Stop for review at the end of each phase.

### Phase 1 — Engine and tests
Scaffold the repo, set up TypeScript, the Spec library types and Zod schemas, `calculate()`, and all engine tests from section 13.1. Add CI running typecheck and tests.

**Done when:** all nine scenarios pass, the extra unit and property tests pass, and CI is green. No UI yet.

### Phase 2 — Editing interface
Job, hang, zones and summary panels as in section 9, wired to the engine. Item picker with search. Row reorder. Traffic lights with words. Soft warnings. Loads `fixtures/ballroom.loadsheet.json` from a "Load example" button.

**Done when:** the Ballroom example matches the workbook on screen and is usable at 375 px wide.

### Phase 3 — Files
Layer 1 open and download, layer 3 autosave and restore, schema validation on open, unsaved indicator, compare-on-open, approval lock and new revision.

**Done when:** a show can be created, saved, closed, reopened and revised on Firefox and on a phone, and all file tests pass.

### Phase 4 — Print and deploy
Print view per section 10, the one-page Playwright test, version footer, DRAFT watermark, and the GitHub Pages deploy workflow.

**Done when:** the live site prints the Ballroom Load Sheet on one A4 page and the user has compared it against the workbook printout.

### Phase 5 — Desktop polish and offline
Layer 2 save-in-place, recent files, PWA install and offline, update prompt, `file_handlers`, `share_target`.

**Done when:** the installed app works with no network, and double-clicking a show file opens it on Chrome or Edge desktop.

### Later, ask first
Excel export of the Load Sheet; an "open folder" show browser; custom one-off items in a show file that aren't in the library (they would need a clear "custom – not from library" mark on the print); multiple hangs per job in the interface.

---

## 15. Deliberate differences from the workbook

These are intended. List any further ones in the pull request.

- The engine reads values from row snapshots instead of looking items up by name. Results are identical.
- Traffic lights carry words (OK / CHECK / OVER) as well as colour.
- Soft warnings for a mismatch between the top rigging flag and the top rigging zone.
- The print footer shows app version, spec version, file name and print time.
- DRAFT watermark.
- Approved and superseded shows are locked.

## 16. Glossary

- **SWL / WLL** — safe or working load limit in kg, as stored in the library.
- **Body down** — the hoist hangs from the load and climbs its chain, which is usual for touring. **Body up** — the hoist is fixed at the top and the chain hangs down.
- **Carried load** — the weight a component supports: everything below it in the load path.
- **Contingency** — a percentage added for unlisted items and measurement error. It is not a safety factor.
- **TBC** — weight not yet recorded in the library.
- **Governing component** — the rated item with the highest utilisation.
