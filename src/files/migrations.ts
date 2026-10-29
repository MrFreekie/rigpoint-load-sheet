// Show-file format migrations. Old files are upgraded on open, never rejected.
//
// To add a format version N+1: add a step to MIGRATIONS keyed by the version it upgrades FROM,
// bump CURRENT_FORMAT in show-file.ts, and add a test in migrations.test.ts with a sample file.

import { SHOW_FORMAT } from '../schema/show-file';

export const FORMAT_PREFIX = 'loadsheet/';

type Raw = Record<string, unknown>;

/** Each step takes a parsed file of one version and returns the next version. */
export const MIGRATIONS: Record<string, (file: Raw) => Raw> = {
  // 'loadsheet/1': (f) => ({ ...f, format: 'loadsheet/2', ... }),
};

export class MigrationError extends Error {}

function versionNumber(format: string): number | null {
  if (!format.startsWith(FORMAT_PREFIX)) return null;
  const n = Number(format.slice(FORMAT_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export interface Migrated {
  file: Raw;
  /** The format the file had before migration, when it was upgraded. */
  from: string | null;
}

export function migrate(input: unknown): Migrated {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new MigrationError('This is not a Load Sheet show file (it does not contain a JSON object).');
  }
  let file = input as Raw;
  const original = file.format;
  if (typeof original !== 'string' || versionNumber(original) === null) {
    throw new MigrationError('This is not a Load Sheet show file (it has no "loadsheet/…" format marker).');
  }
  const current = versionNumber(SHOW_FORMAT) as number;
  if ((versionNumber(original) as number) > current) {
    throw new MigrationError(
      `This show file is format ${original}, made by a newer version of the app. This version reads up to ${SHOW_FORMAT}. Reload the app to get the latest version.`,
    );
  }
  let format = original;
  while (format !== SHOW_FORMAT) {
    const step = MIGRATIONS[format];
    if (!step) throw new MigrationError(`No upgrade is available for show file format ${format}.`);
    file = step(file);
    format = String(file.format);
  }
  return { file, from: original === SHOW_FORMAT ? null : original };
}
