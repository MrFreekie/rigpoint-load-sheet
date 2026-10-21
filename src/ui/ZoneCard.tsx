// One card per zone: its rows, in load-path order, with add, delete and reorder.

import type { Dispatch } from 'react';
import type { HoistOrientation, RowFlag, RowResult, ZoneKey } from '../engine/types';
import { ZONE_NAMES } from '../engine/types';
import { libraryByName } from '../library';
import type { EditorAction, EditorRow } from './editor';
import { NumberField, TextField } from './fields';
import { formatKg, formatSpecKg, formatSwl } from './format';
import { ItemPicker } from './ItemPicker';
import { TrafficLight } from './TrafficLight';

const LIST_HINT = 'List top-down. Each item carries what is listed below it';

export function zoneHint(zone: ZoneKey, orientation: HoistOrientation): string {
  switch (zone) {
    case 'top_rigging':
      return `Everything above the hoist: steels, beam clamps, slings to structure. ${LIST_HINT}, plus every zone below.`;
    case 'hoist':
      return orientation === 'body_down'
        ? 'Hoist body, chain, chain bag, hoist cables and connectors. Body down: every rated item here carries this whole zone plus the hook load.'
        : 'Hoist body, chain, chain bag, hoist cables and connectors. Body up: rated items here carry the hook load only.';
    case 'hook':
      return `Below the hoist hook, feeding both paths: shackles, master link. ${LIST_HINT}, plus both load paths.`;
    case 'path1':
      return `Array frames then loudspeakers, e.g. M-BAR, M-BUMP, boxes. ${LIST_HINT}.`;
    case 'path2':
      return `Cable pick sling, multicores, splits – hung from the junction, not the array frames. ${LIST_HINT}.`;
  }
}

const FLAG_TEXT: Record<RowFlag, string> = {
  TBC: 'no recorded weight, excluded from totals',
  'LEN?': 'enter a length, excluded from totals',
  'NOT FOUND': 'no weight data, excluded from totals',
};

function FlagBadge({ flag }: { flag: RowFlag }) {
  return (
    <span className="flag" title={FLAG_TEXT[flag]}>
      ⚠ {flag}
      <span className="visually-hidden"> – {FLAG_TEXT[flag]}</span>
    </span>
  );
}

interface ZoneCardProps {
  zone: ZoneKey;
  rows: EditorRow[];
  results: RowResult[];
  subtotal: number;
  contingencyLabel: string;
  orientation: HoistOrientation;
  dispatch: Dispatch<EditorAction>;
}

export function ZoneCard({ zone, rows, results, subtotal, contingencyLabel, orientation, dispatch }: ZoneCardProps) {
  const headingId = `zone-${zone}`;
  return (
    <section className={`card zone zone-${zone}`} aria-labelledby={headingId}>
      <header className="zone-header">
        <h2 id={headingId}>{ZONE_NAMES[zone]}</h2>
        <p className="zone-subtotal">
          Subtotal <strong>{formatKg(subtotal)}</strong>
        </p>
        <p className="zone-hint">{zoneHint(zone, orientation)}</p>
      </header>

      {rows.length === 0 ? <p className="zone-empty">No rows yet.</p> : null}

      <ol className="rows">
        {rows.map((row, i) => {
          const res = results[i];
          return res ? (
            <RowEditor
              key={row.key}
              zone={zone}
              index={i}
              count={rows.length}
              row={row}
              res={res}
              contingencyLabel={contingencyLabel}
              dispatch={dispatch}
            />
          ) : null;
        })}
      </ol>

      <button type="button" className="button add-row" onClick={() => dispatch({ type: 'row/add', zone })}>
        + Add row to {ZONE_NAMES[zone]}
      </button>
    </section>
  );
}

interface RowEditorProps {
  zone: ZoneKey;
  index: number;
  count: number;
  row: EditorRow;
  res: RowResult;
  contingencyLabel: string;
  dispatch: Dispatch<EditorAction>;
}

