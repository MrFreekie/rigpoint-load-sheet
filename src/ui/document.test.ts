import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { clearAutosave, memoryStore, readAutosave, writeAutosave } from '../files/autosave';
import { contentFingerprint } from '../files/show-io';
import { libraryByName } from '../library';
import { ShowFileSchema, type JobStatus, type ShowFile } from '../schema/show-file';
import { docReducer, isDirty, newDoc, nextRevision, openedDoc, type DocAction, type Doc } from './document';

const file = (status: JobStatus = 'draft', revision = ''): ShowFile => {
  const f = ShowFileSchema.parse(structuredClone(ballroomJson));
  return { ...f, job: { ...f.job, status, revision, sheet_date: '2026-10-21' } };
};
const run = (doc: Doc, ...actions: DocAction[]) => actions.reduce(docReducer, doc);
const setVenue: DocAction = { type: 'edit', action: { type: 'job', field: 'venue', value: 'Grand Hotel' } };

describe('saved and unsaved', () => {
  it('a new show and a just-opened show have no unsaved changes', () => {
    expect(isDirty(newDoc('x'))).toBe(false);
    expect(isDirty(openedDoc(file(), 'a.loadsheet.json'))).toBe(false);
  });

  it('an edit makes it unsaved; undoing the edit makes it saved again', () => {
    const d = run(openedDoc(file(), null), setVenue);
    expect(isDirty(d)).toBe(true);
    expect(isDirty(run(d, { type: 'edit', action: { type: 'job', field: 'venue', value: '' } }))).toBe(false);
  });

  it('a show that fails validation counts as unsaved instead of throwing', () => {
    const d = openedDoc(file(), null);
    const bad = structuredClone(d.show);
    (bad.hangs[0]!.zones.path1[0] as { qty: number | null }).qty = 2 ** 53;
    expect(() => isDirty({ ...d, show: bad })).not.toThrow();
    expect(isDirty({ ...d, show: bad })).toBe(true);
  });

  it('saving clears the unsaved state and records the file name and spec version', () => {
    const edited = run(openedDoc(file(), null), setVenue);
    const d = run(edited, { type: 'saved', fileName: 'b.loadsheet.json', specVersion: '2026-11-04', fingerprint: contentFingerprint(edited.show) });
    expect(isDirty(d)).toBe(false);
    expect(d.fileName).toBe('b.loadsheet.json');
    expect(d.show.spec_version).toBe('2026-11-04');
  });

  it('an edit made while the save was in progress stays unsaved', () => {
    const atClick = run(openedDoc(file(), null), setVenue);
    const written = contentFingerprint(atClick.show);
    const during = run(atClick, { type: 'edit', action: { type: 'job', field: 'name', value: 'Changed during the save' } });
    const after = run(during, { type: 'saved', fileName: 'b.loadsheet.json', specVersion: '2026-11-04', fingerprint: written });
    expect(isDirty(after)).toBe(true);
    expect(after.show.job.name).toBe('Changed during the save');
    expect(after.fileName).toBe('b.loadsheet.json');
  });
});

describe('approval lock', () => {
  it.each(['approved', 'superseded'] as const)('%s files open read-only and ignore edits', (status) => {
    const d = openedDoc(file(status), 'x.loadsheet.json');
    expect(d.locked).toBe(true);
    const after = run(
      d,
      setVenue,
      { type: 'edit', action: { type: 'row/delete', zone: 'path1', index: 0 } },
      { type: 'library-update', items: new Set(['L-Acoustics M-BUMP']), library: libraryByName },
    );
    expect(after).toBe(d);
  });

  it.each(['draft', 'issued'] as const)('%s files open editable', (status) => {
    expect(openedDoc(file(status), null).locked).toBe(false);
  });

  it('changing status to approved during editing does not lock until reopened', () => {
    const d = run(openedDoc(file(), null), { type: 'edit', action: { type: 'job', field: 'status', value: 'approved' } }, setVenue);
    expect(d.locked).toBe(false);
    expect(d.show.job.venue).toBe('Grand Hotel');
  });
});

