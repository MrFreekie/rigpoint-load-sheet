// A typing slip must not blank the app: numbers beyond the limits are refused at the field.

import { expect, test } from '@playwright/test';
import { governing, pickItem, start } from './helpers';

test('a huge quantity is refused and the app keeps working', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add row to Load path 1 – array' }).click();
  await pickItem(page, 'Load path 1 – array row 1', 'm-bump', /^L-Acoustics M-BUMP/);
  const qty = page.getByLabel('Qty, Load path 1 – array row 1');
  await qty.fill('2');
  await expect(governing(page)).toContainText('L-Acoustics');

  await qty.fill('90071992547409930000');
  await expect(page.getByText('Must be 9,999 or less')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  await expect(governing(page)).toContainText('L-Acoustics');

  await qty.fill('9999');
  await expect(page.getByText('Must be 9,999 or less')).toHaveCount(0);
});
