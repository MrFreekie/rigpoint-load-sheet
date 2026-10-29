// Autosave (layer 3): a safety net in this browser only. The saved file is the record.
// One record holds the current show while it has unsaved changes; it is removed once saved.

import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import { ShowFileSchema, type ShowFile } from '../schema/show-file';

export interface AutosaveRecord {
  version: 1;
  /** When the record was written (ms since epoch). */
  writtenAt: number;
  fileName: string | null;
  savedFingerprint: string;
  locked: boolean;
  show: ShowFile;
  /** The file to save back to (Chrome and Edge desktop). File handles can be stored in IndexedDB. */
  handle?: FileSystemFileHandle | null;
  /** When that file was last modified, as of the last time the app read or wrote it; null if unknown. */
  diskStamp?: number | null;
  /**
   * Set when the show was saved by download (layer 1) and not edited since: the browser cannot say
   * whether the file arrived, so this copy is kept as a safety net, but it is probably also in a file.
   * Any later autosave of an edited show is written without it.
   */
  savedByDownload?: boolean;
}

/** The storage the autosave needs; IndexedDB in the app, a Map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

const KEY = 'current-show';

export function indexedDbStore(): KeyValueStore {
  let store: UseStore | null = null;
  const s = () => (store ??= createStore('rigpoint-load-sheet', 'autosave'));
  return {
    get: (k) => get(k, s()),
    set: (k, v) => set(k, v, s()),
    del: (k) => del(k, s()),
  };
}

export function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => structuredClone(data.get(k)),
    set: async (k, v) => void data.set(k, structuredClone(v)),
    del: async (k) => void data.delete(k),
  };
}

/** A stored record, treated as untrusted: the record if it is well formed, otherwise null. */
function validRecord(value: unknown): AutosaveRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<AutosaveRecord>;
  const show = ShowFileSchema.safeParse(raw.show);
  const valid =
    raw.version === 1 &&
    typeof raw.writtenAt === 'number' &&
    (raw.fileName === null || typeof raw.fileName === 'string') &&
    typeof raw.savedFingerprint === 'string' &&
    typeof raw.locked === 'boolean' &&
    (raw.handle === undefined || raw.handle === null || typeof raw.handle === 'object') &&
    (raw.diskStamp === undefined || raw.diskStamp === null || typeof raw.diskStamp === 'number') &&
    (raw.savedByDownload === undefined || typeof raw.savedByDownload === 'boolean') &&
    show.success;
  return valid && show.success ? { ...(raw as AutosaveRecord), show: show.data } : null;
}

/** Read the autosave, treating it as untrusted. An unreadable record is removed. */
export async function readAutosave(store: KeyValueStore): Promise<AutosaveRecord | null> {
  const raw = await store.get(KEY);
  if (raw === undefined || raw === null) return null;
  const record = validRecord(raw);
  if (!record) await store.del(KEY);
  return record;
}

export async function writeAutosave(store: KeyValueStore, record: Omit<AutosaveRecord, 'version'>): Promise<void> {
  await store.set(KEY, { version: 1, ...record });
}

export async function clearAutosave(store: KeyValueStore): Promise<void> {
  await store.del(KEY);
}

// ---- Offers: records from an earlier session that the user has not yet answered.
//
// At start, whatever the live autosave holds (the previous session's last state) is moved to the
// offers, so the live autosave is free to keep the current show safe while the offers wait.
// Offers are kept under their own key until the user chooses Restore or Discard for each.
//
// Every change to the list is a read-modify-write on what is stored (never a write-back of a
// copy held in memory), one at a time in this tab and, where the browser has Web Locks, across
// tabs, so a record another tab added is never overwritten. A record is identified by its
// writtenAt (ms), which is also how a copy left by an interrupted move is recognised.
//
// Order: shows with unsaved work first, newest first; then shows that were saved by download
// and not edited since (the download may not have arrived, but they are probably in a file),
// newest first. At most MAX_OFFERS are kept; when there are more the last in that order go
// first, and the number removed is reported so the banner can say so.

const OFFERS_KEY = 'offered-shows';
export const MAX_OFFERS = 20;
const LOCK_NAME = 'rigpoint-load-sheet-offers';

export interface OfferList {
  offers: AutosaveRecord[];
  /** How many records the cap removed in this change. */
  removed: number;
}

/** For the banner: said when the cap removed older autosaved copies. */
export function removedOffersMessage(removed: number): string {
  return `${removed} older autosaved ${removed === 1 ? 'copy was' : 'copies were'} removed to make room.`;
}

const queues = new WeakMap<KeyValueStore, Promise<unknown>>();
function exclusive<T>(store: KeyValueStore, task: () => Promise<T>): Promise<T> {
  const guarded = () => {
    const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
    return locks ? locks.request(LOCK_NAME, task) : task();
  };
  const run = (queues.get(store) ?? Promise.resolve()).then(guarded, guarded);
  queues.set(store, run.catch(() => undefined));
  return run;
}

function order(records: readonly AutosaveRecord[]): AutosaveRecord[] {
  const flag = (r: AutosaveRecord) => (r.savedByDownload ? 1 : 0);
  return [...records].sort((a, b) => flag(a) - flag(b) || b.writtenAt - a.writtenAt);
}

/** One record per writtenAt, in offer order, within the cap. */
function tidy(records: readonly AutosaveRecord[]): OfferList {
  const unique = [...new Map(records.map((r) => [r.writtenAt, r])).values()];
  const ordered = order(unique);
  return { offers: ordered.slice(0, MAX_OFFERS), removed: Math.max(0, ordered.length - MAX_OFFERS) };
}

/** The offers waiting to be answered. Unreadable entries are ignored. */
export async function readOffers(store: KeyValueStore): Promise<AutosaveRecord[]> {
  const raw = await store.get(OFFERS_KEY);
  if (!Array.isArray(raw)) return [];
  return order(raw.flatMap((r) => validRecord(r) ?? []));
}

async function storeOffers(store: KeyValueStore, offers: readonly AutosaveRecord[]): Promise<void> {
  if (offers.length === 0) await store.del(OFFERS_KEY);
  else await store.set(OFFERS_KEY, offers);
}

/** Replace the list of offers (tests and set-up; the app changes the list with updateOffers). */
export const writeOffers = storeOffers;

/** Change the stored list: `change` receives what is stored now and returns the new list. */
export function updateOffers(store: KeyValueStore, change: (stored: AutosaveRecord[]) => AutosaveRecord[]): Promise<OfferList> {
  return exclusive(store, async () => {
    const result = tidy(change(await readOffers(store)));
    await storeOffers(store, result.offers);
    return result;
  });
}

/** The user answered this offer (Restore or Discard): take it off the stored list. */
export function removeOffer(store: KeyValueStore, writtenAt: number): Promise<OfferList> {
  return updateOffers(store, (stored) => stored.filter((o) => o.writtenAt !== writtenAt));
}

/**
 * Once at start: the offers to show. The live autosave (which an older version of the app also
 * used for its single offer) is added to the stored offers, saved under the offers key first and
 * only then removed from the live key, so a crash in between loses nothing and, being the same
 * record (same writtenAt), is not offered twice.
 */
export function collectOffers(store: KeyValueStore): Promise<OfferList> {
  return exclusive(store, async () => {
    const stored = await readOffers(store);
    const live = await readAutosave(store);
    if (!live) return tidy(stored);
    const result = tidy([live, ...stored]);
    await storeOffers(store, result.offers);
    await clearAutosave(store);
    return result;
  });
}
