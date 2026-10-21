# Load Sheet app – brief pack for Claude Code

## What's in here

| File | What it is |
|---|---|
| `BRIEF.md` | The full build instructions for Claude Code |
| `data/spec-library.json` | Your Spec library from v6 of the workbook: 177 items, 27 TBC, 73 rated |
| `fixtures/scenarios.json` | Nine test cases, with results taken from the recalculated spreadsheet |
| `fixtures/ballroom.loadsheet.json` | The Ballroom hang as a sample show file |
| `reference/The_Ballroom_Array_Weights_v6.xlsx` | The workbook, which is the specification |
| `reference/engine_reference.py` | The calculation in plain Python. It passes all nine scenarios |

To check the reference engine yourself:

```
cd reference
python3 engine_reference.py ../fixtures/scenarios.json ../data/spec-library.json
```

## How to start

1. Create an empty folder for the project and copy this whole pack into it.
2. Open Claude Code in that folder.
3. Paste this prompt:

> Read BRIEF.md in full, then the files it refers to. Before writing any code, ask me the questions in section 1. Then do phase 1 only, and stop for my review when it's done.

Claude Code will ask you four things before it starts: the app name, public or private repo, licence, and revision scheme. It will stop after each phase so you can check the work before it moves on.

## Before you send it

- **Steel weight.** The 10 mm 1,280 kg wire rope is still TBC, so the data check shows red in most scenarios. That's intended. Scenario G shows it clearing once a weight is added (0.5 kg is a placeholder, not a real figure).
- **"In this workbook".** The DATA small print still says "in this workbook". The brief tells Claude Code to ask you whether to change it to "in this app", not to change it on its own.
