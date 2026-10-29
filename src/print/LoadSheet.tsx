// The Load Sheet: the formal one-page A4 document.
// Laid out like the workbook's "Load Sheet" tab. Displays engine results; computes nothing.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NO_RATED_ITEM_IN_ZONE } from '../engine/messages';
import { ZONE_NAMES, ZONES, type HangResult, type Light, type RowResult, type ZoneKey } from '../engine/types';
import type { EditorHang, EditorShow } from '../ui/editor';
import { formatDate, formatKg, formatPct, formatSwl, LIGHT_WORDS } from '../ui/format';
import { tieSuffix } from '../engine/messages';
import { SMALL_PRINT } from './small-print';
import './print.css';

/** Zone headings as printed in the workbook. */
const ZONE_HEADINGS: Record<ZoneKey, string> = {
  top_rigging: 'TOP RIGGING – above the hoist (list top-down)',
  hoist: 'HOIST – body, chain, bag and hoist cables',
  hook: 'HOOK / JUNCTION – below the hoist, feeds both paths',
  path1: 'LOAD PATH 1 – ARRAY (list top-down)',
  path2: 'LOAD PATH 2 – CABLES & CABLE PICK (list top-down)',
};

/** Rows per zone in the workbook. Zones are padded to this with empty ruled rows, always at least one. */
const ZONE_SLOTS: Record<ZoneKey, number> = { top_rigging: 3, hoist: 8, hook: 4, path1: 6, path2: 6 };

const TOP_RIGGING_STATEMENT = {
  yes: 'Included – components above the hoist are listed in the top rigging zone and checked.',
  no: 'NOT INCLUDED – components above the hoist are not listed and not checked.',
};
const HOIST_STATEMENT = {
  body_down: 'Body down – hoist checked against its own weight, chain, bag and cables plus the hook load.',
  body_up: 'Body up – hoist checked against the hook load; its own weight, chain and cables hang on the top rigging.',
};
const POINT_FOR_APPROVAL = 'Design load submitted for approval by the venue / structural engineer.';

/** Printable area of A4 portrait with 10 mm margins. */
const PAGE_W_MM = 190;
const PAGE_H_MM = 276; // 1 mm under 277 so rounding never spills a blank second page
const PX_PER_MM = 96 / 25.4;
/** Below this the text would be too small to read; let it run to a second page instead. */
const MIN_SCALE = 0.72;

const STATUS_WORDS = { draft: 'Draft', issued: 'Issued', approved: 'Approved', superseded: 'Superseded' } as const;
const yesNo = (v: boolean | null) => (v === null ? '– not stated –' : v ? 'Yes' : 'No');
const lengthFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 });

function Light({ used, light }: { used: number; light: Light | null }) {
  return (
    <span className={`ls-light ls-light-${light ?? 'none'}`}>
      {formatPct(used)}
      {light ? <strong> {LIGHT_WORDS[light]}</strong> : null}
    </span>
  );
}

function weightCell(r: RowResult): string {
  if (r.flag) return r.flag;
  return r.total_kg === null ? '' : formatKg(r.total_kg);
}

interface Props {
  show: EditorShow;
  hang: EditorHang;
  result: HangResult;
  /** e.g. "(+5%)" */
  contingencyLabel: string;
  footer: string;
  /** Called when the content no longer fits one page even at the smallest scale. */
  onOverflow?: (overflow: boolean) => void;
}

