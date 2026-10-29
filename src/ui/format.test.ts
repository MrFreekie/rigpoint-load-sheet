import { describe, expect, it } from 'vitest';
import { library } from '../library';
import { contingencyToPercent, formatDate, formatDateTime, formatKg, formatPct, formatSpecKg, formatSwl, showFileName } from './format';
import { normalise, searchItems } from './item-search';

describe('formatting', () => {
  it('date and time are both local, so 00:30 on the 29th is not shown as the 28th', () => {
    expect(formatDateTime(new Date(2026, 9, 29, 0, 30).getTime())).toBe('29/10/2026 00:30');
    expect(formatDateTime(new Date(2026, 0, 5, 23, 59).getTime())).toBe('05/01/2026 23:59');
  });

  it('weights: 2 dp, en-GB grouping, kg', () => {
    expect(formatKg(1234.555)).toBe('1,234.56 kg');
    expect(formatKg(444.662)).toBe('444.66 kg');
    expect(formatKg(0)).toBe('0.00 kg');
  });

  it('SWL: 0 dp', () => {
    expect(formatSwl(1000)).toBe('1,000 kg');
    expect(formatSwl(3250)).toBe('3,250 kg');
  });

  it('utilisation: 1 dp', () => {
    expect(formatPct(0.46689)).toBe('46.7%');
    expect(formatPct(1.0172)).toBe('101.7%');
    expect(formatPct(0)).toBe('0.0%');
  });

  it('library values unrounded', () => {
    expect(formatSpecKg(0.6955, 'm')).toBe('0.6955 kg/m');
    expect(formatSpecKg(1500, 'each')).toBe('1,500 kg');
  });

  it('dates: dd/mm/yyyy', () => {
    expect(formatDate('2026-10-21')).toBe('21/10/2026');
    expect(formatDate(null)).toBe('');
  });

  it('contingency percent without float noise', () => {
    expect(contingencyToPercent(0.07)).toBe(7);
    expect(contingencyToPercent(0.05)).toBe(5);
    expect(contingencyToPercent(0.125)).toBe(12.5);
  });

  it('file names', () => {
    expect(showFileName('The Ballroom', 'Main Hang Left')).toBe('The Ballroom - Main Hang Left.loadsheet.json');
    expect(showFileName('A/B: "C"?', ' ')).toBe('AB C.loadsheet.json');
    expect(showFileName('', '')).toBe('Untitled.loadsheet.json');
    expect(showFileName('The Ballroom', 'Main Hang Left', 'B')).toBe('The Ballroom - Main Hang Left - Rev B.loadsheet.json');
    expect(showFileName('The Ballroom', 'Main Hang Left', ' ')).toBe('The Ballroom - Main Hang Left.loadsheet.json');
  });
});

describe('item search', () => {
  const names = (q: string) => searchItems(library.items, q).map((i) => i.name);

  it('empty query returns the whole library in order', () => {
    expect(names('')).toHaveLength(library.items.length);
  });

  it('matches every word in any order, ignoring case', () => {
    const r = names('bump m-');
    expect(r).toContain('L-Acoustics M-BUMP');
    expect(r.every((n) => /bump/i.test(n) && /m-/i.test(n))).toBe(true);
  });

  it('folds superscripts so "mm2" finds "mm²"', () => {
    expect(normalise('2.5mm²')).toBe('2.5mm2');
    expect(names('4x 2.5mm2')).toContain('H07RN-F 4x 2.5mm²');
  });

  it('treats × as x, so "4x12" finds "4×12"', () => {
    expect(normalise('4×12')).toBe('4x12');
    expect(names('chainmaster 4x12')).toEqual(['Chainmaster 4×12 mm – DIN EN 818-7']);
    expect(names('chainmaster 1000kg')).toEqual(['Chainmaster 1000kg – D8Plus Ultra-LV']);
  });

  it('ranks names starting with the query first', () => {
    expect(names('lodestar')[0]).toMatch(/^Lodestar/);
  });

  it('returns nothing for nonsense', () => {
    expect(names('zzzz-not-an-item')).toEqual([]);
  });
});
