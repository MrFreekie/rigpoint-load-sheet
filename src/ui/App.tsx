import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { calculate } from '../engine/calculate';
import { ZONES } from '../engine/types';
import { clearAutosave, indexedDbStore, readAutosave, writeAutosave, type AutosaveRecord } from '../files/autosave';
import { compareWithLibrary, type Comparison } from '../files/compare';
import { downloadText, readFileText } from '../files/download';
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
import { HangPanel, JobPanel } from './Panels';
import { SummaryPanel } from './SummaryPanel';
import { TrafficLight } from './TrafficLight';
import { ZoneCard } from './ZoneCard';

type View = 'editor' | 'library';

const AUTOSAVE_DELAY_MS = 1000;
const store = indexedDbStore();

function showTitle(show: { job: { name: string }; hangs: { name: string }[] }): string {
  const parts = [show.job.name, show.hangs[0]?.name].filter(Boolean);
  return parts.length ? parts.join(' – ') : 'Untitled show';
}

const STATUS_WORDS = { approved: 'Approved', superseded: 'Superseded', draft: 'Draft', issued: 'Issued' } as const;

interface OpenError {
  fileName: string;
  message: string;
  details: string[];
}

export function App() {
  const [doc, dispatch] = useReducer(docReducer, library.spec_version, newDoc);
  const [view, setView] = useState<View>('editor');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [openError, setOpenError] = useState<OpenError | null>(null);
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
            })
          : clearAutosave(store);
      write.then(() => setAutosaveFailed(false)).catch(() => setAutosaveFailed(true));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doc, dirty, autosaveReady]);

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
    !dirty || window.confirm(`${what}? Unsaved changes to ${showTitle(show)} will be lost.`);

  const afterOpen = (file: ShowFile, fileName: string | null, migratedFrom: string | null) => {
    dispatch({ type: 'open', show: file, fileName });
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setView('editor');
    const c = compareWithLibrary(file, libraryByName, library.spec_version);
    setComparison(c.anyDifferences ? c : null);
    const parts = [
      fileName ? `Opened ${fileName}.` : null,
      migratedFrom ? `It was upgraded from format ${migratedFrom}; save it to keep the upgrade.` : null,
    ].filter(Boolean);
    setNotice(parts.length ? parts.join(' ') : null);
  };

  const onNew = () => {
    if (!confirmDiscard('Start a new show')) return;
    dispatch({ type: 'new', specVersion: library.spec_version });
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setComparison(null);
    setNotice(null);
    setView('editor');
  };

  const onOpenClick = () => {
    if (!confirmDiscard('Open another show')) return;
    fileInput.current?.click();
  };

  const onFileChosen = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await readFileText(file);
    } catch (e) {
      setOpenError({ fileName: file.name, message: e instanceof Error ? e.message : 'The file could not be read.', details: [] });
      return;
    }
    const r = parseShowFile(text);
    if (!r.ok) {
      setOpenError({ fileName: file.name, message: r.message, details: r.details });
      return;
    }
    afterOpen(r.show, file.name, r.migratedFrom);
  };

  const onLoadExample = () => {
    if (!confirmDiscard('Load the Ballroom example')) return;
    afterOpen(exampleShow(), null, null);
  };

  const onSave = () => {
    const job = show.job;
    const fileName = showFileName(job.name, hang.name, job.revision);
    // The file records the library version its snapshots come from: the current one only
    // when every snapshot matches it, otherwise the version it was opened with.
    const matchesLibrary = !compareWithLibrary(show, libraryByName, library.spec_version).anyDifferences;
    const specVersion = matchesLibrary ? library.spec_version : show.spec_version;
    const file = toShowFile(show, { appVersion: __APP_VERSION__, specVersion, savedAt: new Date() });
    downloadText(serialiseShow(file), fileName);
    dispatch({ type: 'saved', fileName, specVersion });
    clearAutosave(store).catch(() => setAutosaveFailed(true));
    setNotice(`Saved as ${fileName} – check your downloads folder. Keep that file: it is the record.`);
  };

  const onNewRevision = () => {
    const before = show.job.revision;
    dispatch({ type: 'new-revision' });
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
          <button type="button" className="button primary" onClick={onSave} disabled={doc.locked}>
            Save
          </button>
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

      {openError ? (
        <Dialog
          title={`Could not open ${openError.fileName}`}
          onClose={() => setOpenError(null)}
          actions={
            <button type="button" className="button" onClick={() => setOpenError(null)}>
              OK
            </button>
          }
        >
          <p>{openError.message}</p>
          {openError.details.length ? (
            <ul className="error-list">
              {openError.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className="section-hint">Nothing was changed. The show you had open is still open.</p>
        </Dialog>
      ) : null}

      <footer className="app-footer">
        <p>
          A calculation aid. It does not replace assessment by a competent person. Static weights only, in kilograms; no
          dynamic, derating or safety factor is applied.
        </p>
        <p>
          Show files stay on your device: Open reads a file you choose and Save downloads one. Autosave keeps a copy in this
          browser only, as a safety net – the saved file is the record.
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

