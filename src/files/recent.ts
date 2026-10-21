// Recent files (BRIEF.md 8.1, layer 2): file handles kept in IndexedDB so a show can be
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

export const sameHandle: SameFile<FileSystemFileHandle> = (a, b) => a.isSameEntry(b);

export async function listRecent<H = FileSystemFileHandle>(store: KeyValueStore): Promise<RecentFile<H>[]> {
  const raw = await store.get(KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is RecentFile<H> =>
      typeof r === 'object' && r !== null && typeof r.name === 'string' && typeof r.usedAt === 'number' && 'handle' in r,
  );
}

/** Put a file at the top of the list, removing any older entry for the same file. */
export async function addRecent<H>(
  store: KeyValueStore,
  handle: H & { name: string },
  same: SameFile<H>,
  now = Date.now(),
): Promise<RecentFile<H>[]> {
  const others: RecentFile<H>[] = [];
  for (const r of await listRecent<H>(store)) {
    if (!(await same(r.handle, handle).catch(() => false))) others.push(r);
  }
  const next = [{ name: handle.name, usedAt: now, handle }, ...others].slice(0, MAX_RECENT);
  await store.set(KEY, next);
  return next;
}

export async function removeRecent<H>(store: KeyValueStore, handle: H, same: SameFile<H>): Promise<RecentFile<H>[]> {
  const kept: RecentFile<H>[] = [];
  for (const r of await listRecent<H>(store)) {
    if (!(await same(r.handle, handle).catch(() => false))) kept.push(r);
  }
  await store.set(KEY, kept);
  return kept;
}
