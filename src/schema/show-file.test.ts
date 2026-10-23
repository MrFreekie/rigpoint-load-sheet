import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { describePath, formatIssues } from './errors';
import { ShowFileSchema } from './show-file';

const fixture = () => structuredClone(ballroomJson) as Record<string, unknown> & typeof ballroomJson;

function problems(file: unknown): string[] {
  const r = ShowFileSchema.safeParse(file);
  expect(r.success).toBe(false);
  return formatIssues(r.error!);
}

describe('ShowFileSchema', () => {
  it('accepts the Ballroom fixture', () => {
    const r = ShowFileSchema.safeParse(ballroomJson);
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it('rejects the wrong format with a clear message', () => {
    expect(problems({ ...fixture(), format: 'loadsheet/99' })).toEqual([
      'File format: This is not a "loadsheet/1" show file',
    ]);
  });

  it('names the hang, zone and row of a bad quantity', () => {
    const f = fixture();
    (f.hangs[0]!.zones.path1[2] as { qty: unknown }).qty = -2;
    expect(problems(f)).toEqual(['Hang 1, Load path 1 – array, row 3, quantity: Quantity must not be negative']);
  });

  it('rejects a fractional quantity', () => {
    const f = fixture();
    (f.hangs[0]!.zones.hook[0] as { qty: unknown }).qty = 1.5;
    expect(problems(f)).toEqual(['Hang 1, Hook / junction, row 1, quantity: Quantity must be a whole number']);
  });

  it('rejects an item with no snapshot', () => {
    const f = fixture();
    (f.hangs[0]!.zones.path1[0] as { snapshot: unknown }).snapshot = null;
    expect(problems(f)).toEqual([
      'Hang 1, Load path 1 – array, row 1, snapshot: Item "L-Acoustics M-BAR" has no snapshot of its weight and SWL',
    ]);
  });

  it('rejects a weight and SWL on a row with no item', () => {
    const f = fixture();
    (f.hangs[0]!.zones.path1[0] as { item: unknown }).item = null;
    expect(problems(f)).toEqual([
      'Hang 1, Load path 1 – array, row 1, snapshot: A row with no item must not have a weight and SWL',
    ]);
    (f.hangs[0]!.zones.path1[0] as { item: unknown }).item = '';
    expect(problems(f)).toEqual([
      'Hang 1, Load path 1 – array, row 1, snapshot: A row with no item must not have a weight and SWL',
    ]);
  });

  it('rejects numbers too large to be real', () => {
    const f = fixture();
    (f.hangs[0]!.zones.path1[0] as { qty: unknown }).qty = 10_000;
    expect(problems(f)).toEqual(['Hang 1, Load path 1 – array, row 1, quantity: Quantity must be 9,999 or less']);

    const g = fixture();
    (g.hangs[0]!.point_capacity as { kg: unknown }).kg = 1e200;
    expect(problems(g)).toEqual(['Hang 1, Point capacity, kg: Point capacity must be 1,000,000 or less']);
  });

  it('accepts the largest allowed values', () => {
    const f = fixture();
    const row = f.hangs[0]!.zones.path1[0] as { qty: unknown; snapshot: { kg: unknown; swl_kg: unknown } };
    row.qty = 9_999;
    row.snapshot.kg = 100_000;
    row.snapshot.swl_kg = 1_000_000;
    expect(ShowFileSchema.safeParse(f).error?.issues ?? []).toEqual([]);
  });

  it('rejects an unknown status', () => {
    const f = fixture();
    (f.job as { status: unknown }).status = 'final';
    expect(problems(f)).toEqual(['Job, Status: Status must be draft, issued, approved or superseded']);
  });

  it('rejects a missing zone', () => {
    const f = fixture();
    delete (f.hangs[0]!.zones as Partial<typeof f.hangs[0]['zones']>).path2;
    expect(problems(f)).toEqual(['Hang 1, Load path 2 – cables: Zone must be a list of rows']);
  });

  it('rejects text where a number belongs', () => {
    const f = fixture();
    (f.job as { contingency: unknown }).contingency = '5%';
    expect(problems(f)).toEqual(['Job, Contingency: Contingency must be a number']);
  });

  it('rejects a show with no hangs', () => {
    expect(problems({ ...fixture(), hangs: [] })).toEqual(['Hangs: A show file must contain at least one hang']);
  });

  it('rejects something that is not a show file at all', () => {
    expect(ShowFileSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
    expect(ShowFileSchema.safeParse(null).success).toBe(false);
  });

  it('caps the number of messages', () => {
    const f = fixture();
    for (const row of f.hangs[0]!.zones.hoist) (row as { qty: unknown }).qty = 'x';
    const lines = problems(f);
    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe('…and 2 more problems.');
  });
});

describe('describePath', () => {
  it('handles top-level and nested fields', () => {
    expect(describePath(['saved_at'])).toBe('Saved at');
    expect(describePath(['hangs', 0, 'point_capacity', 'kg'])).toBe('Hang 1, Point capacity, kg');
    expect(describePath(['hangs', 1, 'zones', 'top_rigging', 0, 'snapshot', 'per'])).toBe(
      'Hang 2, Top rigging, row 1, snapshot, per',
    );
  });
});
