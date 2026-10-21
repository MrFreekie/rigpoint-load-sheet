import { describe, expect, it } from 'vitest';
import { calculate } from '../engine/calculate';
import { ZONES } from '../engine/types';
import { exampleShow, library, libraryByName } from '../library';
import { ShowFileSchema } from '../schema/show-file';
import { editorReducer, fromShowFile, hasContent, newShow, type EditorAction, type EditorShow } from './editor';

const run = (show: EditorShow, ...actions: EditorAction[]) => actions.reduce(editorReducer, show);
const item = (name: string) => {
  const i = libraryByName.get(name);
  if (!i) throw new Error(name);
  return i;
};

describe('newShow', () => {
  const s = newShow(library.spec_version);

  it('starts as a valid, empty draft with 5% contingency, body down, top rigging included', () => {
    expect(ShowFileSchema.safeParse(s).success).toBe(true);
    expect(s.job).toMatchObject({ status: 'draft', revision: '', contingency: 0.05 });
    expect(s.hangs[0]).toMatchObject({ hoist_orientation: 'body_down', top_rigging_included: true, over_people: null });
    expect(hasContent(s)).toBe(false);
  });
});

describe('editorReducer', () => {
  it('loads the example with a key on every row', () => {
    const s = run(newShow('x'), { type: 'load', show: exampleShow() });
    const keys = ZONES.flatMap((z) => s.hangs[0]!.zones[z].map((r) => r.key));
    expect(keys).toHaveLength(16);
    expect(new Set(keys).size).toBe(16);
    expect(hasContent(s)).toBe(true);
  });

  it('round-trips through the show-file schema with keys stripped', () => {
    const s = fromShowFile(exampleShow());
    const parsed = ShowFileSchema.parse(s);
    expect(parsed).toEqual(exampleShow());
  });

  it('edits job, hang and point fields', () => {
    const s = run(
      newShow('x'),
      { type: 'job', field: 'name', value: 'The Ballroom' },
      { type: 'job', field: 'contingency', value: 0 },
      { type: 'hang', field: 'hoist_orientation', value: 'body_up' },
      { type: 'point', field: 'kg', value: 1000 },
    );
    expect(s.job.name).toBe('The Ballroom');
    expect(s.job.contingency).toBe(0);
    expect(s.hangs[0]!.hoist_orientation).toBe('body_up');
    expect(s.hangs[0]!.point_capacity.kg).toBe(1000);
  });

  it('adds a row and snapshots the chosen item', () => {
    const s = run(
      newShow('x'),
      { type: 'row/add', zone: 'path1' },
      { type: 'row/item', zone: 'path1', index: 0, item: item('L-Acoustics M-BUMP') },
    );
    expect(s.hangs[0]!.zones.path1[0]).toMatchObject({
      item: 'L-Acoustics M-BUMP',
      qty: 1,
      snapshot: { kg: 25, per: 'each', swl_kg: 832 },
    });
  });

  it('clears the length when an "each" item replaces a per-metre item', () => {
    const s = run(
      newShow('x'),
      { type: 'row/add', zone: 'path2' },
      { type: 'row/item', zone: 'path2', index: 0, item: item('H07RN-F 4x 2.5mm²') },
      { type: 'row/update', zone: 'path2', index: 0, patch: { length_m: 8 } },
    );
    expect(s.hangs[0]!.zones.path2[0]!.length_m).toBe(8);
    const t = run(s, { type: 'row/item', zone: 'path2', index: 0, item: item('Klotz L-ACOUSTICS DOFILL') });
    expect(t.hangs[0]!.zones.path2[0]!.length_m).toBeNull();
  });

  it('clears an item and its snapshot', () => {
    const s = run(fromShowFile(exampleShow()), { type: 'row/item', zone: 'path1', index: 0, item: null });
    expect(s.hangs[0]!.zones.path1[0]).toMatchObject({ item: null, snapshot: null, note: 'Rigging Frame' });
  });

  it('moves rows up and down, ignoring moves off either end', () => {
    const s = fromShowFile(exampleShow());
    const names = (x: EditorShow) => x.hangs[0]!.zones.path1.map((r) => r.item);
    const down = run(s, { type: 'row/move', zone: 'path1', index: 0, delta: 1 });
    expect(names(down)).toEqual(['L-Acoustics M-BUMP', 'L-Acoustics M-BAR', 'L-Acoustics KARA II']);
    expect(names(run(s, { type: 'row/move', zone: 'path1', index: 0, delta: -1 }))).toEqual(names(s));
    expect(names(run(s, { type: 'row/move', zone: 'path1', index: 2, delta: 1 }))).toEqual(names(s));
    // Keys travel with their rows.
    expect(down.hangs[0]!.zones.path1[1]!.key).toBe(s.hangs[0]!.zones.path1[0]!.key);
  });

  it('reordering changes the result: the M-BUMP above the M-BAR carries more', () => {
    const s = fromShowFile(exampleShow());
    const swapped = run(s, { type: 'row/move', zone: 'path1', index: 0, delta: 1 });
    const before = calculate(s.hangs[0]!, 0.05).zone_governing.path1!;
    const after = calculate(swapped.hangs[0]!, 0.05).zone_governing.path1!;
    expect(before.item).toBe('L-Acoustics M-BAR');
    expect(after.item).toBe('L-Acoustics M-BUMP');
  });

  it('deletes a row', () => {
    const s = run(fromShowFile(exampleShow()), { type: 'row/delete', zone: 'hoist', index: 2 });
    expect(s.hangs[0]!.zones.hoist.map((r) => r.note)).not.toContain('Hoist Chain Bag');
    expect(s.hangs[0]!.zones.hoist).toHaveLength(6);
  });

  it('does not mutate the previous state', () => {
    const s = fromShowFile(exampleShow());
    const copy = structuredClone(s);
    run(
      s,
      { type: 'row/update', zone: 'path1', index: 2, patch: { qty: 16 } },
      { type: 'row/move', zone: 'hook', index: 0, delta: 1 },
      { type: 'job', field: 'venue', value: 'X' },
    );
    expect(s).toEqual(copy);
  });

  it('new replaces everything', () => {
    const s = run(fromShowFile(exampleShow()), { type: 'new', specVersion: '2026-10-21' });
    expect(hasContent(s)).toBe(false);
  });
});
