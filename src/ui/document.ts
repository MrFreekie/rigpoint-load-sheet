// The open document: the show being edited plus what the app knows about its file.
// Wraps the editor reducer with the approval lock and saved/unsaved tracking.

import { applyLibraryUpdates } from '../files/compare';
import { contentFingerprint } from '../files/show-io';
import type { JobStatus, ShowFile } from '../schema/show-file';
import type { SpecItem } from '../schema/spec-library';
import { editorReducer, fromShowFile, newShow, type EditorAction, type EditorShow } from './editor';

/** Statuses that open read-only. */
export const LOCKED_STATUSES: readonly JobStatus[] = ['approved', 'superseded'];

export interface Doc {
  show: EditorShow;
  /** Name of the file this show was opened from or last saved as; null if never saved. */
  fileName: string | null;
  /** Content fingerprint at the last open or save; the show is unsaved when it differs. */
  savedFingerprint: string;
  /** Approved or superseded when opened: read-only until a new revision is made. */
  locked: boolean;
  /** Set when "Create new revision" could not work out the next revision from the old one. */
  revisionNeeded: boolean;
}

export type DocAction =
  | { type: 'edit'; action: EditorAction }
  | { type: 'new'; specVersion: string }
  | { type: 'open'; show: ShowFile; fileName: string | null }
  | { type: 'restore'; show: ShowFile; fileName: string | null; savedFingerprint: string; locked: boolean }
  /** `fingerprint` is that of the content actually written, not of whatever is on screen when the save finishes. */
  | { type: 'saved'; fileName: string; specVersion: string; fingerprint: string }
  | { type: 'new-revision' }
  | { type: 'library-update'; items: ReadonlySet<string>; library: ReadonlyMap<string, SpecItem> };

export function isLockedStatus(status: JobStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

export function newDoc(specVersion: string): Doc {
  const show = newShow(specVersion);
  return { show, fileName: null, savedFingerprint: contentFingerprint(show), locked: false, revisionNeeded: false };
}

export function openedDoc(file: ShowFile, fileName: string | null): Doc {
  const show = fromShowFile(file);
  return {
    show,
    fileName,
    savedFingerprint: contentFingerprint(show),
    locked: isLockedStatus(file.job.status),
    revisionNeeded: false,
  };
}

export function isDirty(doc: Doc): boolean {
  return contentFingerprint(doc.show) !== doc.savedFingerprint;
}

/**
 * Next revision in the scheme chosen for this app: letters, blank for the first issue.
 * "" → "A", "A" → "B", "Z" → "AA", "AZ" → "BA". Returns null if the revision is not letters.
 */
export function nextRevision(current: string): string | null {
  const rev = current.trim().toUpperCase();
  if (rev === '') return 'A';
  if (!/^[A-Z]+$/.test(rev)) return null;
  const chars = rev.split('');
  let i = chars.length - 1;
  while (i >= 0 && chars[i] === 'Z') {
    chars[i] = 'A';
    i--;
  }
  if (i < 0) return `A${chars.join('')}`;
  chars[i] = String.fromCharCode((chars[i] as string).charCodeAt(0) + 1);
  return chars.join('');
}

export function docReducer(doc: Doc, action: DocAction): Doc {
  switch (action.type) {
    case 'edit': {
      if (doc.locked) return doc;
      const show = editorReducer(doc.show, action.action);
      const revisionTyped = action.action.type === 'job' && action.action.field === 'revision';
      return { ...doc, show, revisionNeeded: doc.revisionNeeded && !revisionTyped };
    }
    case 'new':
      return newDoc(action.specVersion);
    case 'open':
      return openedDoc(action.show, action.fileName);
    case 'restore':
      return { ...openedDoc(action.show, action.fileName), savedFingerprint: action.savedFingerprint, locked: action.locked };
    case 'saved':
      return {
        ...doc,
        show: { ...doc.show, spec_version: action.specVersion },
        fileName: action.fileName,
        // What was written, not the current content: edits made while the save was in
        // progress stay unsaved.
        savedFingerprint: action.fingerprint,
      };
    case 'new-revision': {
      // An editable copy; the original file is untouched and the copy is saved under a new name.
      const next = nextRevision(doc.show.job.revision);
      return {
        show: {
          ...doc.show,
          job: { ...doc.show.job, status: 'draft', revision: next ?? '', sheet_date: null },
        },
        fileName: null,
        savedFingerprint: '',
        locked: false,
        revisionNeeded: next === null,
      };
    }
    case 'library-update':
      if (doc.locked) return doc;
      return { ...doc, show: applyLibraryUpdates(doc.show, action.items, action.library) };
  }
}
