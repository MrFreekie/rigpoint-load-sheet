import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { calculate } from '../engine/calculate';
import { ZONES } from '../engine/types';
import { clearAutosave, collectOffers, indexedDbStore, removeOffer, removedOffersMessage, writeAutosave, type AutosaveRecord } from '../files/autosave';
import { compareWithLibrary, type Comparison } from '../files/compare';
import { downloadText, readFileText } from '../files/download';
import { ensurePermission, fsAccessSupported, pickSaveLocation, pickShowToOpen, writeToHandle } from '../files/fs-access';
import { onLaunchFile } from '../files/launch';
import { addRecent, listRecent, removeRecent, sameHandle, type RecentFile } from '../files/recent';
import { takeSharedFile } from '../files/share-target';
import { contentFingerprint, parseShowFile, serialiseShow, toShowFile } from '../files/show-io';
import { exampleShow, library, libraryByName } from '../library';
import { printFooter } from '../print/footer';
import { LoadSheet } from '../print/LoadSheet';
import type { ShowFile } from '../schema/show-file';
import { CompareDialog } from './CompareDialog';
import { Dialog } from './Dialog';
import { docReducer, isDirty, newDoc } from './document';
import { currentHang, type EditorAction } from './editor';
import { FieldErrorsContext } from './fields';
import { contingencyToPercent, formatDateTime, formatKg, showFileName } from './format';
import { LibraryViewer } from './LibraryViewer';
import { RecentFilesDialog } from './RecentFilesDialog';
import { HangPanel, JobPanel } from './Panels';
import { SummaryPanel } from './SummaryPanel';
import { ThemeButton } from './ThemeButton';
import { TrafficLight } from './TrafficLight';
import { UpdatePrompt } from './UpdatePrompt';
import { ZoneCard } from './ZoneCard';

type View = 'editor' | 'library';

const AUTOSAVE_DELAY_MS = 1000;
const store = indexedDbStore();

function showTitle(show: { job: { name: string }; hangs: { name: string }[] }): string {
  const parts = [show.job.name, show.hangs[0]?.name].filter(Boolean);
  return parts.length ? parts.join(' – ') : 'Untitled show';
}

const STATUS_WORDS = { approved: 'Approved', superseded: 'Superseded', draft: 'Draft', issued: 'Issued' } as const;

