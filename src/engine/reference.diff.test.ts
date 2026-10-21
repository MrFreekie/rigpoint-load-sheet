// Differential test: the TypeScript engine must agree with reference/engine_reference.py
// on every value, for many random hangs. Needs Python 3; required in CI, skipped locally
// if no Python is found.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { randomCase } from '../testing/random-hang';
import { buildHang, specLookup } from '../testing/fixtures';
import { calculate } from './calculate';

const CASES = 400;
const root = fileURLToPath(new URL('../../', import.meta.url));

function findPython(): string | null {
  for (const cmd of ['python3', 'python']) {
    const r = spawnSync(cmd, ['-c', 'import sys; assert sys.version_info >= (3, 8)'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  return null;
}

interface RefResult {
  subtotals: Record<string, number>;
  total_static: number;
  design_load_point: number;
  data_ok: boolean;
  flags: string[];
  checks: { zone: string; item: string; carried_static: number; used: number }[];
  governing: { zone: string; item: string; used: number; ties: number } | null;
  point_status: string;
  point_used: number | null;
}

const python = findPython();
if (!python && process.env.CI) throw new Error('Python 3 is required for the reference differential test in CI');

describe.skipIf(!python)('agrees with engine_reference.py', () => {
  const cases = Array.from({ length: CASES }, (_, i) => randomCase(i + 1));

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

  const ref: RefResult[] = run.status === 0 ? (JSON.parse(run.stdout) as RefResult[]) : [];
  // The engine sums in the same order as the reference, so results match bit for bit.
  const close = (a: number, b: number) => a === b;

  it.each(cases.map((c, i) => [c.seed, i] as const))('seed %i', (seed, i) => {
    const c = cases[i]!;
    const want = ref[i]!;
    const got = calculate(buildHang(c.hang, specLookup()), c.contingency);
    const at = `seed ${seed}`;

    for (const [z, v] of Object.entries(want.subtotals)) {
      expect(close(got.subtotals[z as keyof typeof got.subtotals], v), `${at} subtotal ${z}`).toBe(true);
    }
    expect(close(got.total_static, want.total_static), at).toBe(true);
    expect(close(got.design_load_point, want.design_load_point), at).toBe(true);
    expect(got.data_ok, at).toBe(want.data_ok);
    expect(got.flags.map((f) => f.flag), at).toEqual(want.flags);

    expect(got.checks.length, at).toBe(want.checks.length);
    got.checks.forEach((chk, k) => {
      const w = want.checks[k]!;
      expect([chk.zone, chk.item], `${at} check ${k}`).toEqual([w.zone, w.item]);
      expect(close(chk.carried_static, w.carried_static), `${at} carried ${k}`).toBe(true);
      expect(close(chk.used, w.used), `${at} used ${k}`).toBe(true);
    });

    if (want.governing === null) {
      expect(got.governing, at).toBeNull();
    } else {
      expect(got.governing?.zone, at).toBe(want.governing.zone);
      expect(got.governing?.item, at).toBe(want.governing.item);
      expect(got.governing?.ties, at).toBe(want.governing.ties);
      expect(close(got.governing!.used, want.governing.used), at).toBe(true);
    }

    expect(got.point_status, at).toBe(want.point_status);
    if (want.point_used === null) expect(got.point_used, at).toBeNull();
    else expect(close(got.point_used!, want.point_used), at).toBe(true);
  });
});
