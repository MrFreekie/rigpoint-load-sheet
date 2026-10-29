// Editor state: the open show, and a pure reducer for every edit the UI can make.
// Rows carry a transient `key` so React can track them through reordering; the
// show-file schema strips it on save.

import { ZONES, type Hang, type Row, type ZoneKey } from '../engine/types';
import type { ShowFile } from '../schema/show-file';
import { snapshotOf, type SpecItem } from '../schema/spec-library';

export interface EditorRow extends Row {
  key: string;
}

export interface EditorHang extends Omit<Hang, 'zones'> {
  zones: Record<ZoneKey, EditorRow[]>;
}

export interface EditorShow extends Omit<ShowFile, 'hangs'> {
  hangs: EditorHang[];
}

export type JobField = keyof EditorShow['job'];
export type HangField = 'name' | 'point_id' | 'over_people' | 'hoist_orientation' | 'top_rigging_included';
export type PointField = keyof Hang['point_capacity'];
export type RowPatch = Partial<Pick<Row, 'note' | 'qty' | 'length_m'>>;

export type EditorAction =
  | { type: 'load'; show: ShowFile }
  | { type: 'new'; specVersion: string }
  | { type: 'job'; field: JobField; value: EditorShow['job'][JobField] }
  | { type: 'hang'; field: HangField; value: Hang[HangField] }
  | { type: 'point'; field: PointField; value: Hang['point_capacity'][PointField] }
  | { type: 'row/add'; zone: ZoneKey }
  | { type: 'row/delete'; zone: ZoneKey; index: number }
  | { type: 'row/move'; zone: ZoneKey; index: number; delta: -1 | 1 }
  | { type: 'row/update'; zone: ZoneKey; index: number; patch: RowPatch }
  | { type: 'row/item'; zone: ZoneKey; index: number; item: SpecItem | null };

let nextKey = 1;
export function newKey(): string {
  return `r${nextKey++}`;
}

function withKeys(hang: Hang): EditorHang {
  const zones = Object.fromEntries(
    ZONES.map((z) => [z, hang.zones[z].map((r) => ({ ...r, key: newKey() }))]),
  ) as Record<ZoneKey, EditorRow[]>;
  return { ...hang, zones };
}

export function fromShowFile(show: ShowFile): EditorShow {
  return { ...show, hangs: show.hangs.map(withKeys) };
}

export function emptyRow(): EditorRow {
  return { key: newKey(), note: null, item: null, length_m: null, qty: 1, snapshot: null };
}

export function newShow(specVersion: string): EditorShow {
  return {
    format: 'loadsheet/1',
    app_version: __APP_VERSION__,
    spec_version: specVersion,
    saved_at: new Date().toISOString(),
    job: {
      name: '',
      date: null,
      designer: '',
      venue: '',
      status: 'draft',
      revision: '',
      contingency: 0.05,
      sheet_date: null,
    },
    hangs: [
      {
        id: 'h1',
        name: '',
        point_id: '',
        over_people: null,
        hoist_orientation: 'body_down',
        top_rigging_included: true,
        point_capacity: { kg: null, source: '', conditions: '', print: false },
        zones: { top_rigging: [], hoist: [], hook: [], path1: [], path2: [] },
      },
    ],
  };
}

/** True when the show has anything worth warning about before it is replaced. */
export function hasContent(show: EditorShow): boolean {
  const j = show.job;
  if (j.name || j.designer || j.venue || j.revision || j.date) return true;
  return show.hangs.some(
    (h) => h.name || h.point_id || ZONES.some((z) => h.zones[z].some((r) => r.item || r.note)),
  );
}

// The editor works on the first hang. The file format allows more, but one calculation is for one hang.
const HANG = 0;

export function currentHang(show: EditorShow): EditorHang {
  const hang = show.hangs[HANG];
  if (!hang) throw new Error('The show has no hang');
  return hang;
}

function updateHang(show: EditorShow, fn: (h: EditorHang) => EditorHang): EditorShow {
  return { ...show, hangs: show.hangs.map((h, i) => (i === HANG ? fn(h) : h)) };
}

function updateZone(show: EditorShow, zone: ZoneKey, fn: (rows: EditorRow[]) => EditorRow[]): EditorShow {
  return updateHang(show, (h) => ({ ...h, zones: { ...h.zones, [zone]: fn(h.zones[zone]) } }));
}

function updateRow(show: EditorShow, zone: ZoneKey, index: number, fn: (r: EditorRow) => EditorRow): EditorShow {
  return updateZone(show, zone, (rows) => rows.map((r, i) => (i === index ? fn(r) : r)));
}

export function editorReducer(show: EditorShow, action: EditorAction): EditorShow {
  switch (action.type) {
    case 'load':
      return fromShowFile(action.show);
    case 'new':
      return newShow(action.specVersion);
    case 'job':
      return { ...show, job: { ...show.job, [action.field]: action.value } };
    case 'hang':
      return updateHang(show, (h) => ({ ...h, [action.field]: action.value }));
    case 'point':
      return updateHang(show, (h) => ({ ...h, point_capacity: { ...h.point_capacity, [action.field]: action.value } }));
    case 'row/add':
      return updateZone(show, action.zone, (rows) => [...rows, emptyRow()]);
    case 'row/delete':
      return updateZone(show, action.zone, (rows) => rows.filter((_, i) => i !== action.index));
    case 'row/move':
      return updateZone(show, action.zone, (rows) => {
        const to = action.index + action.delta;
        if (to < 0 || to >= rows.length || action.index < 0 || action.index >= rows.length) return rows;
        const next = [...rows];
        const [moved] = next.splice(action.index, 1);
        next.splice(to, 0, moved as EditorRow);
        return next;
      });
    case 'row/update':
      return updateRow(show, action.zone, action.index, (r) => ({ ...r, ...action.patch }));
    case 'row/item':
      return updateRow(show, action.zone, action.index, (r) => {
        if (action.item === null) return { ...r, item: null, snapshot: null };
        // Snapshot the library values now, so the show stays self-contained.
        const snapshot = snapshotOf(action.item);
        return {
          ...r,
          item: action.item.name,
          snapshot,
          // Length only applies to per-metre items.
          length_m: snapshot.per === 'm' ? r.length_m : null,
        };
      });
  }
}
