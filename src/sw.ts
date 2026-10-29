/// <reference lib="webworker" />
// Service worker: precaches the app shell and the bundled Spec library so the
// app works with no network, waits for the user before updating, and receives show files
// shared from Android (share_target). It never sends anything anywhere.

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { MAX_FILE_BYTES } from './files/limits';
import { isShareFromOs } from './files/share-guard';
import { SHARE_ACTION, SHARE_CACHE, SHARE_FIELD, SHARE_KEY, SHARE_NAME_HEADER, SHARE_PARAM } from './files/share-constants';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

const scope = self.registration.scope;
const sharePath = new URL(SHARE_ACTION, scope).pathname;

// Before Workbox's routes: Workbox only handles GET, the share arrives as a POST.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === sharePath) {
    event.respondWith(receiveShare(event.request));
  }
});

async function receiveShare(request: Request): Promise<Response> {
  const back = (marker: string) => Response.redirect(new URL(`./?${SHARE_PARAM}=${marker}`, scope).href, 303);
  // Nothing is read or parked unless the OS share sheet sent it (see share-guard.ts).
  if (!isShareFromOs(request, self.location.origin)) return back('refused');
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get(SHARE_FIELD);
  } catch {
    return back('none');
  }
  if (!(file instanceof File)) return back('none');
  if (file.size > MAX_FILE_BYTES) return back('too-large');
  const cache = await caches.open(SHARE_CACHE);
  await cache.put(
    SHARE_KEY,
    new Response(file, {
      headers: { 'Content-Type': 'application/json', [SHARE_NAME_HEADER]: encodeURIComponent(file.name) },
    }),
  );
  return back('1');
}

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Any navigation (including ?shared=1) gets the cached app shell, so it opens offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// The new version waits until the user chooses "Reload" in the update prompt.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
