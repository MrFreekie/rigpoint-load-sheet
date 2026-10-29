// Compare-on-open. Nothing changes unless the user chooses "Update selected".

import { useState } from 'react';
import type { Comparison, FieldChange, ItemComparison } from '../files/compare';
import { ZONE_NAMES, type Per } from '../engine/types';
import { Dialog } from './Dialog';
import { formatSpecKg, formatSwl } from './format';

function describeChange(c: FieldChange, item: ItemComparison): string {
  const fromPer = item.saved.per;
  const toPer = (item.changes.find((x) => x.field === 'per')?.to as Per | undefined) ?? fromPer;
  switch (c.field) {
    case 'kg': {
      const f = (v: unknown, per: Per) => (typeof v === 'number' ? formatSpecKg(v, per) : 'TBC');
      return `weight ${f(c.from, fromPer)} → ${f(c.to, toPer)}`;
    }
    case 'per':
      return `per ${c.from === 'm' ? 'metre' : 'each'} → ${c.to === 'm' ? 'metre' : 'each'}`;
    case 'swl_kg': {
      const f = (v: unknown) => (typeof v === 'number' && v > 0 ? formatSwl(v) : 'not rated');
      return `SWL ${f(c.from)} → ${f(c.to)}`;
    }
  }
}

function describe(item: ItemComparison): string {
  if (item.status === 'removed') return 'no longer in library (snapshot kept)';
  if (item.status === 'unchanged') return 'no change';
  return item.changes.map((c) => describeChange(c, item)).join('; ');
}

const ORDER = { changed: 0, removed: 1, unchanged: 2 } as const;

interface Props {
  comparison: Comparison;
  readOnly: boolean;
  onUpdate: (items: Set<string>) => void;
  onClose: () => void;
}

export function CompareDialog({ comparison, readOnly, onUpdate, onClose }: Props) {
  const items = [...comparison.items].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const changed = items.filter((i) => i.status === 'changed');
  const differing = items.filter((i) => i.status !== 'unchanged');
  const unchanged = items.filter((i) => i.status === 'unchanged');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(changed.map((i) => i.item)));

  const toggle = (name: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(name);
    else next.delete(name);
    setSelected(next);
  };

  return (
    <Dialog
      title={`Library changes since this show was saved (spec ${comparison.fromSpec} → ${comparison.toSpec})`}
      onClose={onClose}
      actions={
        readOnly || changed.length === 0 ? (
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="button primary" disabled={selected.size === 0} onClick={() => onUpdate(selected)}>
              Update selected ({selected.size})
            </button>
            <button type="button" className="button" onClick={onClose}>
              Keep as saved
            </button>
          </>
        )
      }
    >
      {readOnly ? (
        <p className="warning">This show is approved or superseded, so it is read-only. The comparison is for information only.</p>
      ) : (
        <p className="section-hint">
          The show calculates from the values saved in it. Tick the items to update to the current library, or keep the
          show exactly as saved.
        </p>
      )}
      <ul className="compare-list">
        {differing.map((item, i) => (
          <CompareRow key={`${item.item}-${i}`} item={item} readOnly={readOnly} selected={selected} toggle={toggle} />
        ))}
      </ul>
      {unchanged.length ? (
        <details className="compare-unchanged-group">
          <summary>
            {unchanged.length} other item{unchanged.length === 1 ? '' : 's'} – no change
          </summary>
          <ul className="compare-list">
            {unchanged.map((item, i) => (
              <CompareRow key={`${item.item}-${i}`} item={item} readOnly selected={selected} toggle={toggle} />
            ))}
          </ul>
        </details>
      ) : null}
    </Dialog>
  );
}

function CompareRow({
  item,
  readOnly,
  selected,
  toggle,
}: {
  item: ItemComparison;
  readOnly: boolean;
  selected: ReadonlySet<string>;
  toggle: (name: string, on: boolean) => void;
}) {
  const where = item.rows.map((r) => `${ZONE_NAMES[r.zone]} row ${r.index + 1}`).join(', ');
  const text = (
    <>
      <strong>{item.item}</strong> — {describe(item)}
      <span className="compare-rows">{where}</span>
    </>
  );
  return (
    <li className={`compare-${item.status}`}>
      {item.status === 'changed' && !readOnly ? (
        <label className="checkbox">
          <input type="checkbox" checked={selected.has(item.item)} onChange={(e) => toggle(item.item, e.target.checked)} />
          <span>{text}</span>
        </label>
      ) : (
        <span>{text}</span>
      )}
    </li>
  );
}
