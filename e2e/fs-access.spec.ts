// Layer 2 (save in place) with a stand-in for the File System Access API, so the checks run in
// every browser project. The stand-in keeps "files" in the page and records what the app does.
// Confirmation boxes are answered by the stand-in, which also records the order of events.

import { expect, test, type Page } from '@playwright/test';
import { ballroom, start } from './helpers';

interface FakeFs {
  files: Map<string, { name: string; text: string; lastModified: number }>;
  events: string[];
  /** Answers to window.confirm, in order; true when none are left. */
  answers: boolean[];
  /** When set, writing fails with this message. */
  failWrite: string | null;
  /** While true, close() waits. */
  hold: boolean;
  next: { open: string | null; save: string | null };
}

declare global {
  interface Window {
    __fs: FakeFs;
  }
}

async function installFakeFs(page: Page) {
  await page.addInitScript(() => {
    let clock = 1_700_000_000_000;
    const fs: FakeFs = {
      files: new Map(),
      events: [],
      answers: [],
      failWrite: null,
      hold: false,
      next: { open: null, save: null },
    };
    window.__fs = fs;
    window.confirm = (message?: string) => {
      fs.events.push(`confirm: ${message ?? ''}`);
      return fs.answers.length ? (fs.answers.shift() as boolean) : true;
    };

    // A class, so the object stays storable in IndexedDB (only its data fields are copied).
    class FakeHandle {
      kind = 'file';
      constructor(
        public id: string,
        public name: string,
      ) {}
      async getFile() {
        const f = fs.files.get(this.id)!;
        return new File([f.text], f.name, { lastModified: f.lastModified });
      }
      async createWritable() {
        const id = this.id;
        let buffer = '';
        return {
          write: async (text: string) => {
            if (fs.failWrite) throw new Error(fs.failWrite);
            buffer += text;
          },
          close: async () => {
            while (fs.hold) await new Promise((r) => setTimeout(r, 10));
            const f = fs.files.get(id)!;
            f.text = buffer;
            f.lastModified = clock += 1000;
            fs.events.push('close');
          },
          abort: async () => void fs.events.push('abort'),
        };
      }
      async queryPermission() {
        return 'granted';
      }
      async requestPermission() {
        return 'granted';
      }
      async isSameEntry(other: { id: string }) {
        return other.id === this.id;
      }
    }

    const handleFor = (name: string) => {
      if (!fs.files.has(name)) fs.files.set(name, { name, text: '', lastModified: (clock += 1000) });
      return new FakeHandle(name, name);
    };
    window.showOpenFilePicker = async () => {
      fs.events.push('picker: open');
      return [handleFor(fs.next.open ?? 'a.loadsheet.json')] as unknown as FileSystemFileHandle[];
    };
    window.showSaveFilePicker = async (options) => {
      fs.events.push('picker: save');
      return handleFor(fs.next.save ?? options?.suggestedName ?? 'out.loadsheet.json') as unknown as FileSystemFileHandle;
    };
  });
}

const put = (page: Page, name: string, text: string) =>
  page.evaluate(([n, t]) => void window.__fs.files.set(n!, { name: n!, text: t!, lastModified: 1_600_000_000_000 }), [name, text] as const);
const events = (page: Page) => page.evaluate(() => window.__fs.events);
const fileText = (page: Page, name: string) => page.evaluate((n) => window.__fs.files.get(n)?.text ?? null, name);
const answers = (page: Page, ...a: boolean[]) => page.evaluate((x) => void (window.__fs.answers = x), a);

async function startFs(page: Page) {
  await installFakeFs(page);
  await start(page, { fsAccess: true });
  await page.getByRole('button', { name: 'Load example' }).click();
}

