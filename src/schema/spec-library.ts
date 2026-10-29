// Zod schema for data/spec-library.json (format "loadsheet-spec/1").

import { z } from './zod';
import type { Snapshot } from '../engine/types';

export const SPEC_FORMAT = 'loadsheet-spec/1';

/**
 * spec_version is the date of the last library change, yyyy-mm-dd. A second or later change
 * on the same day adds a suffix: 2026-10-21.2, 2026-10-21.3, … (no suffix counts as .1).
 * scripts/check-spec-version.mjs repeats this rule for CI; keep the two in step.
 */
const SPEC_VERSION_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:\.([2-9]|[1-9]\d+))?$/;

export function parseSpecVersion(v: string): { date: string; change: number } | null {
  const m = SPEC_VERSION_PATTERN.exec(v);
  if (!m || !z.iso.date().safeParse(m[1]).success) return null;
  return { date: m[1] as string, change: m[2] ? Number(m[2]) : 1 };
}

/** Negative if a is older than b, 0 if equal, positive if newer. Null if either is not a valid version. */
export function compareSpecVersions(a: string, b: string): number | null {
  const pa = parseSpecVersion(a);
  const pb = parseSpecVersion(b);
  if (!pa || !pb) return null;
  return pa.date === pb.date ? pa.change - pb.change : pa.date < pb.date ? -1 : 1;
}

const nonNegative = (what: string) =>
  z.number({ error: `${what} must be a number` }).finite().nonnegative({ error: `${what} must not be negative` });

export const SpecItemSchema = z.object({
  name: z.string().trim().min(1, { error: 'Item name must not be empty' }),
  kg: nonNegative('Weight (kg)').nullable(),
  per: z.enum(['each', 'm'], { error: 'per must be "each" or "m"' }),
  swl_kg: nonNegative('SWL (kg)').nullable(),
  weight_note: z.string().nullable(),
  source: z.string().nullable(),
  verified: z.iso.date({ error: 'verified must be an ISO date (yyyy-mm-dd)' }).nullable(),
});

export const SpecLibrarySchema = z
  .object({
    format: z.literal(SPEC_FORMAT),
    spec_version: z.string().refine((v) => parseSpecVersion(v) !== null, {
      error: 'spec_version must be a date (yyyy-mm-dd), with .2, .3 … for a further change on the same day',
    }),
    units: z.record(z.string(), z.string()).optional(),
    items: z.array(SpecItemSchema),
  })
  .superRefine((lib, ctx) => {
    const seen = new Map<string, number>();
    lib.items.forEach((item, i) => {
      const first = seen.get(item.name);
      if (first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'name'],
          message: `Duplicate item name "${item.name}" (also at position ${first + 1})`,
        });
      } else {
        seen.set(item.name, i);
      }
    });
  });

export type SpecItem = z.infer<typeof SpecItemSchema>;
export type SpecLibrary = z.infer<typeof SpecLibrarySchema>;

/** The values copied into a show-file row when this item is chosen. */
export function snapshotOf(item: Pick<SpecItem, 'kg' | 'per' | 'swl_kg'>): Snapshot {
  return { kg: item.kg, per: item.per, swl_kg: item.swl_kg };
}

export function indexByName(lib: SpecLibrary): Map<string, SpecItem> {
  return new Map(lib.items.map((i) => [i.name, i]));
}
