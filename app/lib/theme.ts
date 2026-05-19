/**
 * Theme manager for Elitium ERP.
 * Handles light/dark mode persistence via localStorage and applies the
 * `data-theme` attribute on <html> so CSS variables take effect.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'erp-theme';

/** Read the persisted theme. Defaults to 'light' when running on the server. */
export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

/** Persist and apply a theme. */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

/** Toggle between light and dark, returning the new theme. */
export function toggleTheme(): Theme {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

/**
 * Initialise theme as early as possible.
 * Call this before React hydrates to avoid a flash of the wrong theme.
 * Safe to call multiple times.
 */
export function initTheme(): void {
  if (typeof window === 'undefined') return;
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