test('Open picks the file first and only then asks about unsaved changes', async ({ page }) => {
  await startFs(page);
  await put(page, 'a.loadsheet.json', JSON.stringify({ ...ballroom, job: { ...ballroom.job, name: 'Other Job' } }));
  await page.getByLabel('Venue').fill('Edited venue');

  // Declined: the show on screen stays as it was.
  await answers(page, false);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('.show-title')).toHaveText('The Ballroom – Main Hang Left');
  await expect(page.getByLabel('Venue')).toHaveValue('Edited venue');
  const declined = await events(page);
  expect(declined[0]).toBe('picker: open');
  expect(declined[1]).toMatch(/^confirm: Open a\.loadsheet\.json\? Unsaved changes/);

  // Accepted: the chosen file opens.
  await answers(page, true);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('.show-title')).toHaveText('Other Job – Main Hang Left');
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
});

test('Save in place asks before overwriting a file that changed outside the app', async ({ page }) => {
  await startFs(page);
  await page.getByLabel('Venue').fill('First save');
  await page.getByRole('button', { name: 'Save As' }).click();
  await expect(page.getByText(/Saved as The Ballroom - Main Hang Left\.loadsheet\.json\./)).toBeVisible();
  const name = 'The Ballroom - Main Hang Left.loadsheet.json';
  expect(await fileText(page, name)).toContain('First save');

  // Our own save is not a conflict.
  await page.getByLabel('Venue').fill('Second save');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();
  expect((await events(page)).filter((e) => e.startsWith('confirm'))).toEqual([]);

  // Someone else changes the file.
  await page.evaluate((n) => {
    const f = window.__fs.files.get(n)!;
    f.text = 'changed elsewhere';
    f.lastModified += 60_000;
  }, name);
  await page.getByLabel('Venue').fill('Third save');
  await answers(page, false);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Not saved: .* was not overwritten/)).toBeVisible();
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  expect(await fileText(page, name)).toBe('changed elsewhere');
  expect((await events(page)).filter((e) => e.startsWith('confirm'))[0]).toMatch(/has been changed outside this app/);

  // Overwriting on purpose works, and the next save is quiet again.
  await answers(page, true);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();
  expect(await fileText(page, name)).toContain('Third save');
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
});

test('a failed write is aborted, not closed, and the real error is shown', async ({ page }) => {
  await startFs(page);
  await page.getByLabel('Venue').fill('Will not be written');
  await page.getByRole('button', { name: 'Save As' }).click();
  await expect(page.getByText(/Saved as/)).toBeVisible();
  const name = 'The Ballroom - Main Hang Left.loadsheet.json';
  const before = await fileText(page, name);

  await page.getByLabel('Venue').fill('Disk full test');
  await page.evaluate(() => {
    window.__fs.failWrite = 'The disk is full';
    window.__fs.events.length = 0;
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('The show was not saved');
  await expect(dialog).toContainText('The disk is full');
  expect(await events(page)).toEqual(['abort']);
  expect(await fileText(page, name)).toBe(before);
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
});

test('an edit made while the save is finishing is still unsaved', async ({ page }) => {
  await startFs(page);
  await page.getByRole('button', { name: 'Save As' }).click();
  await expect(page.getByText(/Saved as/)).toBeVisible();
  const name = 'The Ballroom - Main Hang Left.loadsheet.json';

  await page.getByLabel('Venue').fill('Written');
  await page.evaluate(() => (window.__fs.hold = true));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Designer').fill('Typed during the save');
  await page.evaluate(() => (window.__fs.hold = false));
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();

  const text = (await fileText(page, name)) ?? '';
  expect(text).toContain('Written');
  expect(text).not.toContain('Typed during the save');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
});

test('Save As leaves a waiting restore offer for another show alone', async ({ page }) => {
  await startFs(page);
  await page.getByLabel('Venue').fill('Unsaved show A');
  await page.waitForTimeout(1500); // autosave runs about 1 s after the last change
  await page.reload();
  const offer = page.getByRole('heading', { name: 'Restore unsaved changes to The Ballroom – Main Hang Left?' });
  await expect(offer).toBeVisible();

  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Venue').fill('Edited example');
  await page.getByRole('button', { name: 'Save As' }).click();
  await expect(page.getByText(/Saved as/)).toBeVisible();
  await expect(offer).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(offer).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Venue')).toHaveValue('Unsaved show A');
});
