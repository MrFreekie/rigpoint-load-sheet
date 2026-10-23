# RigPoint Load Sheet – working notes for Claude

A static web app that calculates and documents the load on one flown loudspeaker hang. People use its output to decide whether a rig is within limits: **correctness, and honesty about what is and is not checked, come before features or polish.**

Read `docs/development.md` (ground rules, commands, layout, releasing) before changing anything. `docs/user-guide.md` describes the app for riggers. `CONTRIBUTING.md` covers the equipment list.

## Rules that are never broken

- UK English everywhere. Kilograms only. No dynamic, derating or safety factors; the contingency is the only adjustment.
- Never invent equipment data (weights, SWLs, sources). Ask the owner.
- `src/engine/` stays pure (enforced by ESLint). UI and print display engine results and compute nothing.
- Never edit expected values in `fixtures/scenarios.json`. If the engine and the reference disagree, stop and tell the owner.
- The scenarios and the Python reference use the frozen `fixtures/spec-library.workbook.json`, not the live library. Do not change it.
- Small print (`src/print/small-print.ts`, `DISCLAIMER.md`, `README.md`) is fixed text agreed with the owner.
- No server, accounts, tracking or third-party network calls. Do not loosen the Content Security Policy in `vite.config.ts`.
- Never put a real person's name in examples or fixtures.
- All work goes on a branch with a pull request. **Merging to `main` is the release** (it deploys). Only merge when the owner says so.
- Library changes are reviewed by a second person; `spec_version` must move forward on every commit that changes `data/spec-library.json` (`yyyy-mm-dd`, then `.2`, `.3` the same day).
- Licence: CC BY-NC 4.0. Commit messages end with the `Co-Authored-By` line the session gives you.

## The team

Subagents live in `.claude/agents/`; use the one that fits rather than doing everything in the main session.

| Agent | Model / effort | Use for |
|---|---|---|
| `engine-guardian` | Opus / high | Anything touching the calculation, schemas, scenarios or the reference engine |
| `library-steward` | Sonnet / medium | Adding or changing equipment in `data/spec-library.json` |
| `ui-developer` | Sonnet / high | Interface, print view, files, offline/PWA, styles |
| `qa-runner` | Haiku / medium | Running the full checks (unit, reference, e2e, live site) and reporting results |
| `reviewer` | Opus / high | Read-only review of a branch against these rules before a PR is merged |
| `docs-writer` | Sonnet / low | README, user guide, developer guide, CONTRIBUTING, PR descriptions |

Skills in `.claude/skills/`: `library-change`, `verify-change`, `ship-change`.

## Lessons already learned

- Windows: use `python` (not `python3`) locally; Playwright's Firefox may not start on Windows, so CI on Linux covers it.
- Hide the File System Access API in tests of the download path (`start(page)` in `e2e/helpers.ts` does this by default).
- The app's CSP blocks form posts, so tests simulate an Android share with `fetch`.
- A one-page PDF can still be clipped; the print tests also check the footer is inside the page.
- WebKit on Linux replaces spaces with underscores in download names.
- Python 3.12+ `sum()` is compensated; compare with the reference to 1e-12 relative, not bit for bit.
- The bundled Ballroom example was saved with the workbook library; it opens as saved, without the library-changes list.
