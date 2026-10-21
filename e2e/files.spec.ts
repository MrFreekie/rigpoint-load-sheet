// Phase 3: a show can be created, saved, closed, reopened and revised, in every browser.

import { expect, test } from '@playwright/test';
import { ballroom, governing, openFile, pickItem, save, savedName, start } from './helpers';

test('create, save, close, reopen and revise a show', async ({ page }) => {
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

  // Close: a saved show leaves nothing to restore.
  await page.reload();
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
  await expect(dialog.getByRole('heading')).toHaveText('Library changes since this show was saved (spec 2026-01-01 → 2026-10-21)');
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
