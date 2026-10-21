// Static load-path calculation for one hang. See BRIEF.md section 6 and
// reference/engine_reference.py. Pure: values in, values out. Never rounds.

import {
  DATA_CHECK_MISSING,
  DATA_CHECK_OK,
  NO_RATED_ITEMS,
  POINT_MESSAGES,
  WARNING_MESSAGES,
  tieSuffix,
} from './messages';
import {
  ZONES,
  type Check,
  type EngineWarning,
  type FlagEntry,
  type Governing,
  type Hang,
  type HangResult,
  type Light,
  type PointStatus,
  type Row,
  type RowFlag,
  type RowResult,
  type ZoneKey,
} from './types';

/** Utilisations closer than this are treated as equal when naming the governing component. */
export const TIE_TOLERANCE = 1e-9;

/** Amber from this utilisation (inclusive); red above 1.00. */
export const CHECK_THRESHOLD = 0.85;

export function lightFor(used: number): Light | null {
  if (used > 1) return 'over';
  if (used >= CHECK_THRESHOLD) return 'check';
  if (used > 0) return 'ok';
  return null;
}

export function isRated(swl: number | null | undefined): swl is number {
  return typeof swl === 'number' && Number.isFinite(swl) && swl > 0;
}

interface Line {
  unit_kg: number | null;
  line_kg: number | null;
  total_kg: number | null;
  flag: RowFlag | null;
}

function line(row: Row): Line {
  if (!row.item) return { unit_kg: null, line_kg: null, total_kg: null, flag: null };
  const s = row.snapshot;
  if (s === null) return { unit_kg: null, line_kg: null, total_kg: null, flag: 'NOT FOUND' };
  if (s.kg === null) return { unit_kg: null, line_kg: null, total_kg: null, flag: 'TBC' };
  let lineKg: number;
  if (s.per === 'm') {
    const length = row.length_m ?? 0;
    if (!length) return { unit_kg: s.kg, line_kg: null, total_kg: null, flag: 'LEN?' };
    lineKg = s.kg * length;
  } else {
    lineKg = s.kg;
  }
  return { unit_kg: s.kg, line_kg: lineKg, total_kg: lineKg * (row.qty ?? 0), flag: null };
}

function sumTotals(rows: readonly RowResult[]): number {
  let sum = 0;
  for (const r of rows) sum += r.total_kg ?? 0;
  return sum;
}

function governing(checks: readonly Check[]): Governing | null {
  if (checks.length === 0) return null;
  let top = -Infinity;
  for (const c of checks) if (c.used > top) top = c.used;
  const tied = checks.filter((c) => Math.abs(c.used - top) < TIE_TOLERANCE);
  const first = tied[0] as Check;
  return { ...first, ties: tied.length - 1 };
}

function zoneRecord<T>(make: (zone: ZoneKey) => T): Record<ZoneKey, T> {
  return Object.fromEntries(ZONES.map((z) => [z, make(z)])) as Record<ZoneKey, T>;
}

/**
 * Calculate one hang.
 *
 * @param contingency job-level fraction, e.g. 0.05 for 5%. Must be finite and not negative.
 */
export function calculate(hang: Hang, contingency: number): HangResult {
  if (!Number.isFinite(contingency) || contingency < 0) {
    throw new RangeError(`Contingency must be a number of 0 or more, got ${String(contingency)}`);
  }
  const factor = 1 + contingency;

  // Line weights and flags.
  const rows = zoneRecord<RowResult[]>((zone) =>
    (hang.zones[zone] ?? []).map((row, index) => {
      const ln = line(row);
      const swl = row.snapshot?.swl_kg ?? null;
      return {
        zone,
        index,
        note: row.note,
        item: row.item,
        ...ln,
        rated: isRated(swl),
        swl_kg: swl,
        carried_static: null,
        carried_design: null,
        used: null,
        light: null,
      };
    }),
  );

  const subtotals = zoneRecord((z) => sumTotals(rows[z]));
  const belowHook = subtotals.path1 + subtotals.path2;
  const bodyUp = hang.hoist_orientation === 'body_up';

  // Carried load for each rated row (BRIEF.md 6.3).
  const checks: Check[] = [];
  for (const zone of ZONES) {
    const zoneRows = rows[zone];
    zoneRows.forEach((r, i) => {
      if (!r.rated || r.swl_kg === null) return;
      const below = sumTotals(zoneRows.slice(i + 1));
      let carried: number;
      switch (zone) {
        case 'top_rigging':
          carried = below + subtotals.hoist + subtotals.hook + belowHook;
          break;
        case 'hoist':
          carried = (bodyUp ? 0 : subtotals.hoist) + subtotals.hook + belowHook;
          break;
        case 'hook':
          carried = below + belowHook;
          break;
        case 'path1':
        case 'path2':
          carried = below;
          break;
      }
      const design = carried * factor;
      const used = design / r.swl_kg;
      const light = lightFor(used);
      r.carried_static = carried;
      r.carried_design = design;
      r.used = used;
      r.light = light;
      checks.push({
        zone,
        index: i,
        note: r.note,
        item: r.item,
        swl_kg: r.swl_kg,
        carried_static: carried,
        carried_design: design,
        used,
        light,
      });
    });
  }

  const total = ZONES.reduce((sum, z) => sum + subtotals[z], 0);
  const designPoint = total * factor;

  const flags: FlagEntry[] = [];
  for (const zone of ZONES) {
    for (const r of rows[zone]) {
      if (r.flag) flags.push({ zone, index: r.index, note: r.note, item: r.item, flag: r.flag });
    }
  }
  const dataOk = flags.length === 0;

  const zoneGoverning = zoneRecord((z) => governing(checks.filter((c) => c.zone === z)));
  const overall = governing(checks);
  const governingLabel = overall
    ? `${overall.item ?? overall.note ?? ''}${tieSuffix(overall.ties)}`
    : NO_RATED_ITEMS;

  // Connection point (BRIEF.md 6.6). Not part of the equipment governing component.
  const cap = hang.point_capacity.kg;
  let pointStatus: PointStatus;
  let pointUsed: number | null = null;
  let pointCap: number | null = null;
  if (cap === null || !(cap > 0)) {
    pointStatus = 'for_approval';
  } else {
    pointCap = cap;
    pointUsed = designPoint / cap;
    if (hang.point_capacity.source.trim() === '') pointStatus = 'no_source';
    else if (pointUsed > 1) pointStatus = 'exceeded';
    else pointStatus = 'recorded';
  }

  const warnings: EngineWarning[] = [];
  const warn = (code: EngineWarning['code']) => warnings.push({ code, message: WARNING_MESSAGES[code] });
  if (contingency === 0) warn('contingency_zero');
  const topRiggingListed = rows.top_rigging.some((r) => Boolean(r.item));
  if (hang.top_rigging_included && !topRiggingListed) warn('top_rigging_included_but_empty');
  if (!hang.top_rigging_included && topRiggingListed) warn('top_rigging_excluded_but_listed');

  return {
    contingency,
    rows,
    subtotals,
    total_static: total,
    contingency_kg: total * contingency,
    static_load_point: total,
    design_load_point: designPoint,
    flags,
    data_ok: dataOk,
    data_check_message: dataOk ? DATA_CHECK_OK : DATA_CHECK_MISSING,
    checks,
    zone_governing: zoneGoverning,
    governing: overall,
    governing_label: governingLabel,
    point_status: pointStatus,
    point_message: POINT_MESSAGES[pointStatus],
    point_capacity_kg: pointCap,
    point_used: pointUsed,
    point_light: pointUsed === null ? null : lightFor(pointUsed),
    warnings,
  };
}
