// Layer 2 (BRIEF.md 8.1): save in place with the File System Access API, on Chrome and
// Edge desktop. Detected at runtime by feature, never by user agent. Where it is missing,
// the app falls back to layer 1 (file input and download).

const SHOW_TYPES: FilePickerAcceptType[] = [
  { description: 'Load Sheet show', accept: { 'application/json': ['.json'] } },
];

/** Picker id, so the browser remembers the folder last used for show files. */
const PICKER_ID = 'rigpoint-load-sheet';

export function fsAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/** Ask the user for a show file. Null if they cancel. */
export async function pickShowToOpen(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) throw new Error('Opening by file picker is not supported in this browser');
  try {
    const [handle] = await window.showOpenFilePicker({ types: SHOW_TYPES, id: PICKER_ID });
    return handle ?? null;
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Ask the user where to save. Null if they cancel. */
export async function pickSaveLocation(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) throw new Error('Save As is not supported in this browser');
  try {
    return await window.showSaveFilePicker({ types: SHOW_TYPES, suggestedName, id: PICKER_ID });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/**
 * Make sure the app may use a handle, asking again if the browser has forgotten.
 * Must be called from a user action (a click), because the browser may show a prompt.
 */
export async function ensurePermission(handle: FileSystemHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  return (await handle.requestPermission?.({ mode })) === 'granted';
}

export async function writeToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}
