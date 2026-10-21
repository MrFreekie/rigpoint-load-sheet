// Spec library validation. CI runs this on every push (npm run validate:spec).

import { describe, expect, it } from 'vitest';
import libraryJson from '../../data/spec-library.json';
import { compareSpecVersions, parseSpecVersion, SpecLibrarySchema } from './spec-library';

const item = (over: Record<string, unknown> = {}) => ({
  name: 'Test item',
  kg: 1,
  per: 'each',
  swl_kg: null,
  weight_note: null,
  source: null,
  verified: null,
  ...over,
});
const lib = (items: unknown[]) => ({ format: 'loadsheet-spec/1', spec_version: '2026-10-21', items });

describe('data/spec-library.json', () => {
  const parsed = SpecLibrarySchema.safeParse(libraryJson);

  it('is valid', () => {
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it('has the expected counts (189 items, 27 TBC, 85 rated)', () => {
    // Update these when the library changes; they guard against accidental edits.
    const items = parsed.data!.items;
    expect(items).toHaveLength(189);
    expect(items.filter((i) => i.kg === null)).toHaveLength(27);
    expect(items.filter((i) => (i.swl_kg ?? 0) > 0)).toHaveLength(85);
  });
});

describe('SpecLibrarySchema', () => {
  it('accepts a minimal library', () => {
    expect(SpecLibrarySchema.safeParse(lib([item()])).success).toBe(true);
  });

  it('rejects duplicate names', () => {
    const r = SpecLibrarySchema.safeParse(lib([item(), item({ kg: 2 })]));
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('Duplicate item name "Test item" (also at position 1)');
    expect(r.error!.issues[0]!.path).toEqual(['items', 1, 'name']);
  });

  it.each([
    ['per', { per: 'metre' }],
    ['negative kg', { kg: -1 }],
    ['negative SWL', { swl_kg: -5 }],
    ['text kg', { kg: '25' }],
    ['empty name', { name: '  ' }],
    ['bad verified date', { verified: '21/10/2026' }],
  ])('rejects %s', (_label, over) => {
    expect(SpecLibrarySchema.safeParse(lib([item(over)])).success).toBe(false);
  });

  it.each(['v6', '2026-13-01', '2026-10-21.1', '2026-10-21.0', '2026-10-21.', '2026-10-21.02', '21/10/2026'])(
    'rejects spec_version %j',
    (v) => expect(SpecLibrarySchema.safeParse({ ...lib([]), spec_version: v }).success).toBe(false),
  );

  it.each(['2026-10-21', '2026-10-21.2', '2026-10-21.10'])('accepts spec_version %j', (v) =>
    expect(SpecLibrarySchema.safeParse({ ...lib([]), spec_version: v }).success).toBe(true),
  );
});

describe('spec versions', () => {
  it('parses the date and same-day change number', () => {
    expect(parseSpecVersion('2026-10-21')).toEqual({ date: '2026-10-21', change: 1 });
    expect(parseSpecVersion('2026-10-21.2')).toEqual({ date: '2026-10-21', change: 2 });
  });

  it.each([
    ['2026-10-21', '2026-10-21', 0],
    ['2026-10-21.2', '2026-10-21', 1],
    ['2026-10-21.10', '2026-10-21.9', 1],
    ['2026-10-22', '2026-10-21.5', 1],
    ['2026-10-21.3', '2026-11-01', -1],
  ])('%s compared with %s', (a, b, sign) => expect(Math.sign(compareSpecVersions(a, b)!)).toBe(sign));
});
