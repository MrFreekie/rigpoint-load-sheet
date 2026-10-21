// Reading and writing show files. Pure: text in, validated data out, and back.
// Every opened file is untrusted: size-limited, parsed as JSON only, migrated and validated.

import { ShowFileSchema, type ShowFile } from '../schema/show-file';
import { formatIssues } from '../schema/errors';
import { migrate, MigrationError } from './migrations';

/** Show files are a few kilobytes; anything far bigger is not one. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type OpenResult =
  | { ok: true; show: ShowFile; migratedFrom: string | null }
  | { ok: false; message: string; details: string[] };

export function parseShowFile(text: string): OpenResult {
  if (text.length > MAX_FILE_BYTES) {
    return { ok: false, message: 'The file is too large to be a show file.', details: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\u{FEFF}/u, ''));
  } catch {
    return { ok: false, message: 'The file is not valid JSON, so it cannot be a show file.', details: [] };
  }
  let migrated;
  try {
    migrated = migrate(raw);
  } catch (e) {
    if (e instanceof MigrationError) return { ok: false, message: e.message, details: [] };
    throw e;
  }
  const parsed = ShowFileSchema.safeParse(migrated.file);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'The file is a show file, but some of its contents are not valid:',
      details: formatIssues(parsed.error),
    };
  }
  return { ok: true, show: parsed.data, migratedFrom: migrated.from };
}

/** ISO 8601 with the local offset, e.g. "2026-10-21T16:00:00+01:00". */
export function isoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
  );
}

/**
 * Validate and normalise a show for writing. Strips anything the format does not
 * define (such as the editor's row keys), so a written file always re-opens.
 */
export function toShowFile(show: unknown, stamp: { appVersion: string; specVersion: string; savedAt: Date }): ShowFile {
  const parsed = ShowFileSchema.parse(show);
  return { ...parsed, app_version: stamp.appVersion, spec_version: stamp.specVersion, saved_at: isoWithOffset(stamp.savedAt) };
}

export function serialiseShow(file: ShowFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * The parts of a show that matter for "unsaved changes": everything except the
 * save stamp. Two shows with the same content give the same string.
 */
export function contentFingerprint(show: unknown): string {
  const content: Partial<ShowFile> = { ...ShowFileSchema.parse(show) };
  delete content.saved_at;
  delete content.app_version;
  delete content.spec_version;
  return JSON.stringify(content);
}
