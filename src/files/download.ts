// Layer 1: open with a file input and save by downloading. Works in every browser.

import { MAX_FILE_BYTES } from './show-io';

/** Offer `text` as a download named `fileName`. */
export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Read a chosen file as text, refusing anything too large to be a show file. */
export async function readFileText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new RangeError('The file is too large to be a show file.');
  return file.text();
}
