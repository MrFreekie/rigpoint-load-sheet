import { describe, expect, it } from 'vitest';
import { printFooter } from './footer';

const base = {
  appVersion: '0.3.0',
  showSpec: '2026-10-21',
  librarySpec: '2026-10-21',
  fileName: 'The Ballroom - Main Hang Left.loadsheet.json',
  defaultName: 'The Ballroom - Main Hang Left.loadsheet.json',
  dirty: false,
  printedAt: new Date(2026, 9, 21, 16, 2),
};

describe('print footer', () => {
  it('matches the brief for a saved show', () => {
    expect(printFooter(base)).toBe(
      'RigPoint Load Sheet app 0.3.0 · Spec 2026-10-21 · The Ballroom - Main Hang Left.loadsheet.json · Printed 21/10/2026 16:02',
    );
  });

  it('says when the printout does not match a saved file', () => {
    expect(printFooter({ ...base, dirty: true })).toContain('Main Hang Left.loadsheet.json (unsaved changes) ·');
    expect(printFooter({ ...base, fileName: null })).toContain('Main Hang Left.loadsheet.json (not saved) ·');
  });

  it('shows both spec versions when the show was made from an older library', () => {
    expect(printFooter({ ...base, showSpec: '2026-09-01' })).toContain('Spec 2026-09-01 (app library 2026-10-21)');
  });
});
