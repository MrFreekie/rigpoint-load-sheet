// Fixed text produced by the engine. Wording follows the workbook and BRIEF.md sections 6 and 9.5.

import type { PointStatus, WarningCode } from './types';

export const DATA_CHECK_OK = 'OK – all line data resolved';
export const DATA_CHECK_MISSING =
  '⚠ MISSING DATA – total understated. Resolve TBC / NOT FOUND / LEN? flags.';

export const POINT_MESSAGES: Record<PointStatus, string> = {
  for_approval: 'No stated capacity – design load to be submitted for approval.',
  no_source: '⚠ CAPACITY STATED WITH NO SOURCE – attribute the figure before relying on it.',
  exceeded: '⚠ DESIGN LOAD EXCEEDS STATED POINT CAPACITY',
  recorded: 'Stated capacity recorded. To be confirmed by the venue / structural engineer.',
};

/** Overall governing component when no row in any zone is rated. */
export const NO_RATED_ITEMS = '– no rated items listed –';
/** Per-zone governing component when the zone has no rated row (workbook capacity summary). */
export const NO_RATED_ITEM_IN_ZONE = '– no rated item listed –';

export function tieSuffix(ties: number): string {
  return ties > 0 ? ` (+${ties} other at the same utilisation)` : '';
}

export const WARNING_MESSAGES: Record<WarningCode, string> = {
  contingency_zero:
    'Contingency is set to 0% – no allowance for unlisted items or measurement error. Make sure this is deliberate.',
  top_rigging_included_but_empty:
    'Top rigging included? is Yes but the top rigging zone is empty',
  top_rigging_excluded_but_listed:
    'Top rigging included? is No but top rigging items are listed',
};
