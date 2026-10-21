import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { calculate } from '../engine/calculate';
import { fromShowFile } from '../ui/editor';
import { contentFingerprint, isoWithOffset, MAX_FILE_BYTES, parseShowFile, serialiseShow, toShowFile } from './show-io';

const ballroomText = JSON.stringify(ballroomJson);
const stamp = { appVersion: '0.1.0', specVersion: '2026-10-21', savedAt: new Date('2026-10-21T15:00:00Z') };

describe('parseShowFile', () => {
  it('opens the Ballroom fixture', () => {
    const r = parseShowFile(ballroomText);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.show.job.name).toBe('The Ballroom');
      expect(r.migratedFrom).toBeNull();
    }
  });

  it('accepts a byte-order mark', () => {
    expect(parseShowFile(String.fromCharCode(0xfeff) + ballroomText).ok).toBe(true);
  });

  it.each([
    ['not JSON', '{ this is not json', 'The file is not valid JSON, so it cannot be a show file.'],
    ['a JSON array', '[1, 2, 3]', 'This is not a Load Sheet show file (it does not contain a JSON object).'],
    ['JSON without a format', '{"job": {}}', 'This is not a Load Sheet show file (it has no "loadsheet/…" format marker).'],
    ['the Spec library', '{"format": "loadsheet-spec/1", "items": []}', 'This is not a Load Sheet show file (it has no "loadsheet/…" format marker).'],
  ])('rejects %s with a plain message', (_label, text, message) => {
    expect(parseShowFile(text)).toEqual({ ok: false, message, details: [] });
  });

  it('rejects a file from a newer version of the app', () => {
    const r = parseShowFile(JSON.stringify({ ...ballroomJson, format: 'loadsheet/2' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/newer version of the app/);
  });

  it('rejects an oversized file', () => {
    const r = parseShowFile(' '.repeat(MAX_FILE_BYTES + 1));
    expect(r).toEqual({ ok: false, message: 'The file is too large to be a show file.', details: [] });
  });

  it('says which field is wrong', () => {
    const bad = structuredClone(ballroomJson);
    (bad.hangs[0]!.zones.path1[2] as { qty: unknown }).qty = 'twelve';
    const r = parseShowFile(JSON.stringify(bad));
    expect(r).toEqual({
      ok: false,
      message: 'The file is a show file, but some of its contents are not valid:',
      details: ['Hang 1, Load path 1 – array, row 3, quantity: Quantity must be a number'],
    });
  });

  it('keeps text as text: markup in a note is just characters', () => {
    const f = structuredClone(ballroomJson);
    f.hangs[0]!.zones.path1[0]!.note = '<img src=x onerror=alert(1)>';
    const r = parseShowFile(JSON.stringify(f));
    expect(r.ok && r.show.hangs[0]!.zones.path1[0]!.note).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('round trip: open, edit, save, reopen', () => {
  it('gives identical content and identical results', () => {
    const opened = parseShowFile(ballroomText);
    if (!opened.ok) throw new Error('fixture did not open');
    const edited = fromShowFile(opened.show);
    edited.hangs[0]!.zones.path1[2]!.qty = 16;
    edited.job.venue = 'Grand Hotel – Ballroom';

    const text = serialiseShow(toShowFile(edited, stamp));
    const reopened = parseShowFile(text);
    if (!reopened.ok) throw new Error(reopened.message);

    expect(contentFingerprint(reopened.show)).toBe(contentFingerprint(edited));
    expect(calculate(reopened.show.hangs[0]!, reopened.show.job.contingency)).toEqual(
      calculate(edited.hangs[0]!, edited.job.contingency),
    );
    // Saving again without changes writes the same bytes.
    expect(serialiseShow(toShowFile(reopened.show, stamp))).toBe(text);
  });

  it('does not write the editor row keys', () => {
    const text = serialiseShow(toShowFile(fromShowFile(ballroomJson as never), stamp));
    expect(text).not.toMatch(/"key"/);
  });

  it('stamps app version, spec version and local time with offset', () => {
    const f = toShowFile(ballroomJson, { ...stamp, appVersion: '9.9.9', specVersion: '2026-11-04' });
    expect(f.app_version).toBe('9.9.9');
    expect(f.spec_version).toBe('2026-11-04');
    expect(f.saved_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });
});

describe('isoWithOffset', () => {
  it('describes the same instant', () => {
    const d = new Date('2026-10-21T15:04:05Z');
    expect(new Date(isoWithOffset(d)).getTime()).toBe(d.getTime());
  });
});

describe('contentFingerprint', () => {
  it('ignores the save stamp but not content', () => {
    const a = contentFingerprint(ballroomJson);
    expect(contentFingerprint({ ...ballroomJson, saved_at: '2030-01-01T00:00:00+00:00', app_version: 'x' })).toBe(a);
    expect(contentFingerprint({ ...ballroomJson, job: { ...ballroomJson.job, venue: 'X' } })).not.toBe(a);
  });
});
