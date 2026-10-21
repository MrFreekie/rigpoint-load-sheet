import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { ShowFileSchema } from '../schema/show-file';
import { round, scenarioHang, scenarios } from '../testing/fixtures';
import { calculate, lightFor } from './calculate';
import { DATA_CHECK_MISSING, DATA_CHECK_OK, NO_RATED_ITEMS, POINT_MESSAGES } from './messages';
import { ZONES, type Hang, type Row, type Snapshot, type ZoneKey } from './types';

// ---------------------------------------------------------------------------
// Scenarios from fixtures/scenarios.json (results from the recalculated workbook)

describe('scenarios', () => {
  it('has all nine scenarios', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['A', 'B', 'C1', 'C2', 'C3', 'D', 'E', 'F', 'G']);
  });

  describe.each(scenarios)('$id – $title', (s) => {
    const r = calculate(scenarioHang(s), s.contingency);
    const e = s.expected;

    it('total static weight', () => expect(round(r.total_static, 3)).toBe(e.total_static));
    it('design load at point', () => expect(round(r.design_load_point, 3)).toBe(e.design_load_point));
    it('data check', () => expect(r.data_ok).toBe(e.data_ok));
    it('governing item', () => expect(r.governing?.item).toBe(e.governing_item));
    it('governing used', () => expect(round(r.governing?.used ?? NaN, 4)).toBe(e.governing_used));
    it('governing ties', () => expect(r.governing?.ties).toBe(e.governing_ties));
    it('zone used', () => {
      const got = Object.fromEntries(
        ZONES.map((z) => [z, r.zone_governing[z] ? round(r.zone_governing[z].used, 4) : null]),
      );
      expect(got).toEqual(e.zone_used);
    });
    it('zone item', () => {
      const got = Object.fromEntries(ZONES.map((z) => [z, r.zone_governing[z]?.item ?? null]));
      expect(got).toEqual(e.zone_item);
    });
    it('point status', () => expect(r.point_status).toBe(e.point_status));
    it('point used', () =>
      expect(r.point_used === null ? null : round(r.point_used, 4)).toBe(e.point_used));
  });

  it('A–F report missing data because the steel weight is TBC', () => {
    for (const s of scenarios.filter((x) => x.id !== 'G')) {
      const r = calculate(scenarioHang(s), s.contingency);
      expect(r.data_ok, s.id).toBe(false);
      expect(r.data_check_message).toBe(DATA_CHECK_MISSING);
      expect(r.flags[0]).toEqual({
        zone: 'top_rigging',
        index: 0,
        note: 'Steel',
        item: 'Wire rope sling 10mm 1,280 Kg SWL EN13414-1:2003',
        flag: 'TBC',
      });
      // In D the two 8 mm steels at the junction are TBC as well.
      expect(r.flags.every((f) => f.flag === 'TBC'), s.id).toBe(true);
      expect(r.flags).toHaveLength(s.id === 'D' ? 3 : 1);
    }
  });

  it('D names the first of the tied steels and counts the other', () => {
    const s = scenarios.find((x) => x.id === 'D')!;
    const r = calculate(scenarioHang(s), s.contingency);
    expect(r.governing?.zone).toBe('hook');
    expect(r.governing?.index).toBe(0);
    expect(r.governing_label).toBe(
      'Wire rope sling 8mm 822 Kg SWL EN13414-1:2003 (+1 other at the same utilisation)',
    );
  });

  it('A zone subtotals match the workbook', () => {
    const s = scenarios.find((x) => x.id === 'A')!;
    const r = calculate(scenarioHang(s), s.contingency);
    expect(round(r.subtotals.top_rigging, 3)).toBe(0);
    expect(round(r.subtotals.hoist, 3)).toBe(85.334);
    expect(round(r.subtotals.hook, 3)).toBe(2.36);
    expect(round(r.subtotals.path1, 3)).toBe(342);
    expect(round(r.subtotals.path2, 3)).toBe(14.968);
    expect(round(r.contingency_kg, 3)).toBe(22.233);
    expect(r.static_load_point).toBe(r.total_static);
  });

  it('the Ballroom show file gives the same results as scenario A', () => {
    const show = ShowFileSchema.parse(ballroomJson);
    const hang = show.hangs[0]!;
    const fromFile = calculate(hang, show.job.contingency);
    const a = scenarios.find((x) => x.id === 'A')!;
    const fromScenario = calculate(scenarioHang(a), a.contingency);
    expect(fromFile.total_static).toBe(fromScenario.total_static);
    expect(fromFile.checks).toEqual(fromScenario.checks);
    expect(fromFile.governing).toEqual(fromScenario.governing);
  });
});

