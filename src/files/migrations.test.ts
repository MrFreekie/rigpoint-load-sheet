// One test per show-file format version.

import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { SHOW_FORMAT } from '../schema/show-file';
import { migrate, MIGRATIONS } from './migrations';

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
});
