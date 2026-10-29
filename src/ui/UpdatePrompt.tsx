// Offline readiness and "Update available – reload". A new version waits
// until the user chooses to reload; it never replaces the app in the middle of an edit.

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { reloadWarning } from './reload-warning';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** `autosaveActive`: autosave is working and not paused, so it is keeping the unsaved changes. */
export function UpdatePrompt({ dirty, autosaveActive }: { dirty: boolean; autosaveActive: boolean }) {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Long-running sessions (a laptop left open on site) still hear about new versions.
      if (registration) setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_MS);
    },
  });

  // "Ready to work offline" is worth saying once, then it gets out of the way.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 8000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  const reload = () => {
    if (dirty && !window.confirm(reloadWarning(autosaveActive))) return;
    void updateServiceWorker(true);
  };

  if (needRefresh) {
    return (
      <section className="banner banner-update" aria-labelledby="update-heading" role="status">
        <h2 id="update-heading">Update available – reload</h2>
        <p>A new version of the app is ready. It will be used after you reload.</p>
        <div className="banner-actions">
          <button type="button" className="button primary" onClick={reload}>
            Reload
          </button>
        </div>
      </section>
    );
  }
  if (offlineReady) {
    return (
      <p className="notice" role="status">
        Ready to work offline: the app and the Spec library are stored in this browser.
      </p>
    );
  }
  return null;
}
