import { describe, expect, it } from 'vitest';
import { randomHang, rng } from '../testing/random-hang';
import { calculate } from './calculate';
import { ZONES, type Hang } from './types';

const CASES = 500;

function usedByRow(h: Hang, contingency: number): Map<string, number> {
  const r = calculate(h, contingency);
  return new Map(r.checks.map((c) => [`${c.zone}:${c.index}`, c.used]));
}

describe('property: increasing a quantity never decreases any utilisation', () => {
  it(`holds for ${CASES} random hangs`, () => {
    let compared = 0;
    for (let seed = 1; seed <= CASES; seed++) {
      const { hang, contingency } = randomHang(seed);
      const before = usedByRow(hang, contingency);
      const r = rng(seed * 7919);

      for (const zone of ZONES) {
        hang.zones[zone].forEach((row, i) => {
          const bigger = structuredClone(hang);
          bigger.zones[zone][i] = { ...row, qty: (row.qty ?? 0) + 1 + Math.floor(r() * 10) };
          const after = usedByRow(bigger, contingency);

          expect(after.size, `seed ${seed}`).toBe(before.size);
          for (const [key, used] of before) {
            const now = after.get(key);
            expect(now, `seed ${seed}, raised ${zone}[${i}], check ${key}`).toBeDefined();
            expect(now!, `seed ${seed}, raised ${zone}[${i}], check ${key}`).toBeGreaterThanOrEqual(used);
            compared++;
          }
        });
      }
    }
    expect(compared).toBeGreaterThan(10_000);
  });
});
