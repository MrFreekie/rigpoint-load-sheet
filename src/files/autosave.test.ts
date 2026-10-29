import { describe, expect, it } from 'vitest';
import ballroomJson from '../../fixtures/ballroom.loadsheet.json';
import { ShowFileSchema } from '../schema/show-file';
import {
  clearAutosave,
  collectOffers,
  MAX_OFFERS,
  memoryStore,
  readAutosave,
  readOffers,
  removeOffer,
  removedOffersMessage,
  updateOffers,
  writeAutosave,
  writeOffers,
  type AutosaveRecord,
  type KeyValueStore,
} from './autosave';

const show = ShowFileSchema.parse(structuredClone(ballroomJson));
const record = (writtenAt: number, name = 'Show', extra: Partial<AutosaveRecord> = {}): Omit<AutosaveRecord, 'version'> => ({
  writtenAt,
  fileName: null,
  savedFingerprint: '',
  locked: false,
  show: { ...show, job: { ...show.job, name } },
  ...extra,
});
const asOffer = (writtenAt: number, name?: string, extra?: Partial<AutosaveRecord>): AutosaveRecord => ({
  version: 1,
  ...record(writtenAt, name, extra),
});
const names = (offers: readonly AutosaveRecord[]) => offers.map((o) => o.show.job.name);

/** A store whose reads take a moment, so that overlapping read-modify-write cycles would clash. */
function slowStore(store: KeyValueStore): KeyValueStore {
  const wait = () => new Promise((r) => setTimeout(r, 5));
  return {
    get: async (k) => (await wait(), store.get(k)),
    set: async (k, v) => (await wait(), store.set(k, v)),
    del: async (k) => (await wait(), store.del(k)),
  };
}

describe('offers (autosaved shows from an earlier session)', () => {
  it('an existing record under the old key becomes the offer, and the live autosave is freed', async () => {
    const store = memoryStore();
    await writeAutosave(store, record(10, 'Old session'));
    const { offers, removed } = await collectOffers(store);
    expect(names(offers)).toEqual(['Old session']);
    expect(removed).toBe(0);
    expect(await readAutosave(store)).toBeNull();
    expect(names(await readOffers(store))).toEqual(['Old session']);
  });

  it('with nothing stored there is nothing to offer', async () => {
    expect((await collectOffers(memoryStore())).offers).toEqual([]);
  });

  it('an offer that was ignored and the live record of the next session are both offered, newest first', async () => {
    const store = memoryStore();
    await writeOffers(store, [asOffer(10, 'A')]);
    await writeAutosave(store, record(20, 'B'));
    expect(names((await collectOffers(store)).offers)).toEqual(['B', 'A']);
    // They stay offered until answered, even if the app is started again.
    expect(names((await collectOffers(store)).offers)).toEqual(['B', 'A']);
  });

  it('writing the live autosave does not touch the offers, and clearing it does not either', async () => {
    const store = memoryStore();
    await writeOffers(store, [asOffer(10, 'A')]);
    await writeAutosave(store, record(20, 'B'));
    await clearAutosave(store);
    expect(names(await readOffers(store))).toEqual(['A']);
  });

  it('ignores unreadable entries and removes the key when the list is emptied', async () => {
    const store = memoryStore();
    store.data.set('offered-shows', [{ nope: 1 }, 'x', asOffer(5, 'Good')]);
    expect(names(await readOffers(store))).toEqual(['Good']);
    await writeOffers(store, []);
    expect(store.data.has('offered-shows')).toBe(false);
  });
});

describe('offers: several changes at once, and other tabs', () => {
  it('two changes at the same time are both kept', async () => {
    const memory = memoryStore();
    const store = slowStore(memory);
    await Promise.all([
      updateOffers(store, (o) => [...o, asOffer(1, 'From this tab')]),
      updateOffers(store, (o) => [...o, asOffer(2, 'From another tab')]),
      collectOffers(store),
    ]);
    expect(names(await readOffers(memory)).sort()).toEqual(['From another tab', 'From this tab']);
  });

  it('answering an offer never writes back a stale copy: a record another tab added since is kept', async () => {
    const store = memoryStore();
    await writeOffers(store, [asOffer(1, 'A')]);
    // This tab last saw only [A]. Another tab then adds B.
    await updateOffers(store, (o) => [...o, asOffer(2, 'B')]);
    const after = await removeOffer(store, 1);
    expect(names(after.offers)).toEqual(['B']);
    expect(names(await readOffers(store))).toEqual(['B']);
  });

  it('a crash between writing the list and clearing the live key does not offer the show twice', async () => {
    const store = memoryStore();
    // The list was written (with the live record in it) but the live key was never cleared.
    await writeOffers(store, [asOffer(30, 'Crashed show')]);
    await writeAutosave(store, record(30, 'Crashed show'));
    const { offers } = await collectOffers(store);
    expect(names(offers)).toEqual(['Crashed show']);
    expect(await readAutosave(store)).toBeNull();
  });
});

describe('offers: kinds of record', () => {
  it('a locked (approved or superseded) record stays locked', async () => {
    const store = memoryStore();
    await writeAutosave(store, record(5, 'Approved show', { locked: true }));
    const { offers } = await collectOffers(store);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.locked).toBe(true);
    expect((await readOffers(store))[0]?.locked).toBe(true);
  });

  it('shows saved by download come after shows with unsaved work, even when newer', async () => {
    const store = memoryStore();
    await writeOffers(store, [asOffer(10, 'Unsaved work')]);
    await writeAutosave(store, record(20, 'Downloaded', { savedByDownload: true }));
    expect(names((await collectOffers(store)).offers)).toEqual(['Unsaved work', 'Downloaded']);
  });

  it('rejects a savedByDownload that is not a boolean', async () => {
    const store = memoryStore();
    await writeAutosave(store, { ...record(1), savedByDownload: 'yes' as unknown as boolean });
    expect(await readAutosave(store)).toBeNull();
  });
});

describe('offers: the cap', () => {
  it('keeps MAX_OFFERS, says how many it removed, and removes downloaded shows before unsaved work', async () => {
    const store = memoryStore();
    const downloaded = Array.from({ length: 3 }, (_, i) => asOffer(100 + i, `D${i}`, { savedByDownload: true }));
    const unsaved = Array.from({ length: MAX_OFFERS }, (_, i) => asOffer(i + 1, `U${i}`));
    await writeOffers(store, [...downloaded, ...unsaved]); // bypasses the cap: over it by 3
    await writeAutosave(store, record(500, 'Newest'));
    const { offers, removed } = await collectOffers(store);
    expect(offers).toHaveLength(MAX_OFFERS);
    expect(removed).toBe(4); // 3 downloaded and 1 more over the cap
    expect(names(offers)[0]).toBe('Newest');
    expect(names(offers).filter((n) => n.startsWith('D'))).toEqual([]);
    expect(names(offers)).not.toContain('U0'); // the oldest unsaved one went last
    expect(names(offers)).toContain('U1');
  });

  it('words the message for one and for several', () => {
    expect(removedOffersMessage(1)).toBe('1 older autosaved copy was removed to make room.');
    expect(removedOffersMessage(4)).toBe('4 older autosaved copies were removed to make room.');
  });

  it('removes nothing when there is room', async () => {
    const store = memoryStore();
    await writeAutosave(store, record(1));
    expect((await collectOffers(store)).removed).toBe(0);
  });
});
