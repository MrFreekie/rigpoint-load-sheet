import { expect, test } from '@playwright/test';
import { start } from './helpers';

const background = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const DAY = 'rgb(238, 240, 243)';
const NIGHT = 'rgb(14, 16, 20)';

test('the theme button overrides the device setting and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page);
  const button = page.getByRole('button', { name: /^Colour theme:/ });
  await expect(button).toHaveText('Theme: Auto');
  expect(await background(page)).toBe(NIGHT);

  await button.click();
  await expect(button).toHaveText('Theme: Day');
  expect(await background(page)).toBe(DAY);

  await page.reload();
  await expect(page.getByRole('button', { name: /^Colour theme:/ })).toHaveText('Theme: Day');
  expect(await background(page)).toBe(DAY);

  await page.getByRole('button', { name: /^Colour theme:/ }).click();
  await expect(page.getByRole('button', { name: /^Colour theme:/ })).toHaveText('Theme: Night');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await background(page)).toBe(NIGHT);

  await page.getByRole('button', { name: /^Colour theme:/ }).click();
  await expect(page.getByRole('button', { name: /^Colour theme:/ })).toHaveText('Theme: Auto');
  expect(await background(page)).toBe(DAY);
});