export function LoadSheet({ show, hang, result: r, contingencyLabel, footer, onOverflow }: Props) {
  const job = show.job;
  const pc = hang.point_capacity;
  const printCapacity = pc.print && pc.kg !== null && pc.kg > 0 && r.point_used !== null;

  // Fit to one page, like the workbook's "fit to 1 page" print setting.
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [overflow, setOverflow] = useState(false);
  // Only when the sheet runs onto more pages: the height of the scaled content in px.
  // A transform does not change layout height, so without this the page would stay as tall
  // as the unscaled content and leave a blank trailing page.
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  // Re-measured whenever the content changes, and on resize (e.g. late font loading).
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    // offsetHeight is the unscaled layout height: transforms do not change it.
    const measure = () => {
      const needed = Math.min(1, PAGE_H_MM / (el.offsetHeight / PX_PER_MM));
      const used = Math.max(MIN_SCALE, Math.floor(needed * 1000) / 1000);
      setScale(used);
      setOverflow(needed < MIN_SCALE);
      setScaledHeight(needed < MIN_SCALE ? Math.floor(el.offsetHeight * used) : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [show, hang, r, footer, contingencyLabel]);

  useEffect(() => onOverflow?.(overflow), [overflow, onOverflow]);

  return (
    <div
      className={`ls-page${overflow ? ' ls-page-overflow' : ''}`}
      style={overflow && scaledHeight !== null ? { height: `${scaledHeight}px` } : undefined}
      data-testid="load-sheet"
    >
      {job.status === 'draft' ? (
        // Fixed when printing, so the browser repeats it on every page however many there are
        // (see print.css); the page count is decided by the browser, not by us.
        <div className="ls-watermark" aria-hidden="true">
          DRAFT
        </div>
      ) : null}
      <div
        ref={content}
        className="ls-content"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined, width: `${PAGE_W_MM}mm` }}
      >
        <header className="ls-title">
          <h1>FLOWN ARRAY LOAD SHEET</h1>
          <p>Static load-path analysis – single hang</p>
        </header>

        <table className="ls-header">
          <tbody>
            <tr>
              <th>Job:</th>
              <td>{job.name}</td>
              <th>Status:</th>
              <td>{STATUS_WORDS[job.status]}</td>
            </tr>
            <tr>
              <th>Venue:</th>
              <td>{job.venue}</td>
              <th>Revision:</th>
              <td>{job.revision}</td>
            </tr>
            <tr>
              <th>Sub System:</th>
              <td>{hang.name}</td>
              <th>Job Date:</th>
              <td>{formatDate(job.date)}</td>
            </tr>
            <tr>
              <th>Point ID / Location:</th>
              <td>{hang.point_id}</td>
              <th>Designer:</th>
              <td>{job.designer}</td>
            </tr>
            <tr>
              <th>Load over people?</th>
              <td>{yesNo(hang.over_people)}</td>
              <th>Hoist orientation:</th>
              <td>{hang.hoist_orientation === 'body_up' ? 'Body up' : 'Body down'}</td>
            </tr>
            <tr>
              <th>Top rigging included?</th>
              <td className={hang.top_rigging_included ? '' : 'ls-red'}>{yesNo(hang.top_rigging_included)}</td>
              <th>Sheet Date:</th>
              <td className="ls-write-in">{formatDate(job.sheet_date)}</td>
            </tr>
          </tbody>
        </table>

        <table className="ls-items">
          <colgroup>
            <col className="c-note" />
            <col className="c-item" />
            <col className="c-qty" />
            <col className="c-len" />
            <col className="c-weight" />
            <col className="c-swl" />
            <col className="c-carried" />
            <col className="c-used" />
          </colgroup>
          <thead>
            <tr>
              <th>NOTES</th>
              <th>ITEM</th>
              <th className="num">Qty</th>
              <th className="num">Length (m)</th>
              <th className="num">Weight</th>
              <th className="num">SWL / WLL</th>
              <th className="num">Carried load {contingencyLabel}</th>
              <th className="num">Used</th>
            </tr>
          </thead>
          {ZONES.map((z) => {
            const rows = hang.zones[z];
            const blanks = Math.max(1, ZONE_SLOTS[z] - rows.length);
            return (
              <tbody key={z}>
                <tr className="ls-zone">
                  <th colSpan={4} scope="rowgroup">
                    {ZONE_HEADINGS[z]}
                  </th>
                  <td className="num">{formatKg(r.subtotals[z])}</td>
                  <td colSpan={3} />
                </tr>
                {rows.map((row, i) => {
                  const res = r.rows[z][i];
                  if (!res) return null;
                  const perMetre = row.snapshot?.per === 'm';
                  return (
                    <tr key={row.key} className={res.flag ? 'ls-flagged' : undefined}>
                      <td>{row.note ?? ''}</td>
                      <td>{row.item ?? ''}</td>
                      <td className="num">{row.item && row.qty !== null ? row.qty : ''}</td>
                      <td className="num">{perMetre && row.length_m ? lengthFmt.format(row.length_m) : ''}</td>
                      <td className="num">{weightCell(res)}</td>
                      <td className="num">{res.rated && res.swl_kg !== null ? formatSwl(res.swl_kg) : row.item ? '–' : ''}</td>
                      <td className="num">{res.carried_design === null ? '' : formatKg(res.carried_design)}</td>
                      <td className="num">{res.used === null ? '' : <Light used={res.used} light={res.light} />}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: blanks }, (_, i) => (
                  <tr key={`blank-${i}`} className="ls-blank" aria-hidden="true">
                    <td colSpan={8} />
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tbody>
            <tr className="ls-total">
              <th colSpan={4} scope="row">
                TOTAL STATIC WEIGHT
              </th>
              <td className="num">{formatKg(r.total_static)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>

        <section className="ls-point">
          <h2>CONNECTION POINT</h2>
          <table className="ls-figures">
            <tbody>
              <tr>
                <th>
                  Static load – UNFACTORED <span className="ls-sub">(figure for structural assessment / approval)</span>
                </th>
                <td className="num">{formatKg(r.static_load_point)}</td>
              </tr>
              <tr>
                <th>
                  Contingency – unlisted items <span className="ls-sub">{contingencyLabel.replace(/[()+]/g, '')}</span>
                </th>
                <td className="num">{formatKg(r.contingency_kg)}</td>
              </tr>
              <tr className="ls-strong">
                <th>
                  DESIGN LOAD AT POINT <span className="ls-sub">(rigging capacity check)</span>
                </th>
                <td className="num">{formatKg(r.design_load_point)}</td>
              </tr>
            </tbody>
          </table>
          <p className="ls-line">
            <strong>Point capacity:</strong>{' '}
            {printCapacity
              ? `Stated ${formatSwl(pc.kg as number)} – ${formatPct(r.point_used as number)} used.  Source: ${
                  pc.source.trim() ? pc.source : 'NOT STATED'
                }${pc.conditions.trim() ? `  Conditions: ${pc.conditions}` : ''}`
              : POINT_FOR_APPROVAL}
          </p>
          {printCapacity && r.point_status === 'exceeded' ? <p className="ls-line ls-red">{r.point_message}</p> : null}
        </section>

        <section className="ls-capacity">
          <h2>
            CAPACITY SUMMARY <span className="ls-sub">(each component checked against the load it carries)</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Governing component</th>
                <th className="num">SWL / WLL</th>
                <th className="num">Carried load</th>
                <th className="num">Used</th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => {
                const g = r.zone_governing[z];
                return (
                  <tr key={z}>
                    <th scope="row">{ZONE_NAMES[z]}</th>
                    <td>{g ? `${g.item ?? ''}${tieSuffix(g.ties)}` : NO_RATED_ITEM_IN_ZONE}</td>
                    <td className="num">{g ? formatSwl(g.swl_kg) : ''}</td>
                    <td className="num">{g ? formatKg(g.carried_design) : ''}</td>
                    <td className="num">{g ? <Light used={g.used} light={g.light} /> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="ls-governing">
                <th scope="row">GOVERNING COMPONENT</th>
                <td colSpan={3}>{r.governing_label}</td>
                <td className="num">{r.governing ? <Light used={r.governing.used} light={r.governing.light} /> : ''}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="ls-statements">
          <p className={r.data_ok ? '' : 'ls-red'}>
            <strong>Data check:</strong> {r.data_check_message}
          </p>
          <p className={hang.top_rigging_included ? '' : 'ls-red'}>
            <strong>Top rigging:</strong> {hang.top_rigging_included ? TOP_RIGGING_STATEMENT.yes : TOP_RIGGING_STATEMENT.no}
          </p>
          <p>
            <strong>Hoist:</strong> {HOIST_STATEMENT[hang.hoist_orientation]}
          </p>
        </section>

        <section className="ls-small-print">
          {SMALL_PRINT.map((p) => (
            <p key={p.heading}>
              <strong className={p.warning ? 'ls-sp-warning' : 'ls-sp-heading'}>{p.heading}</strong> — {p.text}
            </p>
          ))}
        </section>

        <table className="ls-signatures">
          <tbody>
            <tr>
              <th>Prepared by:</th>
              <td />
              <th>Signature:</th>
              <td />
              <th>Date:</th>
              <td />
            </tr>
            <tr>
              <th>Checked by:</th>
              <td />
              <th>Signature:</th>
              <td />
              <th>Date:</th>
              <td />
            </tr>
          </tbody>
        </table>

        <footer className="ls-footer">{footer}</footer>
      </div>
    </div>
  );
}