// ---------------------------------------------------------------------------
// Unit tests

const EACH = (kg: number | null, swl_kg: number | null = null): Snapshot => ({ kg, per: 'each', swl_kg });
const PER_M = (kg: number | null, swl_kg: number | null = null): Snapshot => ({ kg, per: 'm', swl_kg });

function row(item: string | null, snapshot: Snapshot | null, qty: number | null = 1, length_m: number | null = null, note: string | null = null): Row {
  return { note, item, length_m, qty, snapshot };
}

function hang(zones: Partial<Record<ZoneKey, Row[]>>, opts: Partial<Hang> = {}): Hang {
  return {
    id: 'h1',
    name: 'Test',
    point_id: '',
    over_people: null,
    hoist_orientation: 'body_down',
    top_rigging_included: false,
    point_capacity: { kg: null, source: '', conditions: '', print: false },
    zones: { top_rigging: [], hoist: [], hook: [], path1: [], path2: [], ...zones },
    ...opts,
  };
}

describe('row weights and flags', () => {
  it('per-metre item with no length is flagged LEN? and excluded', () => {
    for (const length of [null, 0]) {
      const r = calculate(hang({ path2: [row('Cable', PER_M(0.5), 2, length), row('Box', EACH(10))] }), 0.05);
      expect(r.rows.path2[0]).toMatchObject({ flag: 'LEN?', total_kg: null, unit_kg: 0.5, line_kg: null });
      expect(r.total_static).toBe(10);
      expect(r.data_ok).toBe(false);
      expect(r.flags).toEqual([{ zone: 'path2', index: 0, note: null, item: 'Cable', flag: 'LEN?' }]);
    }
  });

  it('per-metre item multiplies by length, then quantity', () => {
    const r = calculate(hang({ path2: [row('Cable', PER_M(0.5), 2, 8)] }), 0.05);
    expect(r.rows.path2[0]).toMatchObject({ line_kg: 4, total_kg: 8, flag: null });
  });

  it('length is ignored for "each" items', () => {
    const r = calculate(hang({ path1: [row('Box', EACH(26), 2, 99)] }), 0.05);
    expect(r.total_static).toBe(52);
  });

  it('TBC weight is flagged and excluded, but a rated TBC row is still checked', () => {
    const r = calculate(hang({ top_rigging: [row('Steel', PER_M(null, 1280), 1, 1)], path1: [row('Box', EACH(100))] }), 0);
    expect(r.rows.top_rigging[0]).toMatchObject({ flag: 'TBC', total_kg: null, rated: true });
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0]).toMatchObject({ zone: 'top_rigging', carried_static: 100, used: 100 / 1280 });
    expect(r.data_check_message).toBe(DATA_CHECK_MISSING);
  });

  it('quantity 0 or empty weighs nothing and is not a flag', () => {
    const r = calculate(hang({ path1: [row('A', EACH(10), 0), row('B', EACH(10), null)] }), 0.05);
    expect(r.rows.path1.map((x) => x.total_kg)).toEqual([0, 0]);
    expect(r.total_static).toBe(0);
    expect(r.data_ok).toBe(true);
    expect(r.data_check_message).toBe(DATA_CHECK_OK);
  });

  it('note-only rows weigh nothing, are not flagged, and stay in the row list', () => {
    const r = calculate(
      hang({ hoist: [row(null, null, 1, null, 'Hoist Chain Bag'), row('Hoist', EACH(54, 1000))] }),
      0.05,
    );
    expect(r.rows.hoist[0]).toMatchObject({ note: 'Hoist Chain Bag', item: null, total_kg: null, flag: null, rated: false });
    expect(r.total_static).toBe(54);
    expect(r.data_ok).toBe(true);
  });

  it('an item no longer in the library calculates from its snapshot', () => {
    // The engine never looks items up, so a name the library no longer has is not an error.
    const r = calculate(hang({ hook: [row('Old Shackle X', EACH(1.5, 2000), 2)] }), 0);
    expect(r.total_static).toBe(3);
    expect(r.data_ok).toBe(true);
    expect(r.checks[0]).toMatchObject({ item: 'Old Shackle X', swl_kg: 2000 });
  });

  it('an item with no snapshot is flagged NOT FOUND and excluded', () => {
    const r = calculate(hang({ path1: [row('Mystery', null), row('Box', EACH(10))] }), 0.05);
    expect(r.rows.path1[0]).toMatchObject({ flag: 'NOT FOUND', total_kg: null, rated: false });
    expect(r.total_static).toBe(10);
    expect(r.data_ok).toBe(false);
  });

  it('SWL of 0 or null is unrated', () => {
    const r = calculate(hang({ path1: [row('A', EACH(1, 0)), row('B', EACH(1, null)), row('C', EACH(1))] }), 0.05);
    expect(r.rows.path1.map((x) => x.rated)).toEqual([false, false, false]);
    expect(r.checks).toEqual([]);
  });
});

