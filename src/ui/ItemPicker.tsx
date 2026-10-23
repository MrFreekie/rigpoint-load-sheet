// Type-to-search item picker: an ARIA 1.2 combobox over the Spec library.

import { useId, useMemo, useRef, useState } from 'react';
import { library } from '../library';
import type { SpecItem } from '../schema/spec-library';
import { contextName, FieldLabel } from './fields';
import { formatSpecKg, formatSwl } from './format';
import { searchItems } from './item-search';

const MAX_SHOWN = 60;

function itemMeta(i: SpecItem): string {
  const kg = i.kg === null ? 'weight TBC' : `${formatSpecKg(i.kg, i.per)}${i.per === 'each' ? ' each' : ''}`;
  const rated = i.swl_kg ? `${kg} · SWL ${formatSwl(i.swl_kg)}` : kg;
  return i.weight_note ? `${rated} · ${i.weight_note}` : rated;
}

interface Props {
  label: string;
  context?: string;
  value: string | null;
  onSelect: (item: SpecItem | null) => void;
  disabled?: boolean;
}

export function ItemPicker({ label, context, value, onSelect, disabled }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchItems(library.items, query), [query]);
  const shown = results.slice(0, MAX_SHOWN);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (item: SpecItem) => {
    onSelect(item);
    close();
  };

  const moveActive = (to: number) => {
    const next = Math.max(0, Math.min(shown.length - 1, to));
    setActive(next);
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="field item-picker">
      <FieldLabel htmlFor={id} label={label} />
      <div className="picker-control">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-label={contextName(label, context)}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && shown.length ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          title={value ?? undefined}
          disabled={disabled}
          placeholder={value ? undefined : 'Type to search the library'}
          value={open ? query : (value ?? '')}
          onFocus={(e) => {
            setOpen(true);
            setQuery('');
            setActive(0);
            e.currentTarget.select();
          }}
          onBlur={close}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) setOpen(true);
              else moveActive(active + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              moveActive(active - 1);
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              const item = shown[active];
              if (item) choose(item);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="icon-button clear-item"
            aria-label={`Clear item ${value}`}
            onClick={() => onSelect(null)}
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="picker-popup">
        <ul className="picker-list" id={listId} role="listbox" aria-label={`Library items for ${context ?? label}`} ref={listRef}>
          {shown.map((item, i) => (
            <li
              key={item.name}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''} ${item.kg === null ? 'tbc' : ''}`}
              // Keep focus in the input so blur does not close the list before the click lands.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
            >
              <span className="opt-name">{item.name}</span>
              <span className="opt-meta">{itemMeta(item)}</span>
            </li>
          ))}
        </ul>
          {results.length === 0 ? <p className="picker-note">No library item matches “{query}”</p> : null}
          {results.length > MAX_SHOWN ? (
            <p className="picker-note">
              Showing {MAX_SHOWN} of {results.length} – type more to narrow
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
