import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { calculate } from '../engine/calculate';
import { ZONES } from '../engine/types';
import { clearAutosave, indexedDbStore, readAutosave, writeAutosave, type AutosaveRecord } from '../files/autosave';
import { compareWithLibrary, type Comparison } from '../files/compare';
import { downloadText, readFileText } from '../files/download';
import { ensurePermission, fsAccessSupported, pickSaveLocation, pickShowToOpen, writeToHandle } from '../files/fs-access';
import { onLaunchFile } from '../files/launch';
import { addRecent, listRecent, removeRecent, sameHandle, type RecentFile } from '../files/recent';
import { takeSharedFile } from '../files/share-target';
import { parseShowFile, serialiseShow, toShowFile } from '../files/show-io';
import { exampleShow, library, libraryByName } from '../library';
import { printFooter } from '../print/footer';
import { LoadSheet } from '../print/LoadSheet';
import type { ShowFile } from '../schema/show-file';
import { CompareDialog } from './CompareDialog';
import { Dialog } from './Dialog';
import { docReducer, isDirty, newDoc } from './document';
import { currentHang, type EditorAction } from './editor';
import { contingencyToPercent, formatDate, formatKg, showFileName } from './format';
import { LibraryViewer } from './LibraryViewer';
import { RecentFilesDialog } from './RecentFilesDialog';
import { HangPanel, JobPanel } from './Panels';
import { SummaryPanel } from './SummaryPanel';
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
  const [restoreOffer, setRestoreOffer] = useState<AutosaveRecord | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [printOverflow, setPrintOverflow] = useState(false);

  const show = doc.show;
  const hang = currentHang(show);
  const result = useMemo(() => calculate(hang, show.job.contingency), [hang, show.job.contingency]);
  const dirty = useMemo(() => isDirty(doc), [doc]);
  const contingencyLabel = `(+${contingencyToPercent(show.job.contingency)}%)`;
  const dispatchEdit = (action: EditorAction) => dispatch({ type: 'edit', action });

  // Latest values for handlers registered once (launch queue, share target).
  const latest = useRef({ dirty, title: showTitle(show), restorePending: false });
  useEffect(() => {
    latest.current = { dirty, title: showTitle(show), restorePending: restoreOffer !== null };
  });

  // ---- Autosave: offer to restore on start, then keep a copy while there are unsaved changes.
  useEffect(() => {
    readAutosave(store)
      .then((record) => {
        if (record) setRestoreOffer(record);
        else setAutosaveReady(true);
      })
      .catch(() => {
        setAutosaveFailed(true);
        setAutosaveReady(true);
      });
  }, []);

  useEffect(() => {
    if (!autosaveReady) return;
    const timer = setTimeout(() => {
      const write =
        dirty && !doc.locked
          ? writeAutosave(store, {
              writtenAt: Date.now(),
              fileName: doc.fileName,
              savedFingerprint: doc.savedFingerprint,
              locked: doc.locked,
              show: toShowFile(doc.show, { appVersion: __APP_VERSION__, specVersion: doc.show.spec_version, savedAt: new Date() }),
              handle,
            })
          : clearAutosave(store);
      write.then(() => setAutosaveFailed(false)).catch(() => setAutosaveFailed(true));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
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

  const onPrint = () => {
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
  ) => {
    dispatch({ type: 'open', show: file, fileName });
    setHandle(fileHandle);
    if (fileHandle) rememberRecent(fileHandle);
    // Keep an autosave the user has not yet answered the restore question about.
    if (!latest.current.restorePending) clearAutosave(store).catch(() => setAutosaveFailed(true));
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
  const openText = (text: string, fileName: string, fileHandle: FileSystemFileHandle | null) => {
    const r = parseShowFile(text);
    if (!r.ok) {
      setFileError({ title: `Could not open ${fileName}`, message: r.message, details: r.details, unchanged: true });
      return;
    }
    afterOpen(r.show, fileName, r.migratedFrom, fileHandle);
  };

  /** Open a file the app holds a handle for (picker, recent list, double-click). */
  const openFromHandle = async (h: FileSystemFileHandle) => {
    try {
      if (!(await ensurePermission(h, 'read'))) {
        setFileError({ title: `Could not open ${h.name}`, message: 'Permission to read the file was not given.', details: [], unchanged: true });
        return;
      }
      const file = await h.getFile();
      openText(await readFileText(file), file.name, h);
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
  const startup = useRef({ openText, openFromHandle, confirmDiscard });
  useEffect(() => {
    startup.current = { openText, openFromHandle, confirmDiscard };
  });
  useEffect(() => {
    if (fsAccessSupported()) listRecent(store).then(setRecent).catch(() => undefined);
    onLaunchFile((h) => {
      if (!startup.current.confirmDiscard(`Open ${h.name}`)) return;
      void startup.current.openFromHandle(h);
    });
    takeSharedFile()
      .then((shared) => {
        if (!shared) return;
        if ('error' in shared) setFileError({ title: 'Could not open the shared file', message: shared.error, details: [], unchanged: true });
        else startup.current.openText(shared.text, shared.name, null);
      })
      .catch(() => undefined);
  }, []);

  const onNew = () => {
    if (!confirmDiscard('Start a new show')) return;
    dispatch({ type: 'new', specVersion: library.spec_version });
    setHandle(null);
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setComparison(null);
    setNotice(null);
    setView('editor');
  };

  const onOpenClick = () => {
    if (!confirmDiscard('Open another show')) return;
    if (!fsAccess) {
      fileInput.current?.click();
      return;
    }
    pickShowToOpen()
      .then((h) => (h ? openFromHandle(h) : undefined))
      .catch((e) => setFileError({ title: 'Could not open a file', message: errorText(e, 'The file picker failed.'), details: [], unchanged: true }));
  };

  const onRecentOpen = (f: RecentFile) => {
    if (!confirmDiscard(`Open ${f.name}`)) return;
    setRecentOpen(false);
    void openFromHandle(f.handle);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
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
    return { text: serialiseShow(file), defaultName, specVersion };
  };

  const afterSave = (fileName: string, specVersion: string, message: string) => {
    dispatch({ type: 'saved', fileName, specVersion });
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setNotice(message);
  };

  const saveFailed = (e: unknown) =>
    setFileError({ title: 'The show was not saved', message: errorText(e, 'The file could not be written.'), details: [], unchanged: false });

  /** Layer 2: choose where to save, then keep saving there. */
  const onSaveAs = async () => {
    const { text, defaultName, specVersion } = prepareSave();
    try {
      const h = await pickSaveLocation(defaultName);
      if (!h) return;
      await writeToHandle(h, text);
      setHandle(h);
      rememberRecent(h);
      afterSave(h.name, specVersion, `Saved as ${h.name}. Save will now update this file.`);
    } catch (e) {
      saveFailed(e);
    }
  };

  const onSave = async () => {
    if (!fsAccess) {
      // Layer 1: every browser.
      const { text, defaultName, specVersion } = prepareSave();
      downloadText(text, defaultName);
      afterSave(defaultName, specVersion, `Saved as ${defaultName} – check your downloads folder. Keep that file: it is the record.`);
      return;
    }
    if (!handle) {
      await onSaveAs();
      return;
    }
    const { text, specVersion } = prepareSave();
    try {
      if (!(await ensurePermission(handle, 'readwrite'))) {
        saveFailed(new Error(`Permission to save to ${handle.name} was not given. Use Save As to choose a file.`));
        return;
      }
      await writeToHandle(handle, text);
      rememberRecent(handle);
      afterSave(handle.name, specVersion, `Saved to ${handle.name}.`);
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

  const restore = () => {
    if (!restoreOffer) return;
    if (dirty && !window.confirm('Restoring will replace the show you have started. Continue?')) return;
    const r = restoreOffer;
    dispatch({ type: 'restore', show: r.show, fileName: r.fileName, savedFingerprint: r.savedFingerprint, locked: r.locked });
    setHandle(r.handle ?? null);
    setRestoreOffer(null);
    setAutosaveReady(true);
    setNotice('Unsaved changes restored. Save the show to keep them in a file.');
  };

  const discardRestore = () => {
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setRestoreOffer(null);
    setAutosaveReady(true);
  };

  return (
    <>
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

      <UpdatePrompt dirty={dirty} />

      {restoreOffer ? (
        <section className="banner banner-restore" aria-labelledby="restore-heading">
          <h2 id="restore-heading">
            Restore unsaved changes to {showTitle(restoreOffer.show)}?
          </h2>
          <p>
            Autosaved {formatDate(new Date(restoreOffer.writtenAt).toISOString().slice(0, 10))}{' '}
            {new Date(restoreOffer.writtenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Autosave
            is a safety net in this browser only – the saved file is the record.
          </p>
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
            <fieldset className="lock editor" disabled={doc.locked}>
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
            hang={hang}
            result={result}
            contingencyLabel={contingencyLabel}
            locked={doc.locked}
            dispatch={dispatchEdit}
          />
        </div>
      )}

      {view === 'editor' ? (
        <a className="mini-summary" href="#summary" aria-label="Go to summary">
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
    </>
  );
}

