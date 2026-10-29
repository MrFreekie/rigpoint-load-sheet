// The Content Security Policy of the built app: present, as written in vite.config.ts,
// never violated in normal use, and no request ever leaves the app's own origin.
// Chromium only; the meta tag is added at build time, so this needs the production build
// (the Playwright web server builds it).

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ballroom, openFile, start } from './helpers';

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop');

/** The policy as written in vite.config.ts, so this test cannot drift from it. */
function policyFromConfig(): string[] {
  const source = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const block = /const CSP = \[([\s\S]*?)\]\.join/.exec(source)?.[1];
  expect(block, 'CSP array found in vite.config.ts').toBeTruthy();
  return [...block!.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]!);
}

test('the page carries the strict Content Security Policy from vite.config.ts', async ({ page }) => {
  await start(page);
  const content = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(content, 'meta tag present (is this the production build?)').not.toBeNull();
  const wanted = policyFromConfig();
  expect(wanted.length).toBeGreaterThanOrEqual(10);
  expect(content!.split(';').map((d) => d.trim())).toEqual(wanted);
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'self'",
  ]) {
    expect(wanted).toContain(directive);
  }
  // Nothing loosened: no inline or eval scripts, wildcards or other origins.
  expect(content).not.toMatch(/unsafe-|\*|https?:/);
});

test('no policy violation and no foreign request while loading, editing, printing and viewing the library', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const violations: string[] = [];
  const foreign: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __violations: string[] }).__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample}`);
    });
    (window as unknown as { __violations: string[] }).__violations = [];
  });
  // The context sees page, worker and service-worker requests.
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return;
    if (u.origin !== origin) foreign.push(r.url());
  });
  // No exceptions: Zod's `new Function` probe is switched off in src/schema/zod.ts.
  const collect = async () => {
    const all = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
    violations.push(...all);
  };

  await start(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // Editing a row.
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('textbox', { name: 'Contingency' }).fill('7');
  await expect(page.getByRole('textbox', { name: 'Contingency' })).toHaveValue('7');
  await openFile(page, 'x.loadsheet.json', JSON.stringify(ballroom));
  // The Ballroom was saved with an older library, so a library-changes list appears.
  await page.getByRole('dialog').getByRole('button', { name: 'Keep as saved' }).click();
  await expect(page.locator('.show-title')).toBeVisible();

  // Printing.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('load-sheet')).toBeVisible();
  await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: null });

  // The library viewer.
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByText(/Spec [\d.-]+ · \d+ items/)).toBeVisible();

  await collect();
  expect(violations, 'securitypolicyviolation events').toEqual([]);
  expect(foreign, 'requests to other origins').toEqual([]);
});
