// Summary panel. Displays engine results; computes nothing itself.

import { useState, type Dispatch } from 'react';
import { NO_RATED_ITEM_IN_ZONE, tieSuffix } from '../engine/messages';
import { ZONE_NAMES, ZONES, type HangResult } from '../engine/types';
import type { EditorAction, EditorHang } from './editor';
import { MAX_POINT_KG } from '../schema/limits';
import { ChoiceField, NumberField, TextField } from './fields';
import { formatKg, formatSwl } from './format';
import { TrafficLight } from './TrafficLight';

interface Props {
  hang: EditorHang;
  result: HangResult;
  contingencyLabel: string;
  /** Approved or superseded: the point inputs are read-only. */
  locked: boolean;
  dispatch: Dispatch<EditorAction>;
}

export function SummaryPanel({ hang, result: r, contingencyLabel, locked, dispatch }: Props) {
  // Collapsible on narrow screens only; on desktop the CSS keeps the body visible.
  const [open, setOpen] = useState(false);
  const pc = hang.point_capacity;
  const pointWarn = r.point_status === 'no_source' || r.point_status === 'exceeded';

  return (
    <aside className={`card summary${open ? ' open' : ''}`} aria-labelledby="summary-heading" id="summary">
      <div className="summary-top">
        <h2 id="summary-heading">Summary</h2>
        <button
          type="button"
          className="button summary-toggle"
          aria-expanded={open}
          aria-controls="summary-body"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide details' : 'Show details'}
        </button>
      </div>

      <div className="governing" aria-live="polite">
        <p className="governing-label">Governing component</p>
        <p className="governing-item">{r.governing_label}</p>
        {r.governing ? (
          <p className="governing-figures">
            <TrafficLight used={r.governing.used} light={r.governing.light} large />
            <span className="governing-zone">{ZONE_NAMES[r.governing.zone]}</span>
          </p>
        ) : null}
        <p className="governing-note">Equipment only – the connection point is reported separately.</p>
      </div>

      <p className="total-static">
        Total static weight <strong>{formatKg(r.total_static)}</strong>
      </p>

      <p className={r.data_ok ? 'data-ok' : 'warning'} role="status">
        {r.data_check_message}
      </p>

      <div className="summary-body" id="summary-body">
        {!r.data_ok ? (
          <ul className="flag-list">
            {r.flags.map((f) => (
              <li key={`${f.zone}-${f.index}`}>
                {f.flag}: {ZONE_NAMES[f.zone]} row {f.index + 1}
                {f.note ? ` (${f.note})` : ''} – {f.item}
              </li>
            ))}
          </ul>
        ) : null}

        {r.warnings.length ? (
          <ul className="warning-list" aria-label="Warnings">
            {r.warnings.map((w) => (
              <li key={w.code} className="warning">
                ⚠ {w.message}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="point" aria-labelledby="point-heading">
          <h3 id="point-heading">Connection point</h3>
          <dl className="figures">
            <div>
              <dt>
                Static load at point – <strong>UNFACTORED</strong>
                <span className="dt-sub">figure for structural assessment / approval</span>
              </dt>
              <dd>{formatKg(r.static_load_point)}</dd>
            </div>
            <div>
              <dt>Contingency {contingencyLabel}</dt>
              <dd>{formatKg(r.contingency_kg)}</dd>
            </div>
            <div className="figure-strong">
              <dt>
                Design load at point
                <span className="dt-sub">rigging capacity check</span>
              </dt>
              <dd>{formatKg(r.design_load_point)}</dd>
            </div>
          </dl>

          <fieldset className="lock grid point-inputs" disabled={locked}>
            <legend className="visually-hidden">Stated point capacity</legend>
            <NumberField
              label="Stated point capacity"
              unit="kg"
              max={MAX_POINT_KG}
              value={pc.kg}
              hint="Leave blank if the design load is being submitted for approval."
              onChange={(v) => dispatch({ type: 'point', field: 'kg', value: v })}
            />
            <TextField
              label="Source of figure"
              value={pc.source}
              onChange={(v) => dispatch({ type: 'point', field: 'source', value: v })}
            />
            <TextField
              className="span-2"
              label="Conditions / limitations"
              value={pc.conditions}
              onChange={(v) => dispatch({ type: 'point', field: 'conditions', value: v })}
            />
            <ChoiceField
              className="span-2"
              legend="Print stated capacity on Load Sheet?"
              value={pc.print}
              options={[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ]}
              onChange={(v) => dispatch({ type: 'point', field: 'print', value: v })}
            />
          </fieldset>

          <p className={pointWarn ? 'warning' : 'point-status'} role="status">
            {r.point_used !== null ? (
              <>
                <TrafficLight used={r.point_used} light={r.point_light} />{' '}
              </>
            ) : null}
            {r.point_message}
          </p>
        </section>

        <section aria-labelledby="capacity-heading">
          <h3 id="capacity-heading">Capacity summary</h3>
          <p className="section-hint">Each component checked against the load it carries.</p>
          <table className="capacity">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Governing component</th>
                <th scope="col">SWL / WLL</th>
                <th scope="col">Carried {contingencyLabel}</th>
                <th scope="col">Used</th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => {
                const g = r.zone_governing[z];
                return (
                  <tr key={z}>
                    <th scope="row">{ZONE_NAMES[z]}</th>
                    <td data-label="Governing component">
                      {g ? `${g.item ?? ''}${tieSuffix(g.ties)}` : NO_RATED_ITEM_IN_ZONE}
                    </td>
                    <td data-label="SWL / WLL">{g ? formatSwl(g.swl_kg) : ''}</td>
                    <td data-label={`Carried ${contingencyLabel}`}>{g ? formatKg(g.carried_design) : ''}</td>
                    <td data-label="Used">{g ? <TrafficLight used={g.used} light={g.light} /> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </aside>
  );
}
