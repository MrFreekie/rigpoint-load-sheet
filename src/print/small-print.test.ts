// The small print is fixed text. These tests fail if it drifts from the agreed wording or the docs.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AS_IS, SMALL_PRINT } from './small-print';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/**
 * The agreed small print, copied from the original build brief. The only agreed change is
 * "in this workbook" to "in this app" in DATA. Change this only with the owner's agreement.
 */
const AGREED: [string, string][] = [
  ["SCOPE", "Analyses the load paths of ONE hang. Each rated component is checked against the load it carries. Top rigging carries everything; the hoist carries the hook load (body up) or its own zone plus the hook load (body down); the hook/junction carries both paths; each path component carries the items listed below it. This is a load list, not a rigging design: bridle geometry, sling angles, load transfer between points and the venue structure are not assessed."],
  ["ARRAY FRAMES", "Frame and bumper SWL is checked as a simple vertical load. Array mechanical limits (box count, tilt, pick-up point) must be verified in the manufacturer's software (e.g. Soundvision)."],
  ["TOP RIGGING", "Unless stated as included above, components above the hoist – beam clamps, steels, slings to structure and the structure itself – are NOT listed and NOT checked. The head rigger must verify the complete load path above the hoist."],
  ["MULTI-POINT", "Where an array is flown from 2 or 3 points, DO NOT assume each point carries a proportional share of the load. During build, breakout, trimming and levelling – and if an adjacent point fails – a single point may carry up to 100% of the total array weight. Each point must be rated for the full array load unless a competent person has assessed otherwise."],
  ["DATA", "Weights and SWL/WLL figures are taken from the Spec library in this app and are indicative only. Verify against current manufacturer data and the certification of the actual equipment before use. TBC items have no recorded weight and are excluded from totals. Where several rated items share a zone or quantity is greater than 1, each is checked against the full load below it. Unrated items are not checked."],
  ["LOADS", "Static weights only. No dynamic, shock or snatch allowance is included; snatch loading, slack-chain pick-up and hoist stall must be prevented by procedure. The contingency covers unlisted items and measurement error only. 1t = 1,000 kg."],
];

describe('small print', () => {
  it('has the six paragraphs in order, with TOP RIGGING and MULTI-POINT as warnings', () => {
    expect(SMALL_PRINT.map((p) => p.heading)).toEqual(['SCOPE', 'ARRAY FRAMES', 'TOP RIGGING', 'MULTI-POINT', 'DATA', 'LOADS']);
    expect(SMALL_PRINT.filter((p) => p.warning).map((p) => p.heading)).toEqual(['TOP RIGGING', 'MULTI-POINT']);
  });

  it('matches the agreed wording word for word, with the agreed "in this app" change to DATA', () => {
    expect(SMALL_PRINT.map((p) => [p.heading, p.text])).toEqual(AGREED);
  });

  it.each(['DISCLAIMER.md', 'README.md'])('%s carries SCOPE, DATA and LOADS verbatim, and the as-is statement', (file) => {
    const text = read(file);
    for (const p of SMALL_PRINT.filter((x) => ['SCOPE', 'DATA', 'LOADS'].includes(x.heading))) {
      expect(text, p.heading).toContain(`**${p.heading}** — ${p.text}`);
    }
    expect(text).toContain(AS_IS);
  });
});
