// Spec library validation. CI runs this on every push (npm run validate:spec).

import { describe, expect, it } from 'vitest';
import libraryJson from '../../data/spec-library.json';
import { SpecLibrarySchema } from './spec-library';

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

  it('has the expected counts (177 items, 27 TBC, 73 rated)', () => {
    // Update these when the library changes; they guard against accidental edits.
    const items = parsed.data!.items;
    expect(items).toHaveLength(177);
    expect(items.filter((i) => i.kg === null)).toHaveLength(27);
    expect(items.filter((i) => (i.swl_kg ?? 0) > 0)).toHaveLength(73);
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

  it('rejects a bad spec_version', () => {
    expect(SpecLibrarySchema.safeParse({ ...lib([]), spec_version: 'v6' }).success).toBe(false);
  });
});