describe('empty zones', () => {
  const r = calculate(hang({}), 0.05);

  it('give zero totals', () => {
    expect(r.subtotals).toEqual({ top_rigging: 0, hoist: 0, hook: 0, path1: 0, path2: 0 });
    expect(r.total_static).toBe(0);
    expect(r.design_load_point).toBe(0);
  });

  it('have no governing component', () => {
    expect(r.governing).toBeNull();
    expect(r.governing_label).toBe(NO_RATED_ITEMS);
    for (const z of ZONES) expect(r.zone_governing[z]).toBeNull();
  });

  it('pass the data check', () => expect(r.data_ok).toBe(true));
});

describe('carried load', () => {
  const zones = {
    top_rigging: [row('Clamp', EACH(2, 2000)), row('Steel', EACH(1, 1000))],
    hoist: [row('Hoist', EACH(50, 1000)), row('Chain', PER_M(1.5), 1, 10), row('Bag', EACH(3, 500))],
    hook: [row('Shackle', EACH(0.5, 3000), 3), row('Link', EACH(1, 2500))],
    path1: [row('Bar', EACH(5, 800)), row('Bump', EACH(25, 800)), row('Box', EACH(26), 10)],
    path2: [row('Pick', EACH(0.1, 2000)), row('Cable', PER_M(0.7), 2, 8)],
  } satisfies Partial<Record<ZoneKey, Row[]>>;
  // hoist 68, hook 2.5, path1 290, path2 11.3, top 3
  const S = { top: 3, hoist: 68, hook: 2.5, path1: 290, path2: 11.3 };

  const carried = (r: ReturnType<typeof calculate>, zone: ZoneKey, index: number) =>
    r.checks.find((c) => c.zone === zone && c.index === index)?.carried_static;

  it('top rigging carries the rows below it plus every lower zone', () => {
    const r = calculate(hang(zones), 0);
    expect(carried(r, 'top_rigging', 0)).toBeCloseTo(1 + S.hoist + S.hook + S.path1 + S.path2, 9);
    expect(carried(r, 'top_rigging', 1)).toBeCloseTo(S.hoist + S.hook + S.path1 + S.path2, 9);
  });

  it('body down: every rated hoist-zone row carries the whole hoist zone plus the hook load', () => {
    const r = calculate(hang(zones), 0);
    const expected = S.hoist + S.hook + S.path1 + S.path2;
    expect(carried(r, 'hoist', 0)).toBeCloseTo(expected, 9);
    // The bag is last in the zone but still carries the whole zone, including its own weight.
    expect(carried(r, 'hoist', 2)).toBeCloseTo(expected, 9);
  });

  it('body up: hoist-zone rows carry only the hook load', () => {
    const r = calculate(hang(zones, { hoist_orientation: 'body_up' }), 0);
    expect(carried(r, 'hoist', 0)).toBeCloseTo(S.hook + S.path1 + S.path2, 9);
    expect(carried(r, 'hoist', 2)).toBeCloseTo(S.hook + S.path1 + S.path2, 9);
    // Top rigging is unchanged: the hoist zone hangs on it either way.
    expect(carried(r, 'top_rigging', 1)).toBeCloseTo(S.hoist + S.hook + S.path1 + S.path2, 9);
  });

  it('hook rows carry the rows below them plus both paths', () => {
    const r = calculate(hang(zones), 0);
    expect(carried(r, 'hook', 0)).toBeCloseTo(1 + S.path1 + S.path2, 9);
    expect(carried(r, 'hook', 1)).toBeCloseTo(S.path1 + S.path2, 9);
  });

  it('path rows carry only the rows below them in their own path', () => {
    const r = calculate(hang(zones), 0);
    expect(carried(r, 'path1', 0)).toBeCloseTo(25 + 260, 9);
    expect(carried(r, 'path1', 1)).toBeCloseTo(260, 9);
    expect(carried(r, 'path2', 0)).toBeCloseTo(11.2, 9);
  });

  it('a row never carries its own weight outside the body-down hoist zone', () => {
    const r = calculate(hang({ path1: [row('Bump', EACH(25, 800))], top_rigging: [row('Steel', EACH(5, 1000))] }), 0.05);
    expect(carried(r, 'path1', 0)).toBe(0);
    expect(carried(r, 'top_rigging', 0)).toBe(25);
  });

  it('qty > 1 is checked against the full load, never divided', () => {
    const r = calculate(hang({ hook: [row('Shackle', EACH(0.5, 1000), 4)], path1: [row('Box', EACH(100))] }), 0);
    expect(r.checks[0]).toMatchObject({ carried_static: 100, used: 0.1 });
  });

  it('applies contingency to every carried load', () => {
    const r = calculate(hang(zones), 0.1);
    for (const c of r.checks) {
      expect(c.carried_design).toBe(c.carried_static * 1.1);
      expect(c.used).toBe(c.carried_design / c.swl_kg);
    }
  });
});

