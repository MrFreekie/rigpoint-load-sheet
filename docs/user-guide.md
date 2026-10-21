# User guide

RigPoint Load Sheet works out the load on one flown loudspeaker hang and prints a signed Load Sheet for it. It does the same job as the Ballroom Array Weights spreadsheet, and gives the same answers.

Open it at **https://mrfreekie.github.io/rigpoint-load-sheet/**

Everything happens on your own device. Nothing is sent anywhere, there is no account to make, and your show files stay where you save them.

## Contents

1. [The idea in one minute](#the-idea-in-one-minute)
2. [Your first Load Sheet](#your-first-load-sheet)
3. [Filling in the job and the hang](#filling-in-the-job-and-the-hang)
4. [Building the hang, zone by zone](#building-the-hang-zone-by-zone)
5. [Reading the results](#reading-the-results)
6. [Saving and opening shows](#saving-and-opening-shows)
7. [Issuing, approving and revising](#issuing-approving-and-revising)
8. [Printing the Load Sheet](#printing-the-load-sheet)
9. [Installing the app and working offline](#installing-the-app-and-working-offline)
10. [Updates](#updates)
11. [Using it on a phone](#using-it-on-a-phone)
12. [Equipment that is not in the list](#equipment-that-is-not-in-the-list)
13. [Problems and questions](#problems-and-questions)
14. [Words used in the app](#words-used-in-the-app)

## The idea in one minute

You list everything on the hang, from the connection point down, and the app checks every rated item against the weight hanging below it.

The hang is split into five zones, always in this order, top to bottom:

| Zone | What goes in it |
|---|---|
| Top rigging | Everything above the hoist: steels, beam clamps, slings to the structure |
| Hoist | The hoist body, chain, chain bag, and hoist power and control cables |
| Hook / junction | Below the hoist hook, feeding both paths: shackles, master link |
| Load path 1 (array) | Array frames, then the boxes. For example M-BAR, then M-BUMP, then the cabinets |
| Load path 2 (cables) | Cable pick sling, multicores, splits. These hang from the junction, not from the array frame |

Inside each zone, list items **top-down**. The order matters, because each rated item is checked against what hangs below it:

- an item in the top rigging carries the rows below it, plus every other zone
- the hoist carries the hook zone and both load paths, and with body down it also carries the whole hoist zone, its own weight included
- an item in the hook / junction carries the rows below it, plus both load paths
- an item in a load path carries only the rows below it in that same path

The app adds a contingency (5% unless you change it) for unlisted bits and measurement error. It is not a safety factor. SWL and WLL figures are used exactly as the manufacturer states them.

Everything is in kilograms.

## Your first Load Sheet

The quickest way to learn it is to look at a finished example.

1. Open the app and press **Load example**. This loads the Ballroom main hang.
2. Scroll down through the zone cards and see how the rows are listed top-down.
3. Look at the **Summary** panel. The governing component is the D8 LL hoist at 46.7%.
4. Change **Hoist orientation** to **Body up**. The M-BAR now governs at 41.1%.
5. Press **New** when you are done, to start your own show.

To make your own:

1. Press **New**.
2. Fill in the **Job** panel (job name, venue, designer and so on).
3. Fill in the **Hang** panel (the hang's name, its point, the hoist orientation).
4. In each zone, press **+ Add row** and pick items from the list.
5. Check the **Summary** panel.
6. Press **Save** to keep it as a file.
7. Press **Print** to make the Load Sheet.

## Filling in the job and the hang

### Job

| Field | What to put |
|---|---|
| Job | The show or job name |
| Job Date | The show date |
| Designer | Who designed the system |
| Venue | Where it is |
| Status | Draft, Issued, Approved or Superseded. See [Issuing, approving and revising](#issuing-approving-and-revising) |
| Revision | Leave blank for the first issue. The app fills it in (A, B, C) when you make a new revision |
| Sheet Date | The date on the printed sheet. Leave it blank to print a line you can write on |
| Contingency | 5% unless you have a reason to change it. It covers unlisted items and measurement error, and is not a safety factor |

If you set the contingency to 0%, the app shows a warning. It is allowed, but it should be a deliberate choice.

### Hang

| Field | What to put |
|---|---|
| Sub System | The name of this hang, for example "Main Hang Left" |
| Point ID / Location | The rigging point or its position |
| Load over people? | Yes, No, or leave it as not stated |
| Top rigging included? | Yes if you are listing the items above the hoist, No if you are not |
| Hoist orientation | Body down or Body up (see below) |

**Body down** means the hoist hangs from the load and climbs its chain. This is the usual touring setup and the default. The hoist is then checked against its own weight, chain, bag and cables, plus everything below the hook.

**Body up** means the hoist is fixed at the top and the chain hangs down to the load. The hoist is then checked against the load below the hook only. Its own weight, chain and cables hang on the top rigging instead.

If you set **Top rigging included?** to **No**, the Load Sheet says in red that the components above the hoist are not listed and not checked. The head rigger then has to check that part of the load path separately.

## Building the hang, zone by zone

Each zone has its own card with a short reminder of what belongs in it.

### Adding a row

1. Press **+ Add row** at the bottom of the zone card.
2. Click in the **Item** box and start typing, for example `kara` or `shackle`. Pick the item from the list.
3. Enter the **Qty**.
4. If the item is sold by the metre (cable, chain, sling), enter the **Length** in metres. The length box only switches on for these items.

You can also type a **Note** on a row, such as "Rigging Frame". A row can have a note and no item: it weighs nothing, but it shows on the print. This is useful for something you know is there but have no weight for yet.

### Changing the order

Use the ↑ and ↓ buttons on a row to move it. Order matters: an item carries only what is listed below it. Put the M-BUMP above the cabinets, not below them.

Delete a row with the ✕ button.

### What each row shows

- **Line weight**: the weight of one of that item (or its weight for the length you entered).
- **Total**: line weight times quantity.
- **SWL / WLL**: the item's rating, if it has one.
- For rated items: the **carried load** (including contingency), the **used** percentage, and a traffic light.

Items without a rating (cabinets, cable) add weight but are not checked themselves.

### Flags on a row

| Flag | What it means | What to do |
|---|---|---|
| ⚠ TBC | The library has no weight for this item yet | The row is left out of the totals. Ask for the weight to be added to the library, or use a different item |
| ⚠ LEN? | The item is sold by the metre and has no length | Enter the length |
| ⚠ NOT FOUND | There is no weight data for the item | The row is left out of the totals. Check the item |

While any row has one of these flags, the Summary says **MISSING DATA – total understated**, and so does the printed sheet. Your real load is higher than the figures shown.

## Reading the results

The **Summary** panel sits beside the zones on a laptop. On a phone it is at the bottom, and **Hide details** folds it away.

### Traffic lights

Every rated item gets a percentage and a light. The word is always shown with the colour, so it still reads in poor light or on a black-and-white print.

| Used | Light | Word |
|---|---|---|
| Under 85% | Green | OK |
| 85% to 100% | Amber | CHECK |
| Over 100% | Red | OVER |

### Governing component

This is the rated item that is working hardest, with the highest percentage used. It is not always the one with the lowest rating: a small bumper carrying a lot can govern over a big hoist carrying a little.

If two items share the top percentage, the app names the first and adds "(+1 other at the same utilisation)".

When an item has a quantity above 1, or several rated items share a zone, **each one is checked against the full load**. The app never shares the load between them. This is deliberately cautious.

### Capacity summary

This table shows the hardest-working item in each zone, with its rating, carried load and percentage used.

### Connection point

- **Static load (UNFACTORED)** is the total weight with no contingency. This is the figure to give a structural engineer or the venue.
- **Design load at point** is the static load plus contingency. It is used for checking the rigging.

If the venue has given you a capacity for the point, enter it under **Stated point capacity**, with where the figure came from (**Source of figure**) and any conditions. The app then tells you one of:

- No capacity entered: the design load goes to the venue or structural engineer for approval.
- A capacity with no source: a warning to say where the figure came from before relying on it.
- The design load is more than the stated capacity: a warning.
- Otherwise: the capacity is recorded, to be confirmed by the venue or structural engineer.

Set **Print stated capacity on Load Sheet?** to Yes if you want it on the print.

The point is checked separately and never counts as the governing component.

### Warnings

The app also warns you about things that look like mistakes, but does not stop you:

- **Top rigging included?** is Yes, but the top rigging zone is empty.
- **Top rigging included?** is No, but there are items in the top rigging zone.
- The contingency is 0%.

## Saving and opening shows

A show is saved as a file named after the job and the hang, for example `The Ballroom - Main Hang Left.loadsheet.json`. A ` - Rev A` is added once it has a revision. That file is your record. Keep it somewhere safe: a folder that your Dropbox, OneDrive or Google Drive already syncs is a good place.

The header shows **● Unsaved changes** while you have changes that are not in a file yet. The app also warns you if you try to close the page with unsaved changes.

### In Chrome or Edge on a computer

- **Save As** asks where to save the file. After that, **Save** updates that same file each time.
- **Open** lets you pick a show file. Saving then updates the file you opened.
- **Recent** lists the last few show files you used, so you can reopen one in a click. The browser may ask you to allow access to the file again. Say yes.

### In other browsers and on phones

- **Save** downloads a copy of the file, usually into your Downloads folder. Move it somewhere safe. Each save makes a new download.
- **Open** lets you pick a show file.

### Autosave

While you work, the app keeps a copy of your unsaved changes in the browser. If the browser closes or the computer restarts, the app offers to restore them next time:

> Restore unsaved changes to *show name*?

Choose **Restore** to get them back, or **Discard** to throw them away.

Autosave is a safety net for that one browser on that one device. It is not a backup, and it disappears if you clear your browsing data. Always save to a file. In a private or incognito window, autosave may not work at all, and the app tells you so.

### When the equipment list has changed

When you open a show, the app compares every item with the current equipment list. If a weight or a rating has changed since the show was saved, or an item has been removed, it shows you a list.

- **Update selected** updates the items you tick to today's figures.
- **Keep as saved** leaves the show exactly as it was.

Nothing changes unless you choose it. Every show file keeps its own copy of the figures it was made with, so an old show reopened years later shows exactly what was signed.

## Issuing, approving and revising

Use **Status** to show where the sheet is in its life:

| Status | Meaning |
|---|---|
| Draft | Still being worked on. The print carries a faint DRAFT watermark |
| Issued | Sent out |
| Approved | Signed off. The show becomes read-only |
| Superseded | Replaced by a later revision. Read-only |

An **Approved** or **Superseded** show opens read-only, with a banner explaining why. You cannot change it by accident.

To change an approved show, press **Create new revision**. The app makes an editable draft copy with the next revision letter (blank, then A, then B, and so on) and a blank sheet date. Save it, and it goes into a new file with the revision in its name. The original approved file is never touched.

## Printing the Load Sheet

Press **Print**. The app lays out the Load Sheet on one A4 portrait page, in the same layout as the spreadsheet's Load Sheet tab:

- the job and hang details
- every item, grouped by zone, with spare ruled lines for pencilled additions on site
- the total static weight and the connection point figures
- the capacity summary and the governing component
- the data check, top rigging and hoist statements
- the small print
- spaces for Prepared by and Checked by, with signatures and dates

In the print window, choose A4 and portrait. To make a PDF to email, choose **Save as PDF** (or **Microsoft Print to PDF**) as the printer.

The footer of every sheet shows the app version, the equipment list version, the file name and the time it was printed. If you print with unsaved changes, the footer says so. That way anyone can tell exactly which file and figures a printout came from. Save before you print a sheet you plan to sign.

## Installing the app and working offline

You can install the app so it opens in its own window, like any other program, and works with no internet. This is handy on site.

### On a Windows or Mac computer (Chrome or Edge)

1. Open https://mrfreekie.github.io/rigpoint-load-sheet/
2. Click the install icon at the right-hand end of the address bar (a small screen with a down arrow) and choose **Install**.
   - If you cannot see it in Chrome, open the ⋮ menu, then **Cast, save and share**, then **Install page as app**.
   - In Edge, open the ⋯ menu, then **Apps**, then **Install this site as an app**.
3. The app opens in its own window and appears in your Start menu or Applications folder.

Once installed, you can **double-click a show file** to open it in the app. If Windows opens it in something else, right-click the file, choose **Open with**, and pick **RigPoint Load Sheet**.

### On an Android phone (Chrome)

Open the site, then the ⋮ menu, then **Add to home screen** or **Install app**.

Once installed, you can open a show file from email, WhatsApp or a file manager: tap **Share** on the file and choose **Load Sheet** from the list of apps.

### On an iPhone or iPad (Safari)

Open the site, tap the Share button, then **Add to Home Screen**.

### Offline

After you have opened the app once, it and the whole equipment list are stored on your device. It then works with no signal, whether you installed it or not. The first time, it says "Ready to work offline".

## Updates

You do not need to do anything to get updates.

1. When a new version is ready, a banner appears at the top: **Update available – reload**.
2. Carry on with what you are doing. The app never changes in the middle of your work.
3. Press **Reload** when it suits you. If you have unsaved changes, it asks first. They are kept by autosave and offered back straight after the reload: press **Restore**.

If you ignore the banner, the new version is used the next time you fully close and reopen the app.

The app and equipment list versions are shown in small type at the top of the screen, under the buttons, and on the footer of every print.

## Using it on a phone

The app works on a phone down to an iPhone SE screen size. The buttons are large enough to use with gloves.

- The zone cards stack one above the other, in rig order.
- The Summary panel is at the bottom. **Hide details** folds it away to save space.
- **Save** downloads the file. On iPhone, choose where to keep it in Files.
- **Print** uses the phone's own print or PDF option.

## Equipment that is not in the list

You cannot add your own one-off items in the app. Every weight and rating comes from the equipment list (the Spec library), so that each figure has been checked by a second person. Press **Library** to see the full list, with weights, ratings, and notes on where each figure came from. Items with no recorded weight are highlighted as TBC.

If something you need is missing, or a figure looks wrong, tell the person who looks after the app. Send them the manufacturer's data sheet or certificate, or your own measurement. Once it has been checked and added, everyone gets it with the next update.

Until then, you can add a row with just a **Note** and no item so that it at least shows on the print. Remember that it adds no weight.

## Problems and questions

**My total looks too low.**
Look for ⚠ TBC, ⚠ LEN? or ⚠ NOT FOUND flags on the rows. Those rows are left out of the total until they are fixed. The Summary says MISSING DATA while any are left.

**The length box will not let me type.**
It only works for items sold by the metre. For everything else, use Qty.

**I cannot edit anything.**
The show is Approved or Superseded, so it is read-only. Press **Create new revision** to make an editable copy.

**I pressed Save but cannot find the file.**
In browsers other than Chrome and Edge on a computer, Save downloads the file. Look in your Downloads folder, then move it somewhere safe.

**I closed the page without saving.**
Open the app again in the same browser. It should offer to restore your unsaved changes.

**The app will not open a file.**
It only opens show files saved by this app. If a file is damaged or is a different kind of file, the app tells you what is wrong with it and changes nothing.

**I do not see the Update banner, but I was told there is a new version.**
Close the app completely and open it again.

**The printout runs onto two pages.**
Check the print window is set to A4, portrait and no extra scaling.

## Words used in the app

| Word | Meaning |
|---|---|
| SWL / WLL | Safe or working load limit, in kg, as the manufacturer states it |
| Carried load | The weight an item holds up: everything below it in the load path, plus contingency |
| Used | Carried load divided by the SWL, as a percentage |
| Governing component | The rated item with the highest percentage used |
| Contingency | A percentage added for unlisted items and measurement error. Not a safety factor |
| Static load (unfactored) | The total weight at the point with nothing added. The figure for structural engineers |
| Design load | The static load plus contingency |
| Body down / Body up | Whether the hoist climbs its chain with the load (body down) or is fixed at the top (body up) |
| TBC | No weight recorded in the equipment list yet |
| Spec library | The equipment list the app takes every weight and rating from |

## What the app does not check

The app checks one hang, as a list of static weights. It does not assess bridle geometry, sling angles, how load shares between points, the venue structure, or dynamic and shock loads. The full wording is in the small print on every Load Sheet and in [DISCLAIMER.md](../DISCLAIMER.md).

It is a calculation aid. It does not replace assessment by a competent person.