interface FileError {
  title: string;
  message: string;
  details: string[];
  /** True when the show on screen is unaffected (every open failure). */
  unchanged: boolean;
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function App() {
  const [doc, dispatch] = useReducer(docReducer, library.spec_version, newDoc);
  const [view, setView] = useState<View>('editor');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [fileError, setFileError] = useState<FileError | null>(null);
  // Layer 2 (Chrome and Edge desktop): the file on disk this show saves back to.
  const [fsAccess] = useState(fsAccessSupported);
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Autosaved shows from an earlier session, newest first, waiting for Restore or Discard.
  const [offers, setOffers] = useState<AutosaveRecord[]>([]);
  // How many offers the cap removed at start, so the banner can say so.
  const [removedOffers, setRemovedOffers] = useState(0);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Changes for each show that is opened or started, so boxes drop what was typed in them.
  const [showId, setShowId] = useState(0);
  // The number boxes that currently show an error (they report in through FieldErrorsContext).
  const [fieldErrors] = useState(() => new Set<string>());
  // Layer 2: when the file on disk was last modified, as of the last time this app read or wrote it.
  const diskStamp = useRef<number | null>(null);
  // Layer 1: after a download the app cannot tell whether it arrived, so the autosave copy is kept.
  const retainAutosave = useRef(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [printOverflow, setPrintOverflow] = useState(false);

  const show = doc.show;
  const hang = currentHang(show);
  const result = useMemo(() => calculate(hang, show.job.contingency), [hang, show.job.contingency]);
  const dirty = useMemo(() => isDirty(doc), [doc]);
  const contingencyLabel = `(+${contingencyToPercent(show.job.contingency)}%)`;
  const dispatchEdit = (action: EditorAction) => dispatch({ type: 'edit', action });

  // Latest values for handlers registered once (launch queue, share target).
  const latest = useRef({ dirty, title: showTitle(show) });
  useEffect(() => {
    latest.current = { dirty, title: showTitle(show) };
  });

  // ---- Autosave: offer to restore on start, then keep a copy while there are unsaved changes.
  // What an earlier session left behind is moved to the offers, which wait under their own key,
  // so the live autosave protects the current show from the start whether or not they are answered.
  useEffect(() => {
    collectOffers(store)
      .then((list) => {
        setOffers(list.offers);
        setRemovedOffers(list.removed);
      })
      .catch(() => setAutosaveFailed(true))
      .finally(() => setAutosaveReady(true));
  }, []);

  const autosaveRecord = (savedByDownload = false): Omit<AutosaveRecord, 'version'> => ({
    writtenAt: Date.now(),
    fileName: doc.fileName,
    savedFingerprint: doc.savedFingerprint,
    locked: doc.locked,
    show: toShowFile(doc.show, { appVersion: __APP_VERSION__, specVersion: doc.show.spec_version, savedAt: new Date() }),
    handle,
    diskStamp: diskStamp.current,
    ...(savedByDownload ? { savedByDownload: true } : {}),
  });

  /**
   * Remove the live autosave copy: the show it held has been saved, replaced or abandoned.
   * Offers from an earlier session are separate and stay until the user answers them.
   */
  const resetAutosave = () => {
    retainAutosave.current = false;
    clearAutosave(store).catch(() => setAutosaveFailed(true));
  };

  useEffect(() => {
    if (!autosaveReady) return;
    const timer = setTimeout(() => {
      // Promise.resolve().then: a show that fails validation is reported as a
      // failed autosave instead of throwing out of the timer.
      let write: Promise<void>;
      if (dirty && !doc.locked) {
        retainAutosave.current = false; // new changes: this copy replaces the kept one
        write = Promise.resolve().then(() => writeAutosave(store, autosaveRecord()));
      } else {
        // A download is not confirmed, so its autosave copy stays until the next clean point.
        write = retainAutosave.current ? Promise.resolve() : clearAutosave(store);
      }
      write.then(() => setAutosaveFailed(false)).catch(() => setAutosaveFailed(true));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // autosaveRecord reads doc and handle, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, dirty, autosaveReady, handle]);

  // ---- Warn before leaving with unsaved changes.
  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${showTitle(show)} – RigPoint Load Sheet`;
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, show]);

  // ---- Printing: stamp the time whenever a print starts, including from the browser menu.
  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(new Date()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  /** A number box with an error keeps showing what was typed, but the sheet and file use the last valid value. */
  const confirmWithErrors = (what: string) =>
    fieldErrors.size === 0 ||
    window.confirm(`Some boxes have errors, so ${what} uses the last valid values, not what those boxes show. Continue?`);

  const onPrint = () => {
    if (!confirmWithErrors('the Load Sheet')) return;
    flushSync(() => setPrintedAt(new Date()));
    window.print();
  };

  const footer = printFooter({
    appVersion: __APP_VERSION__,
    showSpec: show.spec_version,
    librarySpec: library.spec_version,
    fileName: doc.fileName,
    defaultName: showFileName(show.job.name, hang.name, show.job.revision),
    dirty,
    printedAt,
  });

  const confirmDiscard = (what: string) =>
    !latest.current.dirty || window.confirm(`${what}? Unsaved changes to ${latest.current.title} will be lost.`);

  const rememberRecent = (h: FileSystemFileHandle) => {
    addRecent(store, h, sameHandle).then(setRecent).catch(() => undefined);
  };

  const afterOpen = (
    file: ShowFile,
    fileName: string | null,
    migratedFrom: string | null,
    fileHandle: FileSystemFileHandle | null = null,
    compareLibrary = true,
    lastModified: number | null = null,
  ) => {
    dispatch({ type: 'open', show: file, fileName });
    setHandle(fileHandle);
    diskStamp.current = lastModified;
    setShowId((n) => n + 1);
    if (fileHandle) rememberRecent(fileHandle);
    resetAutosave();
    setView('editor');
    const c = compareLibrary ? compareWithLibrary(file, libraryByName, library.spec_version) : null;
    setComparison(c?.anyDifferences ? c : null);
    const parts = [
      fileName ? `Opened ${fileName}.` : null,
      migratedFrom ? `It was upgraded from format ${migratedFrom}; save it to keep the upgrade.` : null,
    ].filter(Boolean);
    setNotice(parts.length ? parts.join(' ') : null);
  };

  /** Parse text from any source and open it, or explain why not. */
  const openText = (text: string, fileName: string, fileHandle: FileSystemFileHandle | null, lastModified: number | null = null) => {
    const r = parseShowFile(text);
    if (!r.ok) {
      setFileError({ title: `Could not open ${fileName}`, message: r.message, details: r.details, unchanged: true });
      return;
    }
    afterOpen(r.show, fileName, r.migratedFrom, fileHandle, true, lastModified);
  };

  /**
   * Open a file the app holds a handle for (picker, recent list, double-click).
   * The file is chosen and permission asked for first, and only then is "discard unsaved
   * changes?" asked: a confirmation box can use up the click that the picker and the
   * permission prompt need.
   */
  const openFromHandle = async (h: FileSystemFileHandle, discardWhat?: string, onProceed?: () => void) => {
    try {
      if (!(await ensurePermission(h, 'read'))) {
        setFileError({ title: `Could not open ${h.name}`, message: 'Permission to read the file was not given.', details: [], unchanged: true });
        return;
      }
      if (discardWhat && !confirmDiscard(discardWhat)) return;
      onProceed?.();
      const file = await h.getFile();
      openText(await readFileText(file), file.name, h, file.lastModified);
    } catch (e) {
      const missing = e instanceof DOMException && e.name === 'NotFoundError';
      setFileError({
        title: `Could not open ${h.name}`,
        message: missing ? 'The file has been moved, renamed or deleted.' : errorText(e, 'The file could not be read.'),
        details: [],
        unchanged: true,
      });
      if (missing) removeRecent(store, h, sameHandle).then(setRecent).catch(() => undefined);
    }
  };

  // ---- Once on start: recent files, double-click to open (installed app), Android share.
  const startup = useRef({ openText, openFromHandle });
  useEffect(() => {
    startup.current = { openText, openFromHandle };
  });
  useEffect(() => {
    if (fsAccessSupported()) listRecent(store).then(setRecent).catch(() => undefined);
    onLaunchFile((h) => void startup.current.openFromHandle(h, `Open ${h.name}`));
    takeSharedFile()
      .then((shared) => {
        if (!shared) return;
        if ('error' in shared) setFileError({ title: 'Could not open the shared file', message: shared.error, details: [], unchanged: true });
        // Any website can post a file to the share route, so never open one unasked.
        else if (window.confirm(`A file was shared to the Load Sheet: "${shared.name}". Open it?`))
          startup.current.openText(shared.text, shared.name, null);
      })
      .catch(() => undefined);
  }, []);

  const onNew = () => {
    if (!confirmDiscard('Start a new show')) return;
    dispatch({ type: 'new', specVersion: library.spec_version });
    setHandle(null);
    diskStamp.current = null;
    setShowId((n) => n + 1);
    resetAutosave();
    setComparison(null);
    setNotice(null);
    setView('editor');
  };

  // Open: choose the file first, then ask about unsaved changes (see openFromHandle).
  const onOpenClick = () => {
    if (!fsAccess) {
      fileInput.current?.click();
      return;
    }
    pickShowToOpen()
      .then((h) => (h ? openFromHandle(h, `Open ${h.name}`) : undefined))
      .catch((e) => setFileError({ title: 'Could not open a file', message: errorText(e, 'The file picker failed.'), details: [], unchanged: true }));
  };

  const onRecentOpen = (f: RecentFile) => {
    // The list stays open if the user decides not to discard their changes.
    void openFromHandle(f.handle, `Open ${f.name}`, () => setRecentOpen(false));
  };

  const onFileChosen = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!confirmDiscard(`Open ${file.name}`)) return;
    try {
      openText(await readFileText(file), file.name, null);
    } catch (e) {
      setFileError({ title: `Could not open ${file.name}`, message: errorText(e, 'The file could not be read.'), details: [], unchanged: true });
    }
  };

  const onLoadExample = () => {
    if (!confirmDiscard('Load the Ballroom example')) return;
    // The example is a fixed sample saved with the workbook's library, so it opens exactly as
    // saved, without listing later library changes.
    afterOpen(exampleShow(), null, null, null, false);
  };

  /** The file text to write now, its default name, and the library version it records. */
  const prepareSave = () => {
    const job = show.job;
    const defaultName = showFileName(job.name, hang.name, job.revision);
    // The file records the library version its snapshots come from: the current one only
    // when every snapshot matches it, otherwise the version it was opened with.
    const matchesLibrary = !compareWithLibrary(show, libraryByName, library.spec_version).anyDifferences;
    const specVersion = matchesLibrary ? library.spec_version : show.spec_version;
    const file = toShowFile(show, { appVersion: __APP_VERSION__, specVersion, savedAt: new Date() });
    // Identifies exactly the content being written, so edits made while the save is in
    // progress still count as unsaved.
    return { text: serialiseShow(file), defaultName, specVersion, fingerprint: contentFingerprint(show) };
  };

  const afterSave = (fileName: string, saved: { specVersion: string; fingerprint: string }, message: string) => {
    dispatch({ type: 'saved', fileName, ...saved });
    setNotice(message);
  };

  const saveFailed = (e: unknown) =>
    setFileError({ title: 'The show was not saved', message: errorText(e, 'The file could not be written.'), details: [], unchanged: false });

  /** The modified time of a file on disk, or null if it cannot be read. */
  const modifiedTime = async (h: FileSystemFileHandle): Promise<number | null> => {
    try {
      return (await h.getFile()).lastModified;
    } catch {
      return null;
    }
  };

  /** Layer 2: choose where to save, then keep saving there. */
  const onSaveAs = async () => {
    if (!confirmWithErrors('the saved file')) return;
    try {
      const { text, defaultName, specVersion, fingerprint } = prepareSave();
      const h = await pickSaveLocation(defaultName);
      if (!h) return;
      await writeToHandle(h, text);
      setHandle(h);
      diskStamp.current = await modifiedTime(h);
      rememberRecent(h);
      resetAutosave();
      afterSave(h.name, { specVersion, fingerprint }, `Saved as ${h.name}. Save will now update this file.`);
    } catch (e) {
      saveFailed(e);
    }
  };

  const onSave = async () => {
    if (!fsAccess) {
      // Layer 1: every browser.
      if (!confirmWithErrors('the saved file')) return;
      try {
        const { text, defaultName, specVersion, fingerprint } = prepareSave();
        downloadText(text, defaultName);
        // The browser cannot say whether the download arrived, so keep a copy in autosave
        // until the user moves on (opens or starts another show) or makes new changes. Not while
        // a restore offer is waiting (autosave is paused and its copy belongs to another show),
        // and nothing to keep when there were no unsaved changes.
        let copyKept = false;
        if (dirty && autosaveReady) {
          try {
            await writeAutosave(store, autosaveRecord(true));
            retainAutosave.current = true;
            copyKept = true;
            setAutosaveFailed(false);
          } catch {
            setAutosaveFailed(true);
          }
        }
        afterSave(
          defaultName,
          { specVersion, fingerprint },
          `Saved as ${defaultName} – check your downloads folder. Keep that file: it is the record. ` +
            (copyKept
              ? 'The browser cannot confirm the download finished, so a copy stays in autosave until you open or start another show.'
              : 'The browser cannot confirm the download finished, so check that the file is there.'),
        );
      } catch (e) {
        saveFailed(e);
      }
      return;
    }
    if (!handle) {
      await onSaveAs();
      return;
    }
    if (!confirmWithErrors('the saved file')) return;
    try {
      const { text, specVersion, fingerprint } = prepareSave();
      if (!(await ensurePermission(handle, 'readwrite'))) {
        saveFailed(new Error(`Permission to save to ${handle.name} was not given. Use Save As to choose a file.`));
        return;
      }
      // Another program (or a synced copy) may have changed the file since it was opened or saved here.
      const onDisk = await modifiedTime(handle);
      if (onDisk !== null && onDisk !== diskStamp.current) {
        // No stamp (null) happens after Restore from an older autosave: the file cannot be checked.
        const overwrite = window.confirm(
          diskStamp.current === null
            ? `Could not check whether ${handle.name} has been changed outside this app since these edits began. ` +
                'Saving will replace its contents. Overwrite it?'
            : `${handle.name} has been changed outside this app since it was opened or last saved here. ` +
                'Saving will replace those changes. Overwrite it?',
        );
        if (!overwrite) {
          setNotice(`Not saved: ${handle.name} was not overwritten. Use Save As to keep both, or Save again to overwrite it.`);
          return;
        }
      }
      await writeToHandle(handle, text);
      // Our own write changed the modified time, so it can only be read back afterwards. Another
      // program changing the file in the instant between the write and this read would go
      // unnoticed; that small window is accepted.
      diskStamp.current = await modifiedTime(handle);
      rememberRecent(handle);
      resetAutosave();
      afterSave(handle.name, { specVersion, fingerprint }, `Saved to ${handle.name}.`);
    } catch (e) {
      saveFailed(e);
    }
  };

  const onNewRevision = () => {
    const before = show.job.revision;
    dispatch({ type: 'new-revision' });
    // The original file stays untouched: the revision is saved to a new file.
    setHandle(null);
    setComparison(null);
    setNotice(
      `New revision created from ${before ? `revision ${before}` : 'the first issue'} as an unsaved draft. ` +
        'Save it to create a new file; the original file is unchanged.',
    );
  };

  /**
   * Take an answered offer off the stored list (reading what is stored now, so an offer another
   * tab added is kept) and show the list as it is stored.
   */
  const answerOffer = (offer: AutosaveRecord) =>
    removeOffer(store, offer.writtenAt).then((list) => setOffers(list.offers));

  const restore = () => {
    const r = offers[0];
    if (!r) return;
    // The live autosave holds a copy when there are unsaved changes, and also after a download
    // (which keeps one): restoring replaces that copy too.
    if ((dirty || retainAutosave.current) && !window.confirm('Restoring will replace the show on screen and its autosaved copy. Continue?')) return;
    dispatch({ type: 'restore', show: r.show, fileName: r.fileName, savedFingerprint: r.savedFingerprint, locked: r.locked });
    setHandle(r.handle ?? null);
    // The modified time the file had when these edits began (null for autosaves made before it was recorded).
    diskStamp.current = r.diskStamp ?? null;
    retainAutosave.current = false;
    setShowId((n) => n + 1);
    setNotice('Unsaved changes restored. Save the show to keep them in a file.');
    // The restored show becomes the live autosave straight away (replacing the one for the show it
    // replaced), and only then does its offer go, so it is never held in memory alone.
    writeAutosave(store, { ...r, savedByDownload: false })
      .then(() => answerOffer(r))
      .catch(() => setAutosaveFailed(true));
  };

  const discardRestore = () => {
    const r = offers[0];
    if (r) answerOffer(r).catch(() => setAutosaveFailed(true));
  };

  const restoreOffer = offers[0] ?? null;

  return (
    <FieldErrorsContext.Provider value={fieldErrors}>
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">RigPoint</span> <span className="brand-app">Load Sheet</span>
        </div>
        <div className="show-heading">
          <p className="show-title" title={showTitle(show)}>
            {showTitle(show)}
          </p>
          <p className="file-state" role="status">
            {dirty ? (
              <span className="unsaved">● Unsaved changes</span>
            ) : doc.fileName ? (
              <span className="saved">Saved · {doc.fileName}</span>
            ) : (
              <span className="saved">Not saved to a file</span>
            )}
          </p>
        </div>
        <nav className="header-actions" aria-label="Show">
          <button type="button" className="button" onClick={onNew}>
            New
          </button>
          <button type="button" className="button" onClick={onOpenClick}>
            Open
          </button>
          {fsAccess && recent.length ? (
            <button type="button" className="button" onClick={() => setRecentOpen(true)}>
              Recent
            </button>
          ) : null}
          <button
            type="button"
            className="button primary"
            onClick={() => void onSave()}
            disabled={doc.locked}
            title={handle ? `Save to ${handle.name}` : undefined}
          >
            Save
          </button>
          {fsAccess ? (
            <button type="button" className="button" onClick={() => void onSaveAs()} disabled={doc.locked}>
              Save As
            </button>
          ) : null}
          <button type="button" className="button" onClick={onPrint}>
            Print
          </button>
          <button type="button" className="button" onClick={onLoadExample}>
            Load example
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={view === 'library'}
            onClick={() => setView(view === 'library' ? 'editor' : 'library')}
          >
            {view === 'library' ? 'Back to show' : 'Library'}
          </button>
          <ThemeButton />
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="open-file"
            onChange={(e) => void onFileChosen(e.target.files?.[0])}
          />
        </nav>
        <p className="versions">
          App {__APP_VERSION__} · Spec {library.spec_version}
        </p>
      </header>

      <UpdatePrompt dirty={dirty} autosaveActive={autosaveReady && !autosaveFailed && !doc.locked} />

      {restoreOffer ? (
        <section className="banner banner-restore" aria-labelledby="restore-heading">
          <h2 id="restore-heading">
            Restore unsaved changes to {showTitle(restoreOffer.show)}?
          </h2>
          <p>
            Autosaved {formatDateTime(restoreOffer.writtenAt)}. Autosave is a safety net in this browser only – the saved
            file is the record.
            {offers.length > 1
              ? ` ${offers.length - 1} more autosaved show${offers.length === 2 ? ' is' : 's are'} waiting; they are offered one after another.`
              : ''}
          </p>
          {restoreOffer.savedByDownload ? (
            <p>
              This show was saved as a download and not changed afterwards. The browser could not confirm that the file
              arrived, so restore it only if the file is missing.
            </p>
          ) : null}
          {removedOffers > 0 ? (
            <p>{removedOffersMessage(removedOffers)}</p>
          ) : null}
          <div className="banner-actions">
            <button type="button" className="button primary" onClick={restore}>
              Restore
            </button>
            <button type="button" className="button" onClick={discardRestore}>
              Discard
            </button>
          </div>
        </section>
      ) : null}

      {doc.locked ? (
        <section className="banner banner-locked" aria-labelledby="locked-heading">
          <h2 id="locked-heading">Read-only: this show is {STATUS_WORDS[show.job.status]}</h2>
          <p>
            Approved and superseded shows cannot be edited. To make changes, create a new revision: an editable draft copy
            that you save as a new file. The original file stays as it is.
          </p>
          <div className="banner-actions">
            <button type="button" className="button primary" onClick={onNewRevision}>
              Create new revision
            </button>
          </div>
        </section>
      ) : null}

      {doc.revisionNeeded ? (
        <p className="warning" role="alert">
          ⚠ The next revision could not be worked out from the previous one. Enter it in Revision before saving.
        </p>
      ) : null}

      {notice ? (
        <p className="notice" role="status">
          {notice}{' '}
          <button type="button" className="link-button" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {printOverflow ? (
        <p className="warning" role="status">
          ⚠ This hang has too many rows to print on one A4 page at a readable size. The Load Sheet will run onto a second page.
        </p>
      ) : null}

      {autosaveFailed ? (
        <p className="warning" role="status">
          ⚠ Autosave is not available in this browser (for example in a private window). Save to a file regularly.
        </p>
      ) : null}

      {view === 'library' ? (
        <main className="main-library">
          <LibraryViewer />
        </main>
      ) : (
        <div className="layout">
          <main aria-label="Load sheet editor">
            <fieldset key={showId} className="lock editor" disabled={doc.locked}>
              <legend className="visually-hidden">{doc.locked ? 'Show details (read-only)' : 'Show details'}</legend>
              <JobPanel job={show.job} dispatch={dispatchEdit} />
              <HangPanel hang={hang} dispatch={dispatchEdit} />
              <p className="connection-point-note">
                <strong>Connection point</strong> – above everything; carries the total. See the summary.
              </p>
              {ZONES.map((z) => (
                <ZoneCard
                  key={z}
                  zone={z}
                  rows={hang.zones[z]}
                  results={result.rows[z]}
                  subtotal={result.subtotals[z]}
                  contingencyLabel={contingencyLabel}
                  orientation={hang.hoist_orientation}
                  dispatch={dispatchEdit}
                />
              ))}
            </fieldset>
          </main>
          <SummaryPanel
            key={showId}
            hang={hang}
            result={result}
            contingencyLabel={contingencyLabel}
            locked={doc.locked}
            dispatch={dispatchEdit}
          />
        </div>
      )}

      {view === 'editor' ? (
        <a className="mini-summary" href="#summary">
          {/* The link's name starts with what it does and contains everything it shows. */}
          <span className="visually-hidden">Go to summary: </span>
          <span>{formatKg(result.total_static)}</span>
          {result.governing ? <TrafficLight used={result.governing.used} light={result.governing.light} /> : <span>no rated items</span>}
          {!result.data_ok ? <span className="mini-flag">⚠ data</span> : null}
          {dirty ? <span className="mini-unsaved">● unsaved</span> : null}
        </a>
      ) : null}

      {comparison ? (
        <CompareDialog
          comparison={comparison}
          readOnly={doc.locked}
          onClose={() => setComparison(null)}
          onUpdate={(items) => {
            dispatch({ type: 'library-update', items, library: libraryByName });
            setComparison(null);
            setNotice(`Updated ${items.size} item${items.size === 1 ? '' : 's'} to the current library. Save to keep the change.`);
          }}
        />
      ) : null}

      {fileError ? (
        <Dialog
          title={fileError.title}
          onClose={() => setFileError(null)}
          actions={
            <button type="button" className="button" onClick={() => setFileError(null)}>
              OK
            </button>
          }
        >
          <p>{fileError.message}</p>
          {fileError.details.length ? (
            <ul className="error-list">
              {fileError.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className="section-hint">
            {fileError.unchanged
              ? 'Nothing was changed. The show you had open is still open.'
              : 'Your changes are still here and still unsaved.'}
          </p>
        </Dialog>
      ) : null}

      {recentOpen ? (
        <RecentFilesDialog
          files={recent}
          onOpen={onRecentOpen}
          onRemove={(f) => {
            removeRecent(store, f.handle, sameHandle).then(setRecent).catch(() => undefined);
          }}
          onClose={() => setRecentOpen(false)}
        />
      ) : null}

      <footer className="app-footer">
        <p>
          A calculation aid. It does not replace assessment by a competent person. Static weights only, in kilograms; no
          dynamic, derating or safety factor is applied.
        </p>
        <p>
          Show files stay on your device.{' '}
          {fsAccess
            ? 'Open reads a file you choose; Save writes back to that file and Save As chooses a new one.'
            : 'Open reads a file you choose and Save downloads one.'}{' '}
          Autosave keeps a copy in this browser only, as a safety net – the saved file is the record.
        </p>
      </footer>
    </div>
    <div className="print-root" aria-hidden="true">
      <LoadSheet
        show={show}
        hang={hang}
        result={result}
        contingencyLabel={contingencyLabel}
        footer={footer}
        onOverflow={setPrintOverflow}
      />
    </div>
    </FieldErrorsContext.Provider>
  );
}

