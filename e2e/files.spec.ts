// Phase 3: a show can be created, saved, closed, reopened and revised, in every browser.

import { expect, test } from '@playwright/test';
import { ballroom, governing, librarySpecVersion, openFile, pickItem, save, savedName, start } from './helpers';

test('create, save, close, reopen and revise a show', async ({ page }) => {
  test.slow(); // many steps; the emulated phone times out under a full parallel run
  await start(page);

  // Create.
  await page.getByRole('textbox', { name: 'Job', exact: true }).fill('Test Job');
  await page.getByLabel('Sub System').fill('Hang A');
  await page.getByRole('button', { name: 'Add row to Load path 1 – array' }).click();
  await pickItem(page, 'Load path 1 – array row 1', 'm-bump', /^L-Acoustics M-BUMP/);
  await page.getByRole('button', { name: 'Add row to Load path 1 – array' }).click();
  await pickItem(page, 'Load path 1 – array row 2', 'kara ii', /^L-Acoustics KARA II/);
  await page.getByLabel('Qty, Load path 1 – array row 2').fill('12');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await expect(governing(page)).toContainText('L-Acoustics M-BUMP');
  await expect(governing(page)).toContainText('39.4%');

  // Save.
  const first = await save(page);
  expect(savedName(first.download)).toBe('Test Job - Hang A.loadsheet.json');
  expect(first.json.format).toBe('loadsheet/1');
  expect(first.json.job).toMatchObject({ name: 'Test Job', status: 'draft', revision: '' });
  expect(first.text).not.toContain('"key"');
  await expect(page.getByText('Saved · Test Job - Hang A.loadsheet.json')).toBeVisible();
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

  // Close: a download cannot be confirmed, so the autosave copy is still offered; discard it.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText(/Restore unsaved changes/)).toHaveCount(0);
  await expect(page.locator('.show-title')).toHaveText('Untitled show');

  // Reopen.
  await openFile(page, 'Test Job - Hang A.loadsheet.json', first.text);
  await expect(page.locator('.show-title')).toHaveText('Test Job – Hang A');
  await expect(governing(page)).toContainText('39.4%');
  await expect(page.getByRole('combobox', { name: 'Item, Load path 1 – array row 2' })).toHaveValue('L-Acoustics KARA II');
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

  // Approve and save; reopening it is read-only.
  await page.getByLabel('Status').selectOption('approved');
  const approved = await save(page);
  expect(approved.json.job).toMatchObject({ status: 'approved' });
  await page.reload();
  await openFile(page, 'Test Job - Hang A.loadsheet.json', approved.text);
  await expect(page.getByRole('heading', { name: 'Read-only: this show is Approved' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Job', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Qty, Load path 1 – array row 2')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  // New revision: editable draft, revision A, saved under a new name.
  await page.getByRole('button', { name: 'Create new revision' }).click();
  await expect(page.getByRole('heading', { name: /Read-only/ })).toHaveCount(0);
  await expect(page.getByLabel('Revision')).toHaveValue('A');
  await expect(page.getByLabel('Status')).toHaveValue('draft');
  await page.getByLabel('Qty, Load path 1 – array row 2').fill('16');
  await expect(governing(page)).toContainText('52.5%');
  const revA = await save(page);
  expect(savedName(revA.download)).toBe('Test Job - Hang A - Rev A.loadsheet.json');
  expect(revA.json.job).toMatchObject({ status: 'draft', revision: 'A', sheet_date: null });
});

test('autosave offers to restore unsaved changes after the page is closed', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Autosave test');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await page.waitForTimeout(1500); // autosave runs about 1 s after the last change

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' })).toBeVisible();
  await expect(page.getByText(/safety net in this browser only/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Autosave test');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  // Discard removes the copy for good.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.show-title')).toHaveText('Untitled show');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.getByText(/Restore unsaved changes/)).toHaveCount(0);
});

test('compare on open lists library changes and changes nothing unless chosen', async ({ page }) => {
  await start(page);
  const old = structuredClone(ballroom);
  old.spec_version = '2026-01-01';
  old.hangs[0]!.zones.path1![1]!.snapshot = { kg: 24, per: 'each', swl_kg: 832 }; // M-BUMP, now 25 kg
  old.hangs[0]!.zones.hook![1]!.item = 'Old Shackle X'; // no longer in the library
  const text = JSON.stringify(old);

  await openFile(page, 'old.loadsheet.json', text);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText(`Library changes since this show was saved (spec 2026-01-01 → ${librarySpecVersion})`);
  await expect(dialog).toContainText('L-Acoustics M-BUMP — weight 24 kg → 25 kg');
  await expect(dialog).toContainText('Old Shackle X — no longer in library (snapshot kept)');
  await expect(dialog).toContainText('L-Acoustics M-BAR — no change');

  await dialog.getByRole('button', { name: 'Keep as saved' }).click();
  await expect(page.locator('.total-static')).toContainText('443.66 kg');
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

  await openFile(page, 'old.loadsheet.json', text);
  await page.getByRole('dialog').getByRole('button', { name: /Update selected/ }).click();
  await expect(page.locator('.total-static')).toContainText('444.66 kg');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  // The removed item keeps its snapshot and is marked.
  await expect(page.getByText('not in current library')).toBeVisible();
});

