// One test per show-file format version.

import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { SHOW_FORMAT } from '../schema/show-file';
import { migrate, MigrationError, MIGRATIONS } from './migrations';

describe('migrations', () => {
  it('current format is loadsheet/1', () => {
    expect(SHOW_FORMAT).toBe('loadsheet/1');
  });

  it('loadsheet/1 opens unchanged', () => {
    const r = migrate(structuredClone(ballroomJson));
    expect(r.from).toBeNull();
    expect(r.file).toEqual(ballroomJson);
  });

  it('every older format has a migration step', () => {
    const current = Number(SHOW_FORMAT.split('/')[1]);
    for (let v = 1; v < current; v++) expect(MIGRATIONS[`loadsheet/${v}`], `loadsheet/${v}`).toBeTypeOf('function');
  });

  it('refuses a newer format with a message rather than guessing', () => {
    expect(() => migrate({ format: 'loadsheet/99' })).toThrow(/newer version of the app/);
  });

  it.each(['loadsheet/01', 'loadsheet/1.0', 'loadsheet/ 1', 'loadsheet/1 ', 'loadsheet/+1', 'loadsheet/1e0', 'loadsheet/0x1', 'loadsheet/0', 'loadsheet/'])(
    'refuses the marker %j with a clear message rather than reading it as version 1',
    (format) => {
      const file = { ...structuredClone(ballroomJson), format };
      expect(() => migrate(file)).toThrow(MigrationError);
      expect(() => migrate(file)).toThrow(/is not one the app writes/);
    },
  );

  it('refuses a file with no loadsheet marker', () => {
    expect(() => migrate({ format: 'other/1' })).toThrow(/no "loadsheet\/…" format marker/);
    expect(() => migrate({})).toThrow(/no "loadsheet\/…" format marker/);
  });

  describe('the upgrade loop', () => {
    const v1 = { format: 'loadsheet/1', a: 1 };

    it('runs each step in turn and reports the original format', () => {
      const steps = {
        'loadsheet/1': (f: Record<string, unknown>) => ({ ...f, format: 'loadsheet/2', b: 2 }),
        'loadsheet/2': (f: Record<string, unknown>) => ({ ...f, format: 'loadsheet/3', c: 3 }),
      };
      const r = migrate(structuredClone(v1), steps, 'loadsheet/3');
      expect(r.file).toEqual({ format: 'loadsheet/3', a: 1, b: 2, c: 3 });
      expect(r.from).toBe('loadsheet/1');
    });

    it.each([
      ['returns the same format', 'loadsheet/1'],
      ['goes backwards', 'loadsheet/0'],
      ['skips past the current format', 'loadsheet/9'],
      ['returns a marker the app does not write', 'loadsheet/02'],
      ['drops the marker', undefined],
    ])('throws instead of looping when a step %s', (_, next) => {
      let calls = 0;
      const steps = {
        'loadsheet/1': (f: Record<string, unknown>) => {
          calls++;
          return { ...f, format: next };
        },
      };
      expect(() => migrate(structuredClone(v1), steps, 'loadsheet/3')).toThrow(/gave an invalid result/);
      expect(calls).toBe(1);
    });
  });
});
