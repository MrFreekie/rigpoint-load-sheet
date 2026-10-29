import { describe, expect, it } from 'vitest';
import { reloadWarning } from './reload-warning';

describe('reload warning', () => {
  it('promises autosave only while it is actually keeping the changes', () => {
    const active = reloadWarning(true);
    expect(active).toMatch(/kept by autosave/);
    expect(active).toMatch(/should be offered back/);
    expect(active).toMatch(/apart from the last few seconds/);

    // Failed or unavailable: no promise.
    const inactive = reloadWarning(false);
    expect(inactive).toMatch(/not keeping the changes/);
    expect(inactive).toMatch(/will be lost/);
    expect(inactive).not.toMatch(/kept by autosave/);
  });
});
