import { readFileSync } from 'node:fs';
import { expect, type Download, type Page } from '@playwright/test';

export const ballroom = JSON.parse(
  readFileSync(new URL('../fixtures/ballroom.loadsheet.json', import.meta.url), 'utf8'),
) as Record<string, unknown> & {
  job: Record<string, unknown>;
  hangs: { zones: Record<string, { item: string | null; snapshot: Record<string, unknown> | null }[]> }[];
};

/** The bundled library's version, so tests do not need editing when the library changes. */
export const librarySpecVersion = (
  JSON.parse(readFileSync(new URL('../data/spec-library.json', import.meta.url), 'utf8')) as { spec_version: string }
).spec_version;

/** Open the app with a clean slate. Confirmations and leave-page prompts are accepted. */
export async function start(page: Page) {
  page.on('dialog', (d) => void d.accept());
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
}

export async function openFile(page: Page, name: string, content: string) {
  await page.getByTestId('open-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
}

export async function save(page: Page): Promise<{ download: Download; text: string; json: Record<string, unknown> & { job: Record<string, unknown> } }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const path = await download.path();
  const text = readFileSync(path, 'utf8');
  return { download, text, json: JSON.parse(text) };
}

export async function pickItem(page: Page, rowLabel: string, search: string, option: RegExp) {
  const input = page.getByRole('combobox', { name: `Item, ${rowLabel}` });
  await input.click();
  await input.fill(search);
  await page.getByRole('option', { name: option }).click();
}

export const governing = (page: Page) => page.locator('.governing');

/**
 * The file name the browser will save under. WebKit's Linux build replaces spaces with
 * underscores in download names; the name the app asks for has spaces.
 */
export function savedName(download: Download): string {
  return download.suggestedFilename().replace(/_/g, ' ');
}