describe('create new revision', () => {
  const approvedA = openedDoc(file('approved', 'A'), 'The Ballroom - Main Hang Left - Rev A.loadsheet.json');
  const rev = run(approvedA, { type: 'new-revision' });

  it('is editable, draft, next revision, with an empty sheet date', () => {
    expect(rev.locked).toBe(false);
    expect(rev.show.job).toMatchObject({ status: 'draft', revision: 'B', sheet_date: null });
    expect(run(rev, setVenue).show.job.venue).toBe('Grand Hotel');
  });

  it('is a new, unsaved file and keeps the content of the original', () => {
    expect(rev.fileName).toBeNull();
    expect(isDirty(rev)).toBe(true);
    expect(rev.show.hangs).toEqual(approvedA.show.hangs);
  });

  it('leaves the original untouched', () => {
    expect(approvedA.show.job).toMatchObject({ status: 'approved', revision: 'A' });
  });

  it('starts at A after a blank first issue', () => {
    expect(run(openedDoc(file('approved', ''), null), { type: 'new-revision' }).show.job.revision).toBe('A');
  });

  it('asks for a revision when the old one is not a letter', () => {
    const d = run(openedDoc(file('approved', '3'), null), { type: 'new-revision' });
    expect(d.revisionNeeded).toBe(true);
    expect(d.show.job.revision).toBe('');
    expect(run(d, { type: 'edit', action: { type: 'job', field: 'revision', value: '4' } }).revisionNeeded).toBe(false);
  });
});

describe('nextRevision (letters, blank first)', () => {
  it.each([
    ['', 'A'],
    ['A', 'B'],
    ['b', 'C'],
    [' C ', 'D'],
    ['Z', 'AA'],
    ['AZ', 'BA'],
    ['ZZ', 'AAA'],
  ])('%j → %s', (from, to) => expect(nextRevision(from)).toBe(to));

  it.each(['1', 'A1', 'Rev A', 'B-2'])('%j → null', (from) => expect(nextRevision(from)).toBeNull());
});

describe('autosave storage', () => {
  const record = (d: Doc) => ({
    writtenAt: 1,
    fileName: d.fileName,
    savedFingerprint: d.savedFingerprint,
    locked: d.locked,
    show: ShowFileSchema.parse(d.show),
  });

  it('round-trips a record and restores the unsaved state', async () => {
    const store = memoryStore();
    const d = run(openedDoc(file(), 'a.loadsheet.json'), setVenue);
    await writeAutosave(store, record(d));
    const back = await readAutosave(store);
    expect(back).not.toBeNull();
    const restored = run(newDoc('x'), { type: 'restore', ...back! });
    expect(restored.show.job.venue).toBe('Grand Hotel');
    expect(restored.fileName).toBe('a.loadsheet.json');
    expect(isDirty(restored)).toBe(true);
    expect(contentFingerprint(restored.show)).toBe(contentFingerprint(d.show));
  });

  it('returns nothing when empty or cleared', async () => {
    const store = memoryStore();
    expect(await readAutosave(store)).toBeNull();
    await writeAutosave(store, record(newDoc('x')));
    await clearAutosave(store);
    expect(await readAutosave(store)).toBeNull();
  });

  it('keeps the file modified time and rejects one that is not a number', async () => {
    const store = memoryStore();
    const d = run(openedDoc(file(), 'a.loadsheet.json'), setVenue);
    await writeAutosave(store, { ...record(d), diskStamp: 1_700_000_000_000 });
    expect((await readAutosave(store))?.diskStamp).toBe(1_700_000_000_000);
    await writeAutosave(store, { ...record(d), diskStamp: 'soon' as unknown as number });
    expect(await readAutosave(store)).toBeNull();
  });

  it('discards an unreadable record', async () => {
    const store = memoryStore();
    store.data.set('current-show', { version: 1, show: { format: 'loadsheet/1' } });
    expect(await readAutosave(store)).toBeNull();
    expect(store.data.size).toBe(0);
  });
});
