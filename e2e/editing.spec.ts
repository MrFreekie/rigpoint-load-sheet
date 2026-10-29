// Editing behaviour: invalid number boxes, keyboard focus after adding and deleting rows,
// and the screen-reader and touch-target details of the summary bar and notices.

import { expect, test, type Page } from '@playwright/test';
import { ballroom, save, start } from './helpers';

declare global {
  interface Window {
    __printed: number;
  }
}

const contingency = (page: Page) => page.getByRole('textbox', { name: 'Contingency' });

/** Replace the page's dialog handling with one that records the message and answers. */
function answerDialogs(page: Page, accept: boolean) {
  page.removeAllListeners('dialog');
  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    void (accept ? d.accept() : d.dismiss());
  });
  return messages;
}

test('an error in a number box is warned about before Print and Save', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => void window.__printed++;
  });
  await contingency(page).fill('150');
  await expect(page.getByText('Must be 100 or less')).toBeVisible();

  // Declined: nothing is printed or saved.
  const asked = answerDialogs(page, false);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => asked.length).toBe(2);
  expect(asked[0]).toMatch(/^Some boxes have errors, so the Load Sheet uses the last valid values/);
  expect(asked[1]).toMatch(/^Some boxes have errors, so the saved file uses the last valid values/);
  expect(await page.evaluate(() => window.__printed)).toBe(0);
  expect(downloads).toBe(0);

  // Accepted: it goes ahead, with the last valid value (not 150).
  answerDialogs(page, true);
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  const saved = await save(page);
  expect(saved.json.job.contingency).toBe(ballroom.job.contingency);
});

test('no warning without an error', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  const asked = answerDialogs(page, false);
  await page.evaluate(() => (window.print = () => undefined));
  await contingency(page).fill('7');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await save(page);
  expect(asked).toEqual([]);
});

test('what was typed in a box with an error does not follow into another show', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  const original = await contingency(page).inputValue();
  await contingency(page).fill('150');
  await expect(page.getByText('Must be 100 or less')).toBeVisible();

  // Same value in the new show as the last valid value here: the box still has to reset.
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(contingency(page)).toHaveValue(original);
  await expect(page.getByText('Must be 100 or less')).toHaveCount(0);

  await contingency(page).fill('150');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('Must be 100 or less')).toHaveCount(0);
  await expect(contingency(page)).not.toHaveValue('150');
});

test('focus follows an added or deleted row', async ({ page }) => {
  await start(page);
  const zone = 'Load path 1 – array';
  const add = page.getByRole('button', { name: `Add row to ${zone}` });

  await add.click();
  await expect(page.getByRole('combobox', { name: `Item, ${zone} row 1` })).toBeFocused();
  await page.keyboard.press('Escape');
  await add.click();
  await expect(page.getByRole('combobox', { name: `Item, ${zone} row 2` })).toBeFocused();
  await page.keyboard.press('Escape');

  // Deleting a row moves focus to the row that took its place, then to Add when none is left.
  await page.getByRole('button', { name: `Delete ${zone} row 1` }).click();
  await expect(page.getByRole('textbox', { name: `Note, ${zone} row 1` })).toBeFocused();
  await page.getByRole('button', { name: `Delete ${zone} row 1` }).click();
  await expect(add).toBeFocused();
});

test('the summary bar names its figures, announces only a change of state, and does not cover the footer', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();

  const bar = page.getByRole('link', { name: /^Go to summary/ });
  await expect(bar).toBeVisible();
  // The name contains everything the bar shows (label in name), starting with what it does.
  await expect(bar).toHaveAccessibleName(/^Go to summary: 444\.66 kg.*46\.7%.*OK/);

  // Only the hidden status line is a live region, and it changes with the light, not the percentage.
  await expect(page.locator('.governing')).not.toHaveAttribute('aria-live', /.+/);
  const live = page.locator('#summary > p[aria-live="polite"]');
  const before = (await live.textContent()) ?? '';
  expect(before).toMatch(/: OK$/);
  await contingency(page).fill('6');
  await expect(page.locator('.governing')).not.toContainText('46.7%');
  expect(await live.textContent()).toBe(before);
  await contingency(page).fill('100');
  await expect(live).not.toHaveText(before);

  // The last line of the page can be scrolled clear of the fixed bar.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const gap = await page.evaluate(() => {
    const footer = document.querySelector('.app-footer p:last-child')!.getBoundingClientRect();
    const mini = document.querySelector('.mini-summary')!.getBoundingClientRect();
    return mini.top - footer.bottom;
  });
  expect(gap).toBeGreaterThan(0);
});

test('the Dismiss button on a notice is a full-size touch target', async ({ page }) => {
  await start(page);
  await save(page);
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  await expect(dismiss).toBeVisible();
  const box = (await dismiss.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  expect(box.width).toBeGreaterThanOrEqual(43.5);
});
