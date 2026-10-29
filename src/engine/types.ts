// Types for the pure calculation engine. No DOM, framework or storage code here.

/** The five zones of a hang, always in this order (top of the rig to the bottom). */
export const ZONES = ['top_rigging', 'hoist', 'hook', 'path1', 'path2'] as const;
export type ZoneKey = (typeof ZONES)[number];

export const ZONE_NAMES: Record<ZoneKey, string> = {
  top_rigging: 'Top rigging',
  hoist: 'Hoist',
  hook: 'Hook / junction',
  path1: 'Load path 1 – array',
  path2: 'Load path 2 – cables',
};

export type Per = 'each' | 'm';

/** Library values copied into a row when an item is chosen. The engine reads only these. */
export interface Snapshot {
  /** Kilograms each, or kilograms per metre when `per` is "m". Null means TBC. */
  kg: number | null;
  per: Per;
  /** Safe / working load limit in kg, exactly as stored in the library. */
  swl_kg: number | null;
}

export interface Row {
  note: string | null;
  item: string | null;
  length_m: number | null;
  qty: number | null;
  snapshot: Snapshot | null;
}

export type HoistOrientation = 'body_down' | 'body_up';

export interface PointCapacity {
  kg: number | null;
  source: string;
  conditions: string;
  print: boolean;
}

export type Zones = Record<ZoneKey, Row[]>;

export interface Hang {
  id: string;
  name: string;
  point_id: string;
  over_people: boolean | null;
  hoist_orientation: HoistOrientation;
  top_rigging_included: boolean;
  point_capacity: PointCapacity;
  zones: Zones;
}

// ---------------------------------------------------------------------------
// Results

/**
 * Why a row is excluded from totals.
 * - TBC: the item has no recorded weight.
 * - LEN?: a per-metre item with no length.
 * - NOT FOUND: an item is named but the row has no snapshot to calculate from.
 */
export type RowFlag = 'TBC' | 'LEN?' | 'NOT FOUND';

/** Traffic light for a utilisation. Null when nothing is carried (used = 0). */
export type Light = 'ok' | 'check' | 'over';

export interface RowResult {
  zone: ZoneKey;
  /** Position within the zone, 0-based, top-down. */
  index: number;
  note: string | null;
  item: string | null;
  /** Snapshot kg (each or per metre), or null. */
  unit_kg: number | null;
  /** Weight of one line (kg, or kg × length for per-metre items). Null when flagged or no item. */
  line_kg: number | null;
  /** line_kg × qty. Null when flagged or no item; counts as 0 in totals. */
  total_kg: number | null;
  flag: RowFlag | null;
  /** True when the row has an item and its snapshot SWL is a number greater than 0. */
  rated: boolean;
  swl_kg: number | null;
  /** Present only for rated rows. */
  carried_static: number | null;
  carried_design: number | null;
  used: number | null;
  light: Light | null;
}

/** A rated row's check, in zone order then row order. */
export interface Check {
  zone: ZoneKey;
  index: number;
  note: string | null;
  item: string | null;
  swl_kg: number;
  carried_static: number;
  carried_design: number;
  used: number;
  light: Light | null;
}

export interface Governing extends Check {
  /** Number of other checks at the same utilisation (within 1e-9). */
  ties: number;
}

export interface FlagEntry {
  zone: ZoneKey;
  index: number;
  note: string | null;
  item: string | null;
  flag: RowFlag;
}

export type PointStatus = 'for_approval' | 'no_source' | 'exceeded' | 'recorded';

export type WarningCode =
  | 'contingency_zero'
  | 'top_rigging_included_but_empty'
  | 'top_rigging_excluded_but_listed';

export interface EngineWarning {
  code: WarningCode;
  message: string;
}

export interface HangResult {
  contingency: number;
  rows: Record<ZoneKey, RowResult[]>;
  subtotals: Record<ZoneKey, number>;
  total_static: number;
  contingency_kg: number;
  /** Static load at the point, unfactored. Equal to total_static. */
  static_load_point: number;
  design_load_point: number;

  flags: FlagEntry[];
  data_ok: boolean;
  data_check_message: string;

  checks: Check[];
  zone_governing: Record<ZoneKey, Governing | null>;
  governing: Governing | null;
  /** Text for the governing line, including any "(+N other …)" suffix. */
  governing_label: string;

  point_status: PointStatus;
  point_message: string;
  point_capacity_kg: number | null;
  point_used: number | null;
  point_light: Light | null;

  warnings: EngineWarning[];
}
