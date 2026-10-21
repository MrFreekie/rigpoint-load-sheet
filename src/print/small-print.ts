// The Load Sheet small print. FIXED TEXT: reproduce exactly.
// Do not reword, shorten or "improve" it without the owner's agreement. DISCLAIMER.md and
// README.md carry SCOPE, DATA and LOADS verbatim; a test checks they stay identical.
//
// Agreed change from the workbook: DATA says "in this app" instead of "in this workbook".

export interface SmallPrintParagraph {
  heading: string;
  text: string;
  /** Red and bold on the print; the others are grey. */
  warning: boolean;
}

export const SMALL_PRINT: readonly SmallPrintParagraph[] = [
  {
    heading: 'SCOPE',
    warning: false,
    text: 'Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed.',
  },
  {
    heading: 'ARRAY FRAMES',
    warning: false,
    text: "Frame and bumper SWL is checked as a simple vertical load. Array mechanical limits (box count, tilt, pick-up point) must be verified in the manufacturer's software (e.g. Soundvision).",
  },
  {
    heading: 'TOP RIGGING',
    warning: true,
    text: 'Unless stated as included above, components above the hoist – beam clamps, steels, slings to structure and the structure itself – are NOT listed and NOT checked. The head rigger must verify the complete load path above the hoist.',
  },
  {
    heading: 'MULTI-POINT',
    warning: true,
    text: 'Where an array is flown from 2 or 3 points, DO NOT assume each point carries a proportional share of the load. During build, breakout, trimming and levelling – and if an adjacent point fails – a single point may carry up to 100% of the total array weight. Each point must be rated for the full array load unless a competent person has assessed otherwise.',
  },
  {
    heading: 'DATA',
    warning: false,
    text: 'Weights and SWL/WLL figures are taken from the Spec library in this app and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked.',
  },
  {
    heading: 'LOADS',
    warning: false,
    text: 'Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg.',
  },
];

export const AS_IS = 'This software is provided as-is, without warranty. It is a calculation aid and does not replace assessment by a competent person.';
