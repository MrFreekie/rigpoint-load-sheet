// Phase 5: installable, offline, save in place, recent files and Android share.
// Service workers and the File System Access API are tested in Chromium.

import { expect, test, type Page } from '@playwright/test';
import { ballroom, governing, start } from './helpers';

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop features');

/** Wait until the service worker is installed and controls the page. */
async function controlledByServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test('the web manifest makes the app installable and registers file and share handlers', async ({ page, request, baseURL }) => {
  await start(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, baseURL).href)).json();
  expect(manifest).toMatchObject({
    name: 'RigPoint Load Sheet',
    short_name: 'Load Sheet',
    display: 'standalone',
    start_url: './',
    scope: './',
    file_handlers: [{ action: './', accept: { 'application/json': ['.json'] } }],
    share_target: { action: './share-target', method: 'POST', enctype: 'multipart/form-data' },
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(new URL(icon.src, new URL(href!, baseURL)).href);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});

test('works with no network once loaded', async ({ page, context }) => {
  await start(page);
  await controlledByServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(governing(page)).toContainText('46.7%');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByText(/Spec [\d.-]+ · \d+ items/)).toBeVisible();
  await context.setOffline(false);
});

// --- Save in place. Native file pickers cannot be driven by Playwright, so the pickers are
// replaced with ones that return real file handles from the browser's origin-private file
// system. Everything after the picker (permission, writing, recent files) is the real code.

async function withFakePickers(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const calls: { kind: string; suggestedName?: string | undefined }[] = [];
    w.__pickerCalls = calls;
    w.__nextOpen = '';
    w.showSaveFilePicker = async (opts?: { suggestedName?: string }) => {
      calls.push({ kind: 'save', suggestedName: opts?.suggestedName });
      const dir = await navigator.storage.getDirectory();
      return dir.getFileHandle(opts?.suggestedName ?? 'untitled.loadsheet.json', { create: true });
    };
    w.showOpenFilePicker = async () => {
      calls.push({ kind: 'open' });
      const dir = await navigator.storage.getDirectory();
      return [await dir.getFileHandle(String(w.__nextOpen))];
    };
  });
}

const readOpfs = (page: Page, name: string) =>
  page.evaluate(async (n) => {
    const dir = await navigator.storage.getDirectory();
    return (await (await dir.getFileHandle(n)).getFile()).text();
  }, name);

const writeOpfs = (page: Page, name: string, text: string) =>
  page.evaluate(
    async ([n, t]) => {
      const dir = await navigator.storage.getDirectory();
      const w = await (await dir.getFileHandle(n!, { create: true })).createWritable();
      await w.write(t!);
      await w.close();
    },
    [name, text],
  );

const pickerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pickerCalls: { kind: string; suggestedName?: string }[] }).__pickerCalls);

test('Save writes back to the opened file; Save As picks a new one; recent files reopen', async ({ page }) => {
  await withFakePickers(page);
  await start(page, { fsAccess: true });
  const name = 'The Ballroom - Main Hang Left.loadsheet.json';
  await writeOpfs(page, name, JSON.stringify(ballroom));
  await page.evaluate((n) => ((window as unknown as Record<string, unknown>).__nextOpen = n), name);

  // Open through the picker: no download involved.
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText(`Saved · ${name}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save As' })).toBeVisible();

  // Edit and Save: the same file is updated in place, without a picker.
  await page.getByLabel('Venue').fill('Grand Hotel');
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();
  expect(JSON.parse(await readOpfs(page, name)).job.venue).toBe('Grand Hotel');
  expect((await pickerCalls(page)).filter((c) => c.kind === 'save')).toHaveLength(0);
  expect(downloads).toBe(0);

  // Recent files survive a reload and reopen the file.
  await page.reload();
  await page.getByRole('button', { name: 'Recent' }).click();
  await page.getByRole('button', { name: `Open ${name}` }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Grand Hotel');
  await page.getByLabel('Venue').fill('Grand Hotel – Ballroom');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();
  expect(JSON.parse(await readOpfs(page, name)).job.venue).toBe('Grand Hotel – Ballroom');

  // Save As goes to a new file and Save then follows it.
  await page.getByRole('button', { name: 'Save As' }).click();
  expect((await pickerCalls(page)).at(-1)).toEqual({ kind: 'save', suggestedName: name });
});

test('a new revision of an approved show never overwrites the original file', async ({ page }) => {
  await withFakePickers(page);
  await start(page, { fsAccess: true });
  const approved = structuredClone(ballroom);
  approved.job.status = 'approved';
  approved.job.revision = 'A';
  const original = 'The Ballroom - Main Hang Left - Rev A.loadsheet.json';
  const text = JSON.stringify(approved);
  await writeOpfs(page, original, text);
  await page.evaluate((n) => ((window as unknown as Record<string, unknown>).__nextOpen = n), original);

  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Read-only: this show is Approved' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new revision' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Save asked where to put the revision, suggesting a new name.
  expect((await pickerCalls(page)).at(-1)).toEqual({ kind: 'save', suggestedName: 'The Ballroom - Main Hang Left - Rev B.loadsheet.json' });
  expect(await readOpfs(page, original)).toBe(text);
  expect(JSON.parse(await readOpfs(page, 'The Ballroom - Main Hang Left - Rev B.loadsheet.json')).job).toMatchObject({
    status: 'draft',
    revision: 'B',
  });
});

test('a show file shared from another app opens (Android share target)', async ({ page }) => {
  await start(page);
  await controlledByServiceWorker(page);
  // Do what Android does: POST the file to the share target as multipart form data. (A form in
  // the page cannot do it: the app's Content Security Policy forbids form submissions.)
  const redirectedTo = await page.evaluate(async (json) => {
    const body = new FormData();
    body.append('show', new File([json], 'Shared Hang.loadsheet.json', { type: 'application/json' }));
    const res = await fetch('share-target', { method: 'POST', body });
    return res.redirected ? res.url : `no redirect (${res.status})`;
  }, JSON.stringify(ballroom));
  expect(new URL(redirectedTo).search).toBe('?shared=1');
  await page.goto(redirectedTo);
  await expect(page.locator('.show-title')).toHaveText('The Ballroom – Main Hang Left');
  await expect(page.getByText('Opened Shared Hang.loadsheet.json.')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});
