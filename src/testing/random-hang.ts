// Seeded random hangs built from real library items, for property and
// differential tests. Deterministic so a failure can be reproduced from its seed.

import { ZONES, type Hang, type ZoneKey } from '../engine/types';
import { buildHang, library, specLookup, type ScenarioHang, type ScenarioRow } from './fixtures';

/** mulberry32: small, fast, good enough for test data. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RandomCase {
  seed: number;
  contingency: number;
  hang: ScenarioHang;
}

export function randomCase(seed: number): RandomCase {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const rated = library.items.filter((i) => (i.swl_kg ?? 0) > 0);

  const zones = {} as Record<ZoneKey, ScenarioRow[]>;
  for (const z of ZONES) {
    zones[z] = Array.from({ length: int(0, 6) }, () => {
      const roll = r();
      if (roll < 0.1) return { note: 'Note only', item: null, length_m: null, qty: pick([1, null]) };
      // Bias towards rated items so there is plenty to check.
      const item = roll < 0.55 ? pick(rated) : pick(library.items);
      const length_m = item.per === 'm' ? pick([null, 0, 1, 2.5, 8, 20, 37.3]) : pick([null, null, 3]);
      const qty = pick([null, 0, 1, 1, 1, 2, 3, 12, int(0, 40)]);
      return { note: null, item: item.name, length_m, qty };
    });
  }

  const capKg = pick([null, null, 0, 250, 500, 1000, 2000]);
  return {
    seed,
    contingency: pick([0, 0.05, 0.05, 0.1, 0.123]),
    hang: {
      name: `Random ${seed}`,
      point_id: '',
      over_people: pick([true, false, null]),
      hoist_orientation: pick(['body_down', 'body_up'] as const),
      top_rigging_included: pick([true, false]),
      point_capacity: { kg: capKg, source: pick(['', 'Venue plot']), conditions: '', print: false },
      zones,
    },
  };
}

export function randomHang(seed: number): { hang: Hang; contingency: number } {
  const c = randomCase(seed);
  return { hang: buildHang(c.hang, specLookup()), contingency: c.contingency };
}
