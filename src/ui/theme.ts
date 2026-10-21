// Colour theme: Auto follows the device, Day and Night override it. The choice is a
// per-device preference kept in this browser's localStorage; it never affects printing.

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_ORDER: readonly ThemeChoice[] = ['auto', 'light', 'dark'];
export const THEME_LABELS: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Day', dark: 'Night' };

const KEY = 'rigpoint-load-sheet:theme';

export function nextTheme(t: ThemeChoice): ThemeChoice {
  return THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length] as ThemeChoice;
}

/** The saved choice, or Auto when there is none or storage is unavailable (e.g. private windows). */
export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveTheme(t: ThemeChoice): void {
  try {
    if (t === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // Not remembered in this browser; the choice still applies until the page is closed.
  }
}

export function applyTheme(t: ThemeChoice): void {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
}
