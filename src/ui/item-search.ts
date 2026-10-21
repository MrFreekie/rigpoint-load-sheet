// Type-to-search over the Spec library for the item picker.

import type { SpecItem } from '../schema/spec-library';

/** Lower case, with compatibility characters folded (e.g. "mm²" matches "mm2"). */
export function normalise(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Items whose name contains every word of the query, in any order.
 * Names that start with the query come first, then names where the first word
 * starts a word, then the rest; within each group, library order is kept.
 */
export function searchItems(items: readonly SpecItem[], query: string): SpecItem[] {
  const q = normalise(query).trim();
  if (!q) return [...items];
  const words = q.split(/\s+/);
  const first = words[0] ?? '';
  const scored: { item: SpecItem; rank: number; order: number }[] = [];
  items.forEach((item, order) => {
    const name = normalise(item.name);
    if (!words.every((w) => name.includes(w))) return;
    let rank = 2;
    if (name.startsWith(q)) rank = 0;
    else if (new RegExp(`(^|[^a-z0-9])${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) rank = 1;
    scored.push({ item, rank, order });
  });
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return scored.map((s) => s.item);
}
