// Show-file format migrations. Old files are upgraded on open, never rejected.
//
// To add a format version N+1: add a step to MIGRATIONS keyed by the version it upgrades FROM,
// bump SHOW_FORMAT in src/schema/show-file.ts, and add a test in migrations.test.ts with a sample file.

import { SHOW_FORMAT } from '../schema/show-file';

export const FORMAT_PREFIX = 'loadsheet/';

type Raw = Record<string, unknown>;

/** Each step takes a parsed file of one version and returns the next version. */
export const MIGRATIONS: Record<string, (file: Raw) => Raw> = {
  // 'loadsheet/1': (f) => ({ ...f, format: 'loadsheet/2', ... }),
};

export class MigrationError extends Error {}

/**
 * The version in a format marker. Only the form the app writes is accepted: "loadsheet/"
 * then a whole number with no leading zero, sign, decimal point or spaces. The app has never
 * written "loadsheet/01" or "loadsheet/1.0", and the format has no minor versions, so reading
 * such a marker as version 1 would be a guess.
 */
function versionNumber(format: string): number | null {
  const m = /^loadsheet\/([1-9][0-9]{0,8})$/.exec(format);
  return m ? Number(m[1]) : null;
}

export interface Migrated {
  file: Raw;
  /** The format the file had before migration, when it was upgraded. */
  from: string | null;
}

/**
 * Upgrade a parsed show file to the current format.
 *
 * @param steps and @param target exist so tests can check the upgrade loop; the app uses the defaults.
 */
export function migrate(input: unknown, steps: Record<string, (file: Raw) => Raw> = MIGRATIONS, target: string = SHOW_FORMAT): Migrated {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new MigrationError('This is not a Load Sheet show file (it does not contain a JSON object).');
  }
  let file = input as Raw;
  const original = file.format;
  if (typeof original !== 'string' || !original.startsWith(FORMAT_PREFIX)) {
    throw new MigrationError('This is not a Load Sheet show file (it has no "loadsheet/…" format marker).');
  }
  let version = versionNumber(original);
  if (version === null) {
    throw new MigrationError(
      `This show file's format marker "${original}" is not one the app writes (they are "loadsheet/1", "loadsheet/2" and so on), so it cannot be opened. If the file was edited by hand, check its "format" line.`,
    );
  }
  const current = versionNumber(target) as number;
  if (version > current) {
    throw new MigrationError(
      `This show file is format ${original}, made by a newer version of the app. This version reads up to ${target}. Reload the app to get the latest version.`,
    );
  }
  let format = original;
  while (format !== target) {
    const step = steps[format];
    if (!step) throw new MigrationError(`No upgrade is available for show file format ${format}.`);
    file = step(file);
    const next = typeof file.format === 'string' ? versionNumber(file.format) : null;
    // Every step must move the version forward, and not past the current one, or the
    // loop could run for ever.
    if (next === null || next <= version || next > current) {
      throw new MigrationError(
        `The upgrade from show file format ${format} gave an invalid result (it must move forward to a version no newer than ${current}, but gave ${JSON.stringify(file.format)}). This is a fault in the app.`,
      );
    }
    version = next;
    format = file.format as string;
  }
  return { file, from: original === target ? null : original };
}
