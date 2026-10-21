import { useMemo, useReducer, useState } from 'react';
import { calculate } from '../engine/calculate';
import { ZONES } from '../engine/types';
import { exampleShow, library } from '../library';
import { currentHang, editorReducer, hasContent, newShow, type EditorShow } from './editor';
import { contingencyToPercent, formatKg } from './format';
import { LibraryViewer } from './LibraryViewer';
import { HangPanel, JobPanel } from './Panels';
import { SummaryPanel } from './SummaryPanel';
import { TrafficLight } from './TrafficLight';
import { ZoneCard } from './ZoneCard';

type View = 'editor' | 'library';

function showTitle(show: EditorShow): string {
  const parts = [show.job.name, show.hangs[0]?.name].filter(Boolean);
  return parts.length ? parts.join(' – ') : 'Untitled show';
}

export function App() {
  const [show, dispatch] = useReducer(editorReducer, library.spec_version, newShow);
  const [view, setView] = useState<View>('editor');
  const hang = currentHang(show);
  const result = useMemo(() => calculate(hang, show.job.contingency), [hang, show.job.contingency]);
  const contingencyLabel = `(+${contingencyToPercent(show.job.contingency)}%)`;

  const replace = (what: string, act: () => void) => {
    if (hasContent(show) && !window.confirm(`${what}? The current show will be cleared.`)) return;
    act();
    setView('editor');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">RigPoint</span> <span className="brand-app">Load Sheet</span>
        </div>
        <p className="show-title" title={showTitle(show)}>
          {showTitle(show)}
        </p>
        <nav className="header-actions" aria-label="Show">
          <button type="button" className="button" onClick={() => replace('Start a new show', () => dispatch({ type: 'new', specVersion: library.spec_version }))}>
            New
          </button>
          <button type="button" className="button" onClick={() => replace('Load the Ballroom example', () => dispatch({ type: 'load', show: exampleShow() }))}>
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
        </nav>
        <p className="versions">
          App {__APP_VERSION__} · Spec {library.spec_version}
        </p>
      </header>

      {view === 'library' ? (
        <main className="main-library">
          <LibraryViewer />
        </main>
      ) : (
        <div className="layout">
          <main className="editor" aria-label="Load sheet editor">
            <JobPanel job={show.job} dispatch={dispatch} />
            <HangPanel hang={hang} dispatch={dispatch} />
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
                dispatch={dispatch}
              />
            ))}
          </main>
          <SummaryPanel hang={hang} result={result} contingencyLabel={contingencyLabel} dispatch={dispatch} />
        </div>
      )}

      {view === 'editor' ? (
        <a className="mini-summary" href="#summary" aria-label="Go to summary">
          <span>{formatKg(result.total_static)}</span>
          {result.governing ? <TrafficLight used={result.governing.used} light={result.governing.light} /> : <span>no rated items</span>}
          {!result.data_ok ? <span className="mini-flag">⚠ data</span> : null}
        </a>
      ) : null}

      <footer className="app-footer">
        <p>
          A calculation aid. It does not replace assessment by a competent person. Static weights only, in kilograms;
          no dynamic, derating or safety factor is applied.
        </p>
      </footer>
    </div>
  );
}
