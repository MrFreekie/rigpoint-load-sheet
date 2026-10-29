// Test support: loads the Spec library and scenarios, and builds engine hangs
// with snapshots the same way the app will when an item is chosen.

import libraryJson from '../../data/spec-library.json';
import workbookLibraryJson from '../../fixtures/spec-library.workbook.json';
import scenariosJson from '../../fixtures/scenarios.json';
import { ZONES, type Hang, type Row, type ZoneKey } from '../engine/types';
import { SpecLibrarySchema, snapshotOf, type SpecItem, type SpecLibrary } from '../schema/spec-library';

export const library: SpecLibrary = SpecLibrarySchema.parse(libraryJson);

/**
 * The Spec library as it was when the workbook produced the expected results in
 * fixtures/scenarios.json. The scenarios are checked against this frozen copy, so later
 * library changes (which go through review) never alter the workbook comparison.
 */
export const workbookLibrary: SpecLibrary = SpecLibrarySchema.parse(workbookLibraryJson);

export interface ScenarioRow {
  note: string | null;
  item: string | null;
  length_m: number | null;
  qty: number | null;
  /**
   * Test only: give a row with no item the snapshot of this library item, as a damaged
   * file could (the schema rejects it). The Python reference never reads this field.
   */
  snapshot_without_item?: string;
}

export interface ScenarioHang {
  name: string;
  point_id: string;
  over_people: boolean | null;
  hoist_orientation: 'body_down' | 'body_up';
  top_rigging_included: boolean;
  point_capacity: Hang['point_capacity'];
  zones: Record<ZoneKey, ScenarioRow[]>;
}

export interface Expected {
  total_static: number;
  design_load_point: number;
  data_ok: boolean;
  governing_item: string;
  governing_used: number;
  governing_ties: number;
  zone_used: Record<ZoneKey, number | null>;
  zone_item: Record<ZoneKey, string | null>;
  point_status: string;
  point_used: number | null;
}

export interface Scenario {
  id: string;
  title: string;
  contingency: number;
  hang: ScenarioHang;
  expected: Expected;
  spec_override?: Record<string, Partial<Pick<SpecItem, 'kg' | 'per' | 'swl_kg'>>>;
}

export const scenarios = (scenariosJson as { scenarios: Scenario[] }).scenarios;

/** Library lookup by name, with any per-scenario overrides applied. */
export function specLookup(overrides: Scenario['spec_override'] = {}, from: SpecLibrary = library): Map<string, SpecItem> {
  const map = new Map(from.items.map((i) => [i.name, { ...i }]));
  for (const [name, fields] of Object.entries(overrides)) {
    const item = map.get(name);
    if (!item) throw new Error(`spec_override names an item not in the library: ${name}`);
    Object.assign(item, fields);
  }
  return map;
}

/** Build an engine row, snapshotting from the library. Unknown items get no snapshot. */
export function buildRow(row: ScenarioRow, spec: Map<string, SpecItem>): Row {
  const { snapshot_without_item: stray, ...fields } = row;
  const name = fields.item ? fields.item : stray;
  const item = name ? spec.get(name) : undefined;
  return { ...fields, snapshot: item ? snapshotOf(item) : null };
}

export function buildHang(h: ScenarioHang, spec: Map<string, SpecItem>, id = 'h1'): Hang {
  const zones = Object.fromEntries(
    ZONES.map((z) => [z, (h.zones[z] ?? []).map((r) => buildRow(r, spec))]),
  ) as Record<ZoneKey, Row[]>;
  return { id, ...h, zones };
}

export function scenarioHang(s: Scenario): Hang {
  return buildHang(s.hang, specLookup(s.spec_override, workbookLibrary));
}

/** Round as Python's round() does for the values compared here. */
export function round(x: number, places: number): number {
  return Number(x.toFixed(places));
}