function RowEditor({ zone, index, count, row, res, contingencyLabel, dispatch }: RowEditorProps) {
  const n = index + 1;
  const label = `${ZONE_NAMES[zone]} row ${n}`;
  const snap = row.snapshot;
  const perMetre = snap?.per === 'm';
  const notInLibrary = row.item !== null && !libraryByName.has(row.item);
  // How the library figure is meant to be used, e.g. a 2-fall chain is weighed per metre of HOL.
  const weightNote = row.item ? (libraryByName.get(row.item)?.weight_note ?? null) : null;

  // Keep keyboard focus on the row that moved, so it can be moved again straight away.
  const move = (delta: -1 | 1) => {
    dispatch({ type: 'row/move', zone, index, delta });
    const target = `${ZONE_NAMES[zone]} row ${index + delta + 1}`;
    requestAnimationFrame(() => {
      const same = document.querySelector<HTMLButtonElement>(`button[aria-label="Move ${target} ${delta < 0 ? 'up' : 'down'}"]`);
      const other = document.querySelector<HTMLButtonElement>(`button[aria-label="Move ${target} ${delta < 0 ? 'down' : 'up'}"]`);
      (same && !same.disabled ? same : other)?.focus();
    });
  };

  const remove = () => {
    if ((row.item || row.note) && !window.confirm(`Delete ${label}${row.note ? ` (${row.note})` : ''}?`)) return;
    dispatch({ type: 'row/delete', zone, index });
  };

  return (
    <li className={`row${res.flag ? ' row-flagged' : ''}`} aria-label={label}>
      <div className="row-number" aria-hidden="true">
        {n}
      </div>

      <div className="row-inputs">
        <TextField
          className="f-note"
          label="Note"
          context={label}
          value={row.note ?? ''}
          placeholder="e.g. Rigging Frame"
          onChange={(v) => dispatch({ type: 'row/update', zone, index, patch: { note: v === '' ? null : v } })}
        />
        <ItemPicker
          label="Item"
          context={label}
          value={row.item}
          onSelect={(item) => dispatch({ type: 'row/item', zone, index, item })}
        />
        <NumberField
          className="f-qty"
          label="Qty"
          context={label}
          integer
          value={row.qty}
          onChange={(v) => dispatch({ type: 'row/update', zone, index, patch: { qty: v } })}
        />
        <NumberField
          className="f-length"
          label="Length"
          context={label}
          unit="m"
          value={perMetre ? row.length_m : null}
          disabled={!perMetre}
          placeholder={perMetre ? '' : '–'}
          onChange={(v) => dispatch({ type: 'row/update', zone, index, patch: { length_m: v } })}
        />
      </div>

      <div className="row-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${label} up`}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${label} down`}
          disabled={index === count - 1}
          onClick={() => move(1)}
        >
          ↓
        </button>
        <button type="button" className="icon-button danger" aria-label={`Delete ${label}`} onClick={remove}>
          ✕
        </button>
      </div>

      <dl className="row-readout">
        <div>
          <dt>Unit</dt>
          <dd>
            {!row.item ? '–' : snap?.kg == null ? 'TBC' : `${formatSpecKg(snap.kg, snap.per)}${snap.per === 'each' ? ' each' : ''}`}
            {notInLibrary ? <span className="badge">not in current library</span> : null}
          </dd>
        </div>
        <div>
          <dt>Line weight</dt>
          <dd>{res.flag ? <FlagBadge flag={res.flag} /> : res.line_kg === null ? '–' : formatKg(res.line_kg)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className="num-strong">{res.flag ? <FlagBadge flag={res.flag} /> : res.total_kg === null ? '–' : formatKg(res.total_kg)}</dd>
        </div>
        <div>
          <dt>SWL / WLL</dt>
          <dd>{res.rated && res.swl_kg !== null ? formatSwl(res.swl_kg) : row.item ? 'not rated' : '–'}</dd>
        </div>
        <div>
          <dt>Carried {contingencyLabel}</dt>
          <dd>{res.carried_design === null ? '–' : formatKg(res.carried_design)}</dd>
        </div>
        <div>
          <dt>Used</dt>
          <dd>{res.used === null ? (row.item ? 'not checked' : '–') : <TrafficLight used={res.used} light={res.light} />}</dd>
        </div>
      </dl>
      {weightNote ? (
        <p className="row-note">
          <span aria-hidden="true">ⓘ </span>
          {weightNote}
        </p>
      ) : null}
    </li>
  );
}
