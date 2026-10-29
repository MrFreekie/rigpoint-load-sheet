// Differential test: the TypeScript engine must agree with reference/engine_reference.py
// on every value (totals, per-row values, checks, lights, zone and overall governing,
// connection point), for many random hangs. Needs Python 3; required in CI, skipped locally
// if no Python is found.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { randomCase, type RandomCase } from '../testing/random-hang';
import { buildHang, specLookup } from '../testing/fixtures';
import { TIE_TOLERANCE, calculate } from './calculate';
import { ZONES, type Governing, type ZoneKey } from './types';

const CASES = 400;
const root = fileURLToPath(new URL('../../', import.meta.url));

function findPython(): string | null {
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['-c', 'import sys; assert sys.version_info >= (3, 8)'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  return null;
}

type Num = number | null;

interface RefGoverning {
  zone: string;
  item: string;
  used: number;
  ties: number;
}

interface RefRow {
  unit_kg: Num;
  line_kg: Num;
  total_kg: Num;
  swl_kg: Num;
  flag: string | null;
  rated: boolean;
  carried_static: Num;
  carried_design: Num;
  used: Num;
  light: string | null;
}

interface RefResult {
  subtotals: Record<string, number>;
  total_static: number;
  contingency_kg: number;
  design_load_point: number;
  data_ok: boolean;
  flags: string[];
  rows: Record<string, RefRow[]>;
  checks: { zone: string; item: string; carried_static: number; carried_design: number; used: number; light: string | null }[];
  zone_governing: Record<string, RefGoverning | null>;
  governing: RefGoverning | null;
  point_status: string;
  point_used: number | null;
  point_light: string | null;
}

/**
 * Two checks closer than the engine's tie tolerance but not equal. The engine and the
 * reference use different tie tolerances (1e-9 and 1e-12) and the workbook uses exact
 * equality; which is right awaits the owner, so such hangs are left out here and the
 * current behaviour is pinned in calculate.test.ts instead.
 */
function hasNearTie(c: RandomCase): boolean {
  const used = calculate(buildHang(c.hang, specLookup()), c.contingency).checks.map((k) => k.used);
  return used.some((a, i) => used.some((b, j) => i !== j && a !== b && Math.abs(a - b) < TIE_TOLERANCE));
}

function cleanCases(count: number): RandomCase[] {
  const out: RandomCase[] = [];
  for (let seed = 1; out.length < count; seed++) {
    const c = randomCase(seed);
    if (!hasNearTie(c)) out.push(c);
  }
  return out;
}

const python = findPython();
if (!python && process.env.CI) throw new Error('Python 3 is required for the reference differential test in CI');

describe.skipIf(!python)('agrees with engine_reference.py', () => {
  const cases = cleanCases(CASES);

  const run = spawnSync(python ?? 'python3', ['-I', 'scripts/reference_batch.py'], {
    cwd: root,
    input: JSON.stringify({ spec_path: 'data/spec-library.json', cases }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  it('reference ran', () => {
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('the cases include the awkward rows', () => {
    const rows = cases.flatMap((c) => ZONES.flatMap((z) => c.hang.zones[z]));
    expect(rows.filter((r) => r.item === '' || r.item === null).length).toBeGreaterThan(100);
    expect(rows.filter((r) => !r.item && r.snapshot_without_item).length).toBeGreaterThan(50);
    expect(rows.filter((r) => r.item?.startsWith('Not in library')).length).toBeGreaterThan(50);
    expect(rows.filter((r) => r.item && r.qty === null).length).toBeGreaterThan(50);
  });

  const ref: RefResult[] = run.status === 0 ? (JSON.parse(run.stdout) as RefResult[]) : [];
  // Same summation order as the reference, so on Python ≤ 3.11 results match bit for bit.
  // Python 3.12+ sum() uses compensated summation and can differ in the last bit, hence
  // a relative tolerance far below anything that could change a displayed figure.
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  const closeOrNull = (a: Num, b: Num) => (a === null || b === null ? a === b : close(a, b));

  const sameGoverning = (got: Governing | null, want: RefGoverning | null, at: string) => {
    if (want === null) {
      expect(got, at).toBeNull();
      return;
    }
    expect(got, at).not.toBeNull();
    expect([got!.zone, got!.item, got!.ties], at).toEqual([want.zone, want.item, want.ties]);
    expect(close(got!.used, want.used), `${at} used`).toBe(true);
  };

  it.each(cases.map((c, i) => [c.seed, i] as const))('seed %i', (seed, i) => {
    const c = cases[i]!;
    const want = ref[i]!;
    const got = calculate(buildHang(c.hang, specLookup()), c.contingency);
    const at = `seed ${seed}`;

    for (const [z, v] of Object.entries(want.subtotals)) {
      expect(close(got.subtotals[z as ZoneKey], v), `${at} subtotal ${z}`).toBe(true);
    }
    expect(close(got.total_static, want.total_static), `${at} total`).toBe(true);
    expect(close(got.contingency_kg, want.contingency_kg), `${at} contingency kg`).toBe(true);
    expect(close(got.design_load_point, want.design_load_point), `${at} design load`).toBe(true);
    expect(got.data_ok, at).toBe(want.data_ok);
    expect(got.flags.map((f) => f.flag), at).toEqual(want.flags);

    for (const z of ZONES) {
      const wantRows = want.rows[z]!;
      expect(got.rows[z].length, `${at} ${z} rows`).toBe(wantRows.length);
      got.rows[z].forEach((row, k) => {
        const w = wantRows[k]!;
        const where = `${at} ${z}[${k}]`;
        expect([row.flag, row.rated, row.light, row.swl_kg], where).toEqual([w.flag, w.rated, w.light, w.swl_kg]);
        for (const key of ['unit_kg', 'line_kg', 'total_kg', 'carried_static', 'carried_design', 'used'] as const) {
          expect(closeOrNull(row[key], w[key]), `${where} ${key}: ${String(row[key])} vs ${String(w[key])}`).toBe(true);
        }
      });
    }

    expect(got.checks.length, at).toBe(want.checks.length);
    got.checks.forEach((chk, k) => {
      const w = want.checks[k]!;
      expect([chk.zone, chk.item, chk.light], `${at} check ${k}`).toEqual([w.zone, w.item, w.light]);
      expect(close(chk.carried_static, w.carried_static), `${at} carried ${k}`).toBe(true);
      expect(close(chk.carried_design, w.carried_design), `${at} carried design ${k}`).toBe(true);
      expect(close(chk.used, w.used), `${at} used ${k}`).toBe(true);
    });

    for (const z of ZONES) sameGoverning(got.zone_governing[z], want.zone_governing[z]!, `${at} zone governing ${z}`);
    sameGoverning(got.governing, want.governing, `${at} governing`);

    expect(got.point_status, at).toBe(want.point_status);
    expect(closeOrNull(got.point_used, want.point_used), `${at} point used`).toBe(true);
    expect(got.point_light, `${at} point light`).toBe(want.point_light);
  });
});