describe('contingency', () => {
  it('0 gives design = static and a warning', () => {
    const r = calculate(hang({ path1: [row('Box', EACH(26), 2)] }), 0);
    expect(r.design_load_point).toBe(r.total_static);
    expect(r.contingency_kg).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain('contingency_zero');
  });

  it('5% gives no contingency warning', () => {
    const r = calculate(hang({ path1: [row('Box', EACH(26), 2)] }), 0.05);
    expect(r.warnings.map((w) => w.code)).not.toContain('contingency_zero');
    expect(r.design_load_point).toBe(52 * 1.05);
  });

  it.each([-0.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (c) => {
    expect(() => calculate(hang({}), c)).toThrow(RangeError);
  });
});

describe('rounding stays out of the engine', () => {
  it('keeps full floating-point precision in weights', () => {
    const r = calculate(hang({ path1: [row('A', EACH(0.1), 3)] }), 0.05);
    expect(r.total_static).toBe(0.1 * 3); // 0.30000000000000004, not 0.3
    expect(r.total_static).not.toBe(0.3);
    expect(r.design_load_point).toBe(0.1 * 3 * 1.05);
  });

  it('keeps full precision in utilisation', () => {
    const r = calculate(hang({ path1: [row('Bar', EACH(1, 3)), row('Box', EACH(1))] }), 0);
    expect(r.checks[0]!.used).toBe(1 / 3);
    expect(r.governing!.used).toBe(1 / 3);
  });

  it('keeps per-metre line weights unrounded', () => {
    const r = calculate(hang({ path2: [row('Cable', PER_M(0.6955), 2, 8)] }), 0.05);
    expect(r.rows.path2[0]!.line_kg).toBe(0.6955 * 8);
    expect(r.rows.path2[0]!.total_kg).toBe(0.6955 * 8 * 2);
  });
});

describe('governing component', () => {
  it('is the highest utilisation, not the lowest SWL', () => {
    const r = calculate(
      hang({
        hoist: [row('Big hoist', EACH(50, 2000))],
        path1: [row('Small bumper', EACH(5, 400)), row('Boxes', EACH(30), 10)],
      }),
      0,
    );
    expect(r.governing?.item).toBe('Small bumper');
    expect(r.governing?.used).toBe(300 / 400);
  });

  it('treats utilisations within 1e-9 as a tie and names the first in zone then row order', () => {
    const r = calculate(
      hang({
        hook: [row('Link', EACH(0, 1000))],
        path1: [row('Bar', EACH(0, 1000 * (1 + 1e-10))), row('Box', EACH(500))],
      }),
      0,
    );
    expect(r.governing?.item).toBe('Link');
    expect(r.governing?.ties).toBe(1);
    expect(r.governing_label).toBe('Link (+1 other at the same utilisation)');
  });

  it('does not treat a difference larger than 1e-9 as a tie', () => {
    const r = calculate(
      hang({
        hook: [row('Link', EACH(0, 1000))],
        path1: [row('Bar', EACH(0, 999.99)), row('Box', EACH(500))],
      }),
      0,
    );
    expect(r.governing?.item).toBe('Bar');
    expect(r.governing?.ties).toBe(0);
    expect(r.governing_label).toBe('Bar');
  });

  it('reports ties per zone too', () => {
    const r = calculate(hang({ path2: [row('A', EACH(0, 100)), row('B', EACH(0, 100))] }), 0.05);
    expect(r.zone_governing.path2).toMatchObject({ item: 'A', ties: 1, used: 0 });
  });
});

describe('traffic lights', () => {
  it.each([
    [0, null],
    [0.0001, 'ok'],
    [0.8499999, 'ok'],
    [0.85, 'check'],
    [1, 'check'],
    [1.0000001, 'over'],
  ])('%s → %s', (used, light) => expect(lightFor(used)).toBe(light));

  it('are attached to checks', () => {
    const r = calculate(hang({ path1: [row('Bump', EACH(0, 100)), row('Box', EACH(101))] }), 0);
    expect(r.checks[0]?.light).toBe('over');
    expect(r.rows.path1[0]?.light).toBe('over');
  });
});

describe('connection point', () => {
  const base = { path1: [row('Box', EACH(100), 4)] }; // 400 kg, 420 kg design at 5%
  const withCap = (kg: number | null, source = '') =>
    calculate(hang(base, { point_capacity: { kg, source, conditions: '', print: true } }), 0.05);

  it('no capacity → for approval', () => {
    for (const kg of [null, 0]) {
      const r = withCap(kg, 'Venue plot');
      expect(r.point_status).toBe('for_approval');
      expect(r.point_used).toBeNull();
      expect(r.point_message).toBe(POINT_MESSAGES.for_approval);
    }
  });

  it('capacity without a source → no_source, even if exceeded', () => {
    expect(withCap(1000).point_status).toBe('no_source');
    expect(withCap(100).point_status).toBe('no_source');
    expect(withCap(1000, '   ').point_status).toBe('no_source');
    expect(withCap(1000).point_used).toBe(0.42);
  });

  it('design load over capacity → exceeded', () => {
    const r = withCap(419, 'Venue plot');
    expect(r.point_status).toBe('exceeded');
    expect(r.point_light).toBe('over');
  });

  it('otherwise → recorded', () => {
    const r = withCap(420, 'Venue plot');
    expect(r.point_status).toBe('recorded');
    expect(r.point_used).toBe(1);
    expect(r.point_message).toBe(POINT_MESSAGES.recorded);
  });

  it('is not part of the equipment governing component', () => {
    const r = calculate(
      hang(
        { hook: [row('Link', EACH(1, 2500))], path1: [row('Box', EACH(100), 4)] },
        { point_capacity: { kg: 100, source: 'x', conditions: '', print: true } },
      ),
      0.05,
    );
    expect(r.point_used).toBeGreaterThan(1);
    expect(r.governing?.item).toBe('Link');
    expect(r.checks).toHaveLength(1);
  });
});

describe('soft warnings', () => {
  const codes = (h: Hang) => calculate(h, 0.05).warnings.map((w) => w.code);

  it('Yes with an empty top rigging zone', () => {
    expect(codes(hang({}, { top_rigging_included: true }))).toEqual(['top_rigging_included_but_empty']);
    // A note-only row is not a listed component.
    expect(codes(hang({ top_rigging: [row(null, null, 1, null, 'Steel')] }, { top_rigging_included: true }))).toEqual([
      'top_rigging_included_but_empty',
    ]);
  });

  it('No with top rigging items listed', () => {
    expect(codes(hang({ top_rigging: [row('Steel', EACH(1, 1000))] }, { top_rigging_included: false }))).toEqual([
      'top_rigging_excluded_but_listed',
    ]);
  });

  it('none when the flag matches the zone', () => {
    expect(codes(hang({ top_rigging: [row('Steel', EACH(1, 1000))] }, { top_rigging_included: true }))).toEqual([]);
    expect(codes(hang({}, { top_rigging_included: false }))).toEqual([]);
  });
});
