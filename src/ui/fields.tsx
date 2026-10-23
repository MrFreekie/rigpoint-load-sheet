// Labelled form fields. Every input has a visible label (WCAG 2.1 AA).

import { useId, useState, type ReactNode } from 'react';

interface FieldShell {
  label: string;
  hint?: ReactNode | undefined;
  className?: string | undefined;
  /** Extra words for screen readers only, e.g. "Hoist row 2", so repeated labels stay unique. */
  context?: string | undefined;
}

export function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) {
  return <label htmlFor={htmlFor}>{label}</label>;
}

/** Accessible name with screen-reader context, e.g. "Qty, Hoist row 2"; undefined uses the visible label. */
export function contextName(label: string, context: string | undefined): string | undefined {
  return context ? `${label}, ${context}` : undefined;
}

function Shell({ id, label, hint, className, error, children }: FieldShell & { id: string; error?: string | null; children: ReactNode }) {
  return (
    <div className={`field ${className ?? ''}`}>
      <FieldLabel htmlFor={id} label={label} />
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  context,
  value,
  onChange,
  hint,
  className,
  placeholder,
  disabled,
}: FieldShell & { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <Shell id={id} label={label} context={context} hint={hint} className={className}>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={contextName(label, context)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Shell>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
  className,
}: FieldShell & { value: string | null; onChange: (v: string | null) => void }) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} className={className}>
      <input
        id={id}
        type="date"
        value={value ?? ''}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </Shell>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  className,
}: FieldShell & { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} className={className}>
      <select
        id={id}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

interface NumberFieldProps extends FieldShell {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Empty is an error rather than null. */
  required?: boolean;
  unit?: string;
  disabled?: boolean;
  placeholder?: string;
}

function parseNumber(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return undefined;
  return Number(t);
}

/**
 * A number typed as text, so partial entries like "2." are not lost while typing.
 * Empty means null. Invalid entries are shown as errors and not passed on.
 */
export function NumberField({ label, context, value, onChange, min = 0, max, integer, required, unit, hint, className, disabled, placeholder }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [seen, setSeen] = useState(value);
  // Follow changes made elsewhere (e.g. loading a show) without clobbering what is being typed.
  if (value !== seen) {
    setSeen(value);
    if (parseNumber(draft) !== value) setDraft(value === null ? '' : String(value));
  }

  const parsed = parseNumber(draft);
  let error: string | null = null;
  if (parsed === undefined) error = 'Enter a number';
  else if (parsed === null && required) error = 'Enter a value';
  else if (parsed !== null && integer && !Number.isInteger(parsed)) error = 'Enter a whole number';
  else if (parsed !== null && parsed < min) error = `Must be ${min} or more`;
  else if (parsed !== null && max !== undefined && parsed > max) error = `Must be ${max.toLocaleString('en-GB')} or less`;

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <Shell id={id} label={label} context={context} hint={hint} className={className} error={error}>
      <div className="number-input">
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={contextName(label, context)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const n = parseNumber(text);
            if (n === undefined || (n === null && required)) return;
            if (n !== null && (n < min || (max !== undefined && n > max) || (integer && !Number.isInteger(n)))) return;
            setSeen(n);
            onChange(n);
          }}
        />
        {unit ? <span className="unit" aria-hidden="true">{unit}</span> : null}
      </div>
    </Shell>
  );
}

/** Yes / No / not stated as a segmented control of radio buttons. */
export function ChoiceField<T extends string | boolean | null>({
  legend,
  value,
  options,
  onChange,
  hint,
  className,
}: {
  legend: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={`field choice ${className ?? ''}`}>
      <legend>{legend}</legend>
      <div className="segments">
        {options.map((o) => (
          <label key={String(o.value)} className={value === o.value ? 'selected' : ''}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </fieldset>
  );
}
