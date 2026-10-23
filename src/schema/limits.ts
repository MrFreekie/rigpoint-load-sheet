// Upper limits on numbers in a show. Far above any real rig, but low enough that
// every product and sum the engine forms stays a finite number, so a typing slip
// or a damaged file cannot turn a total into Infinity or NaN.

/** Pieces in one row. */
export const MAX_QTY = 9_999;
/** Length of a per-metre item in one row, in metres. */
export const MAX_LENGTH_M = 1_000;
/** Weight of one item (or one metre), in kg. */
export const MAX_ITEM_KG = 100_000;
/** SWL of one item, in kg. */
export const MAX_SWL_KG = 1_000_000;
/** Stated capacity of a connection point, in kg. */
export const MAX_POINT_KG = 1_000_000;
