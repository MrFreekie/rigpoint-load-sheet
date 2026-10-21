import { describe, expect, it } from 'vitest';
import { loadTheme, nextTheme, THEME_LABELS } from './theme';

describe('theme', () => {
  it('cycles Auto, Day, Night', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
    expect([THEME_LABELS.auto, THEME_LABELS.light, THEME_LABELS.dark]).toEqual(['Auto', 'Day', 'Night']);
  });

  it('falls back to Auto when browser storage is unavailable', () => {
    expect(loadTheme()).toBe('auto');
  });
});
