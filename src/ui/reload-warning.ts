// Wording of the confirmation before reloading to update. Kept apart from UpdatePrompt so it can be tested.

/**
 * What to say before reloading with unsaved changes. Autosave is only promised while it is
 * actually keeping them (not when it failed), and not for the last moments: it writes about a
 * second after each change.
 */
export function reloadWarning(autosaveActive: boolean): string {
  return autosaveActive
    ? 'Reload to update? Your unsaved changes are kept by autosave in this browser (apart from the last few seconds) and should be offered back after the reload. Saving the show to a file is still the only safe record.'
    : 'Reload to update? Autosave is not keeping the changes to this show (it is not available in this browser), so your unsaved changes will be lost. Cancel and save the show first to keep them.';
}
