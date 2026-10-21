// Android "share to" (manifest share_target, BRIEF.md 8.6). The service worker receives the
// shared file, parks it in a cache, and sends the app to ?shared=1; the app then opens it.

import { SHARE_CACHE, SHARE_KEY, SHARE_NAME_HEADER, SHARE_PARAM } from './share-constants';

export type SharedFile = { name: string; text: string } | { error: string };

/**
 * If the app was opened by a share, take the shared file out of the cache.
 * Returns null when there is nothing to open. Removes the query and the cached copy.
 */
export async function takeSharedFile(): Promise<SharedFile | null> {
  const url = new URL(window.location.href);
  const marker = url.searchParams.get(SHARE_PARAM);
  if (marker === null) return null;
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  if (marker === 'too-large') return { error: 'The shared file is too large to be a show file.' };
  if (marker === 'none') return { error: 'Nothing was shared: no file arrived with the share.' };
  if (!('caches' in window)) return { error: 'This browser cannot receive shared files.' };
  const cache = await caches.open(SHARE_CACHE);
  const response = await cache.match(SHARE_KEY);
  await cache.delete(SHARE_KEY);
  if (!response) return null;
  const name = decodeURIComponent(response.headers.get(SHARE_NAME_HEADER) ?? 'shared.loadsheet.json');
  return { name, text: await response.text() };
}