test('a malformed file is rejected with a clear message and nothing changes', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  const bad = structuredClone(ballroom);
  (bad.job as Record<string, unknown>).contingency = '5%';
  await openFile(page, 'bad.loadsheet.json', JSON.stringify(bad));
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('Could not open bad.loadsheet.json');
  await expect(dialog).toContainText('Job, Contingency: Contingency must be a number');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.show-title')).toHaveText('The Ballroom – Main Hang Left');

  await openFile(page, 'notes.json', 'not json at all');
  await expect(page.getByRole('dialog')).toContainText('The file is not valid JSON, so it cannot be a show file.');
});

test('the Ballroom example matches the workbook: hoist 46.7%, body up M-BAR 41.1%', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(governing(page)).toContainText('Lodestar D8 LL 1000 Kg 1 Fall 7.92 x 21.80');
  await expect(governing(page)).toContainText('46.7%');
  await expect(page.locator('.total-static')).toContainText('444.66 kg');
  await page.getByText('Body up', { exact: true }).click();
  await expect(governing(page)).toContainText('L-Acoustics M-BAR');
  await expect(governing(page)).toContainText('41.1%');
});

test('a download is not certain, so its autosave copy is kept until the user moves on', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Download test');
  await save(page); // layer 1: the browser cannot say whether the file arrived
  await expect(page.getByText(/The browser cannot confirm the download finished, so a copy stays in autosave/)).toBeVisible();
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
  await page.waitForTimeout(1500);

  // Still offered back after a reload, with the date and time in local time.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' })).toBeVisible();
  await expect(page.getByText(/Autosaved \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\./)).toBeVisible();
  await expect(page.getByText(/saved as a download and not changed afterwards/)).toBeVisible();

  // Answering the offer removes it, and autosave then works again.
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText(/Restore unsaved changes/)).toHaveCount(0);
  await page.getByLabel('Venue').fill('After discard');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('After discard');
});

test('Save and New leave a waiting restore offer for another show alone', async ({ page }) => {
  await start(page);
  // Show A is left unsaved (a crash, say) and autosaved.
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Unsaved show A');
  await page.waitForTimeout(1500);
  await page.reload();
  const offer = page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' });
  await expect(offer).toBeVisible();

  // The offer is ignored: another show is opened, edited and saved.
  await openFile(page, 'b.loadsheet.json', JSON.stringify({ ...ballroom, job: { ...ballroom.job, name: 'Show B' } }));
  await expect(page.locator('.show-title')).toHaveText('Show B – Main Hang Left');
  await page.keyboard.press('Escape'); // close the library-changes list, if shown
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Venue').fill('Edited B');
  const saved = await save(page);
  expect(saved.json.job).toMatchObject({ name: 'Show B' });
  await expect(page.getByText(/a copy stays in autosave/)).toBeVisible();
  await expect(offer).toBeVisible();

  // Pressing New does not remove it either.
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(offer).toBeVisible();

  // After a reload the offer is still there, with show A's changes, and Restore gives them back.
  await page.reload();
  await expect(offer).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Unsaved show A');
});

test('an ignored restore offer does not stop the current show being autosaved; both can be recovered', async ({ page }) => {
  await start(page);
  // Show A is left unsaved and autosaved, then the app is reopened and the offer is ignored.
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Unsaved show A');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' })).toBeVisible();

  // Show B is opened and edited; wait past the autosave delay (about 1 s), then "crash".
  await openFile(page, 'b.loadsheet.json', JSON.stringify({ ...ballroom, job: { ...ballroom.job, name: 'Show B' } }));
  await page.keyboard.press('Escape'); // close the library-changes list, if shown
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Venue').fill('Unsaved show B');
  await page.waitForTimeout(1500);
  await page.reload();

  // Two records: the newest (B) is offered first, then A, one after the other.
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to Show B – Main Hang Left?' })).toBeVisible();
  await expect(page.getByText(/1 more autosaved show is waiting/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Unsaved show B');
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' })).toBeVisible();
  await expect(page.getByText(/more autosaved show/)).toHaveCount(0);

  // After another reload both are offered again (restored B is the live autosave, A was never answered).
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to Show B – Main Hang Left?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Unsaved show A');
  await expect(page.getByText(/Restore unsaved changes/)).toHaveCount(0);
});

test('opening another show after a download clears the kept copy', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Download test');
  await save(page);
  await page.waitForTimeout(500);
  await openFile(page, 'ballroom.loadsheet.json', JSON.stringify(ballroom));
  await expect(page.locator('.show-title')).toHaveText('The Ballroom – Main Hang Left');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.getByText(/Restore unsaved changes/)).toHaveCount(0);
});

test('Open asks about unsaved changes after the file is chosen, and a refusal leaves the show alone', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Edited venue');
  page.removeAllListeners('dialog');
  const asked: string[] = [];
  page.on('dialog', (d) => {
    asked.push(d.message());
    void d.dismiss();
  });
  await openFile(page, 'other.loadsheet.json', JSON.stringify({ ...ballroom, job: { ...ballroom.job, name: 'Other Job' } }));
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toBe('Open other.loadsheet.json? Unsaved changes to The Ballroom – Main Hang Left will be lost.');
  await expect(page.locator('.show-title')).toHaveText('The Ballroom – Main Hang Left');
  await expect(page.getByLabel('Venue')).toHaveValue('Edited venue');
});
