import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { indexByName, type SpecItem } from '../schema/spec-library';
import { workbookLibrary } from '../testing/fixtures';
import { ShowFileSchema, type ShowFile } from '../schema/show-file';
import { applyLibraryUpdates, compareWithLibrary } from './compare';

const STEEL = 'Wire rope sling 10mm 1,280 Kg SWL EN13414-1:2003';
const BUMP = 'L-Acoustics M-BUMP';
const show = (): ShowFile => ShowFileSchema.parse(structuredClone(ballroomJson));
/** The Ballroom example was saved with the workbook's library. */
const libraryByName = indexByName(workbookLibrary);

/** The current library with some items changed or removed. */
function libraryWith(changes: Record<string, Partial<SpecItem> | null>): Map<string, SpecItem> {
  const lib = new Map([...libraryByName].map(([k, v]) => [k, { ...v }]));
  for (const [name, change] of Object.entries(changes)) {
    if (change === null) lib.delete(name);
    else Object.assign(lib.get(name)!, change);
  }
  return lib;
}

describe('compareWithLibrary', () => {
  it('reports no differences against the library the show was made from', () => {
    const c = compareWithLibrary(show(), libraryByName, '2026-10-21');
    expect(c.anyDifferences).toBe(false);
    expect(c.items.every((i) => i.status === 'unchanged')).toBe(true);
    // One entry per distinct item: 16 rows, one note-only, all items different.
    expect(c.items).toHaveLength(15);
  });

  it('detects a changed weight', () => {
    const c = compareWithLibrary(show(), libraryWith({ [STEEL]: { kg: 0.5 } }), '2026-11-04');
    const steel = c.items.find((i) => i.item === STEEL)!;
    expect(steel.status).toBe('changed');
    expect(steel.changes).toEqual([{ field: 'kg', from: null, to: 0.5 }]);
    expect(steel.rows).toEqual([{ hang: 0, zone: 'top_rigging', index: 0 }]);
    expect(c).toMatchObject({ fromSpec: '2026-10-21', toSpec: '2026-11-04', anyDifferences: true });
  });

  it('detects a changed SWL', () => {
    const c = compareWithLibrary(show(), libraryWith({ [BUMP]: { swl_kg: 900 } }), 'x');
    expect(c.items.find((i) => i.item === BUMP)!.changes).toEqual([{ field: 'swl_kg', from: 832, to: 900 }]);
  });

  it('detects an item removed from the library and keeps its snapshot', () => {
    const c = compareWithLibrary(show(), libraryWith({ [BUMP]: null }), 'x');
    const bump = c.items.find((i) => i.item === BUMP)!;
    expect(bump.status).toBe('removed');
    expect(bump.saved).toEqual({ kg: 25, per: 'each', swl_kg: 832 });
  });

  it('reports rows of one item saved with different values separately', () => {
    const s = show();
    s.hangs[0]!.zones.path2.push({ ...s.hangs[0]!.zones.path1[1]!, snapshot: { kg: 24, per: 'each', swl_kg: 832 } });
    const c = compareWithLibrary(s, libraryByName, 'x');
    const bumps = c.items.filter((i) => i.item === BUMP);
    expect(bumps.map((b) => b.status)).toEqual(['unchanged', 'changed']);
  });
});

describe('applyLibraryUpdates', () => {
  it('updates only the selected items and leaves the rest as saved', () => {
    const lib = libraryWith({ [STEEL]: { kg: 0.5 }, [BUMP]: { swl_kg: 900 } });
    const updated = applyLibraryUpdates(show(), new Set([STEEL]), lib);
    expect(updated.hangs[0]!.zones.top_rigging[0]!.snapshot).toEqual({ kg: 0.5, per: 'm', swl_kg: 1280 });
    expect(updated.hangs[0]!.zones.path1[1]!.snapshot).toEqual({ kg: 25, per: 'each', swl_kg: 832 });
  });

  it('leaves an item that is no longer in the library alone, even if selected', () => {
    const updated = applyLibraryUpdates(show(), new Set([BUMP]), libraryWith({ [BUMP]: null }));
    expect(updated.hangs[0]!.zones.path1[1]!.snapshot).toEqual({ kg: 25, per: 'each', swl_kg: 832 });
  });

  it('does not change the original', () => {
    const s = show();
    const before = structuredClone(s);
    applyLibraryUpdates(s, new Set([STEEL]), libraryWith({ [STEEL]: { kg: 0.5 } }));
    expect(s).toEqual(before);
  });
});
