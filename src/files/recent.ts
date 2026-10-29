// Recent files (layer 2): file handles kept in IndexedDB so a show can be
// reopened, and saved in place, without browsing for it again. Permission is asked for
// again on reuse.

import type { KeyValueStore } from './autosave';

export const MAX_RECENT = 8;
const KEY = 'recent-files';

export interface RecentFile<H = FileSystemFileHandle> {
  name: string;
  /** When it was last opened or saved (ms since epoch). */
  usedAt: number;
  handle: H;
}

/** Same file on disk? Real handles compare with isSameEntry. */
export type SameFile<H> = (a: H, b: H) => Promise<boolean>;

// async, so a throw from isSameEntry (not a function on a damaged stored entry, or a
// DOMException) becomes a rejected promise the callers handle.
export const sameHandle: SameFile<FileSystemFileHandle> = async (a, b) => a.isSameEntry(b);

/** A comparison that fails counts as "different file", however it fails (throw or rejection). */
async function isSame<H>(same: SameFile<H>, a: H, b: H): Promise<boolean> {
  try {
    return await same(a, b);
  } catch {
    return false;
  }
}

/**
 * Updates read the list, change it and write it back. Two at once would lose one update,
 * so they run one after another per store.
 */
const queues = new WeakMap<KeyValueStore, Promise<unknown>>();
function serialised<T>(store: KeyValueStore, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(store) ?? Promise.resolve()).then(task, task);
  queues.set(store, run.catch(() => undefined));
  return run;
}

export async function listRecent<H = FileSystemFileHandle>(store: KeyValueStore): Promise<RecentFile<H>[]> {
  const raw = await store.get(KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is RecentFile<H> =>
      typeof r === 'object' && r !== null && typeof r.name === 'string' && typeof r.usedAt === 'number' && 'handle' in r,
  );
}

/** Put a file at the top of the list, removing any older entry for the same file. */
export function addRecent<H>(
  store: KeyValueStore,
  handle: H & { name: string },
  same: SameFile<H>,
  now = Date.now(),
): Promise<RecentFile<H>[]> {
  return serialised(store, async () => {
    const others: RecentFile<H>[] = [];
    for (const r of await listRecent<H>(store)) {
      if (!(await isSame(same, r.handle, handle))) others.push(r);
    }
    const next = [{ name: handle.name, usedAt: now, handle }, ...others].slice(0, MAX_RECENT);
    await store.set(KEY, next);
    return next;
  });
}

export function removeRecent<H>(store: KeyValueStore, handle: H, same: SameFile<H>): Promise<RecentFile<H>[]> {
  return serialised(store, async () => {
    const kept: RecentFile<H>[] = [];
    for (const r of await listRecent<H>(store)) {
      if (!(await isSame(same, r.handle, handle))) kept.push(r);
    }
    await store.set(KEY, kept);
    return kept;
  });
}
