// Phase 4: the Load Sheet prints on exactly one A4 page (BRIEF.md 10 and 13.2).
// PDF output is a Chromium feature in Playwright, so these run in Chromium only.

import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ballroom, openFile, start } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'PDF printing is Chromium-only in Playwright');

/** Count pages in a PDF by its page objects. */
function pdfPages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

async function printToPdf(page: Page, name: string): Promise<Buffer> {
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await test.info().attach(name, { body: pdf, contentType: 'application/pdf' });
  writeFileSync(test.info().outputPath(name), pdf); // kept in test-results/ for a visual check
  await page.screenshot({ path: test.info().outputPath(name.replace('.pdf', '.png')), fullPage: true });
  return pdf;
}

const sheet = (page: Page) => page.getByTestId('load-sheet');

/**
 * The page box clips anything taller than A4, so a one-page PDF alone does not prove that
 * nothing was cut off. Check the footer (the last thing on the sheet) is inside the page,
 * and report the scale used to fit it.
 */
async function expectNothingClipped(page: Page): Promise<number> {
  await page.emulateMedia({ media: 'print' });
  const m = await page.evaluate(() => {
    const p = document.querySelector('.ls-page')!.getBoundingClientRect();
    const f = document.querySelector('.ls-footer')!.getBoundingClientRect();
    const t = (document.querySelector('.ls-content') as HTMLElement).style.transform;
    return { pageBottom: p.bottom, footerBottom: f.bottom, scale: t ? Number(/scale\(([\d.]+)\)/.exec(t)![1]) : 1 };
  });
  expect(m.footerBottom, 'footer must be inside the page').toBeLessThanOrEqual(m.pageBottom + 0.5);
  return m.scale;
}

test('page counting works (sanity check for the tests below)', async ({ page }) => {
  await page.setContent(
    '<style>@page{size:A4;margin:10mm} div{break-after:page}</style><div>1</div><div>2</div><p>3</p>',
  );
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toBe(3);
});

test('the Ballroom Load Sheet prints on exactly one A4 page', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Load example' }).click();
  const pdf = await printToPdf(page, 'ballroom.pdf');
  expect(pdfPages(pdf)).toBe(1);
  // The Ballroom fits close to full size (about 94%: 8 pt text prints at about 7.5 pt).
  expect(await expectNothingClipped(page)).toBeGreaterThanOrEqual(0.9);

  // Only the Load Sheet prints, not the editing screen.
  await expect(page.locator('.app')).toBeHidden();
  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s).toContainText('FLOWN ARRAY LOAD SHEET');
  await expect(s).toContainText('Static load-path analysis – single hang');
  await expect(s).toContainText('TOTAL STATIC WEIGHT444.66 kg');
  await expect(s).toContainText('Lodestar D8 LL 1000 Kg 1 Fall 7.92 x 21.80');
  await expect(s.locator('.ls-governing')).toContainText('46.7% OK');
  await expect(s).toContainText('⚠ MISSING DATA – total understated. Resolve TBC / NOT FOUND / LEN? flags.');
  await expect(s).toContainText('Design load submitted for approval by the venue / structural engineer.');
  await expect(s).toContainText('Taken from the Spec library in this app'.replace('Taken', 'taken'));
  await expect(s.locator('.ls-watermark')).toHaveText('DRAFT');
  await expect(s.locator('.ls-footer')).toHaveText(
    /^RigPoint Load Sheet app \d+\.\d+\.\d+ · Spec [\d.-]+ · The Ballroom - Main Hang Left\.loadsheet\.json \(not saved\) · Printed \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
  );
  // Sheet Date is left blank for handwriting.
  await expect(s.locator('.ls-write-in')).toHaveText('');
});

test('a 30-row hang still prints on one page', async ({ page }) => {
  await start(page);
  const big = structuredClone(ballroom);
  const zones = big.hangs[0]!.zones;
  const fill = (zone: string, count: number) => {
    const rows = zones[zone]!;
    while (rows.length < count) rows.push({ ...structuredClone(rows[rows.length - 1]!) });
  };
  fill('top_rigging', 3);
  fill('hoist', 10);
  fill('hook', 4);
  fill('path1', 7);
  fill('path2', 6);
  expect(Object.values(zones).reduce((n, rows) => n + rows.length, 0)).toBe(30);
  await openFile(page, 'big.loadsheet.json', JSON.stringify(big));
  await expect(page.getByText('too many rows to print')).toHaveCount(0);
  expect(pdfPages(await printToPdf(page, 'thirty-rows.pdf'))).toBe(1);
  expect(await expectNothingClipped(page)).toBeGreaterThanOrEqual(0.72);
});

test('approved: no watermark; stated capacity, body up and top rigging not included are printed', async ({ page }) => {
  await start(page);
  const f = structuredClone(ballroom);
  f.job.status = 'approved';
  const hang = f.hangs[0] as unknown as Record<string, unknown>;
  hang.hoist_orientation = 'body_up';
  hang.top_rigging_included = false;
  hang.point_capacity = { kg: 1000, source: '', conditions: 'Vertical only', print: true };
  await openFile(page, 'approved.loadsheet.json', JSON.stringify(f));
  await page.keyboard.press('Escape'); // no library differences expected, but close any dialog
  await page.emulateMedia({ media: 'print' });
  const s = sheet(page);
  await expect(s.locator('.ls-watermark')).toHaveCount(0);
  await expect(s).toContainText('Stated 1,000 kg – 46.7% used.  Source: NOT STATED  Conditions: Vertical only');
  await expect(s).toContainText('Body up – hoist checked against the hook load; its own weight, chain and cables hang on the top rigging.');
  await expect(
    s.locator('.ls-statements .ls-red', { hasText: 'Top rigging:' }),
  ).toHaveText('Top rigging: NOT INCLUDED – components above the hoist are not listed and not checked.');
  await expect(s.locator('.ls-governing')).toContainText('L-Acoustics M-BAR');
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }))).toBe(1);
  await expectNothingClipped(page);
});
