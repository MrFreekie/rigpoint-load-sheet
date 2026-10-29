// Display formatting. Rounding happens here, never in the engine.

import type { Light, Per } from '../engine/types';

const kg2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const raw = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 });

/** Weight: 2 decimal places with grouping, e.g. "1,234.56 kg". */
export function formatKg(kg: number): string {
  return `${kg2.format(kg)} kg`;
}

/** SWL / WLL: no decimals, e.g. "1,000 kg". */
export function formatSwl(kg: number): string {
  return `${kg0.format(kg)} kg`;
}

/** Utilisation: 1 decimal place, e.g. "46.7%". */
export function formatPct(fraction: number): string {
  return pct1.format(fraction);
}

/** A stored library value exactly as recorded (no display rounding), e.g. "0.6955 kg/m". */
export function formatSpecKg(kg: number, per: Per): string {
  return `${raw.format(kg)} ${per === 'm' ? 'kg/m' : 'kg'}`;
}

/** ISO date (yyyy-mm-dd) to dd/mm/yyyy. Parsed as text so time zones cannot shift it. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const LIGHT_WORDS: Record<Light, string> = { ok: 'OK', check: 'CHECK', over: 'OVER' };

/** Contingency fraction as a percentage number for editing, without float noise (0.07 → 7). */
export function contingencyToPercent(fraction: number): number {
  return Number((fraction * 100).toFixed(6));
}

/**
 * File name: "<Job> - <Hang>.loadsheet.json" with characters illegal in file names removed.
 * A revision, when there is one, is added ("… - Rev B.loadsheet.json") so each revision
 * is saved under its own name and the earlier file stays untouched.
 */
export function showFileName(job: string, hang: string, revision = ''): string {
  const clean = (s: string) =>
    s
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\p{Cc}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '');
  const parts = [clean(job), clean(hang)].filter(Boolean);
  const rev = clean(revision);
  return `${parts.length ? parts.join(' - ') : 'Untitled'}${rev ? ` - Rev ${rev}` : ''}.loadsheet.json`;
}
