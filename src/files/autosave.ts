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

/** Read the autosave, treating it as untrusted. An unreadable record is removed. */
export async function readAutosave(store: KeyValueStore): Promise<AutosaveRecord | null> {
  const raw = (await store.get(KEY)) as Partial<AutosaveRecord> | undefined;
  if (raw === undefined || raw === null) return null;
  const show = ShowFileSchema.safeParse(raw.show);
  const valid =
    raw.version === 1 &&
    typeof raw.writtenAt === 'number' &&
    (raw.fileName === null || typeof raw.fileName === 'string') &&
    typeof raw.savedFingerprint === 'string' &&
    typeof raw.locked === 'boolean' &&
    (raw.handle === undefined || raw.handle === null || typeof raw.handle === 'object') &&
    show.success;
  if (!valid) {
    await store.del(KEY);
    return null;
  }
  return { ...(raw as AutosaveRecord), show: show.data };
}

export async function writeAutosave(store: KeyValueStore, record: Omit<AutosaveRecord, 'version'>): Promise<void> {
  await store.set(KEY, { version: 1, ...record });
}

export async function clearAutosave(store: KeyValueStore): Promise<void> {
  await store.del(KEY);
}
