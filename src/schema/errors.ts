// Turns Zod issues into plain-English messages that say which field is wrong.

import type { z } from 'zod';
import { ZONE_NAMES, type ZoneKey } from '../engine/types';

const FIELD_NAMES: Record<string, string> = {
  format: 'File format',
  app_version: 'App version',
  spec_version: 'Spec version',
  saved_at: 'Saved at',
  job: 'Job',
  name: 'name',
  date: 'Job Date',
  designer: 'Designer',
  venue: 'Venue',
  status: 'Status',
  revision: 'Revision',
  contingency: 'Contingency',
  sheet_date: 'Sheet Date',
  point_id: 'Point ID / Location',
  over_people: 'Load over people?',
  hoist_orientation: 'Hoist orientation',
  top_rigging_included: 'Top rigging included?',
  point_capacity: 'Point capacity',
  kg: 'kg',
  source: 'source',
  conditions: 'conditions',
  print: 'print',
  note: 'note',
  item: 'item',
  length_m: 'length (m)',
  qty: 'quantity',
  snapshot: 'snapshot',
  per: 'per',
  swl_kg: 'SWL',
  items: 'Items',
  hangs: 'Hangs',
  verified: 'verified',
};

function isZone(key: PropertyKey): key is ZoneKey {
  return typeof key === 'string' && key in ZONE_NAMES;
}

/** Describe a Zod issue path, e.g. "Hang 1, Load path 1 – array, row 3, quantity". */
export function describePath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (key === undefined) continue;
    if (key === 'hangs' && typeof next === 'number') {
      parts.push(`Hang ${next + 1}`);
      i++;
    } else if (key === 'zones') {
      continue;
    } else if (isZone(key)) {
      parts.push(ZONE_NAMES[key]);
      if (typeof next === 'number') {
        parts.push(`row ${next + 1}`);
        i++;
      }
    } else if (key === 'items' && typeof next === 'number') {
      parts.push(`Item ${next + 1}`);
      i++;
    } else if (typeof key === 'number') {
      parts.push(`entry ${key + 1}`);
    } else {
      parts.push(FIELD_NAMES[String(key)] ?? String(key));
    }
  }
  return parts.join(', ');
}

export function formatIssues(error: z.ZodError, limit = 5): string[] {
  const lines = error.issues.slice(0, limit).map((issue) => {
    const where = describePath(issue.path);
    return where ? `${where}: ${issue.message}` : issue.message;
  });
  const more = error.issues.length - limit;
  if (more > 0) lines.push(`…and ${more} more problem${more === 1 ? '' : 's'}.`);
  return lines;
}
