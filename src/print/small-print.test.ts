// The small print is fixed text. These tests fail if it drifts from the brief or the docs.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AS_IS, SMALL_PRINT } from './small-print';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('small print', () => {
  it('has the six paragraphs in order, with TOP RIGGING and MULTI-POINT as warnings', () => {
    expect(SMALL_PRINT.map((p) => p.heading)).toEqual(['SCOPE', 'ARRAY FRAMES', 'TOP RIGGING', 'MULTI-POINT', 'DATA', 'LOADS']);
    expect(SMALL_PRINT.filter((p) => p.warning).map((p) => p.heading)).toEqual(['TOP RIGGING', 'MULTI-POINT']);
  });

  it('matches BRIEF.md word for word, with the agreed "in this app" change to DATA', () => {
    const brief = read('BRIEF.md');
    for (const p of SMALL_PRINT) {
      const original = p.heading === 'DATA' ? p.text.replace('in this app', 'in this workbook') : p.text;
      expect(brief, p.heading).toContain(`**${p.heading}** — ${original}`);
    }
  });

  it.each(['DISCLAIMER.md', 'README.md'])('%s carries SCOPE, DATA and LOADS verbatim, and the as-is statement', (file) => {
    const text = read(file);
    for (const p of SMALL_PRINT.filter((x) => ['SCOPE', 'DATA', 'LOADS'].includes(x.heading))) {
      expect(text, p.heading).toContain(`**${p.heading}** — ${p.text}`);
    }
    expect(text).toContain(AS_IS);
  });
});
