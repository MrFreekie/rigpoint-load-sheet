# RigPoint Load Sheet

Work out the load on a flown loudspeaker hang and print a Load Sheet for it, on a laptop or a phone.

**Open the app:** https://mrfreekie.github.io/rigpoint-load-sheet/

There is nothing to sign up for. Everything runs on your own device, and your show files never leave it unless you move them.

## What it does

You list everything on one hang, from the connection point down: top rigging, hoist, hook or junction, the array, and the cables. The app then:

- checks every rated item (hoists, shackles, bumpers, slings) against the weight it carries, plus a contingency (5% unless you change it)
- names the **governing component**, the item working hardest, with a green OK, amber CHECK or red OVER
- gives the **static load at the point**, unfactored, for the venue or structural engineer
- flags any item with a missing weight, so you know when the total is too low
- prints a one-page A4 **Load Sheet** with signature boxes

All weights are in kilograms. Ratings are used exactly as the manufacturer states them, with no extra factors.

## Getting started

1. Open https://mrfreekie.github.io/rigpoint-load-sheet/
2. Press **Load example** to see a finished hang (the Ballroom main hang).
3. Press **New** to start your own.
4. Fill in the job and hang details, then add the items zone by zone, top-down.
5. Press **Save** to keep the show as a file, and **Print** for the Load Sheet.

The **[user guide](docs/user-guide.md)** explains each step, how to read the results, and what the warnings mean.

## Install it, and use it with no signal

In Chrome or Edge, click the install icon at the end of the address bar and choose **Install**. On Android, use **Add to home screen**; on iPhone, Share, then **Add to Home Screen**.

Once you have opened the app once, it works offline, installed or not. On a computer with the app installed:

- **Save** updates the same file each time, after the first **Save As**.
- **Recent** reopens the show files you used last.
- Double-click a show file to open it in the app.

On Android you can share a show file from email or chat straight into the app.

When there is a new version, the app shows **Update available – reload**. Press **Reload** when it suits you; unsaved changes are kept and offered back.

The user guide has the full steps for [installing](docs/user-guide.md#installing-the-app-and-working-offline) and [updates](docs/user-guide.md#updates).

## Show files

Each show is saved as a file such as `The Ballroom - Main Hang Left.loadsheet.json`. That file is the record. Keep it in a folder that your Dropbox, OneDrive or Google Drive already syncs if you want a backup.

- **Autosave** keeps your unsaved changes in the browser, in case it closes. It is a safety net, not a backup.
- **Approved** and **Superseded** shows open read-only. **Create new revision** makes an editable copy (Rev A, Rev B and so on) in a new file, and leaves the original alone.
- When you open an older show, the app tells you if any weights or ratings in the equipment list have changed since. Nothing changes unless you choose it.

## Missing equipment

Every weight and rating comes from the built-in equipment list, which you can browse with **Library**. If something is missing or a figure looks wrong, send the manufacturer's data sheet or certificate to whoever looks after the app. Each change is checked by a second person before it goes in; see [CONTRIBUTING.md](CONTRIBUTING.md).

## For developers

Setup, commands, tests and how releases work are in [docs/development.md](docs/development.md). `BRIEF.md` is the full specification.

## Disclaimer

This software is provided as-is, without warranty. It is a calculation aid and does not replace assessment by a competent person.

**SCOPE** — Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed.

**DATA** — Weights and SWL/WLL figures are taken from the Spec library in this app and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked.

**LOADS** — Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg.

## Licence

MIT, see `LICENCE`.
