// Day / night mode. Night is the default (Tokyo Night, the :root tokens); day sets data-theme="light"
// on <html>, which swaps the colour tokens to Catppuccin Latte (see src/styles.css).
// An inline script in index.html applies a saved choice before first paint, so there is no flash.
export type Theme = 'dark' | 'light';

const KEY = 'remlux:theme';

export const currentTheme = (): Theme => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/** Apply a theme, remember it, and tell the script to redraw anything that read colours at draw time (3D view). */
export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode: the choice just lasts for this visit */ }
  window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

/** Wire the toggle button: keeps its label in step with the current theme. */
export function initThemeToggle(btn: HTMLElement): void {
  const sync = () => {
    const label = currentTheme() === 'light' ? 'Switch to night mode' : 'Switch to day mode';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  btn.addEventListener('click', e => {
    e.stopPropagation(); // the legacy chip handler on document has nothing to do here
    setTheme(currentTheme() === 'light' ? 'dark' : 'light');
    sync();
  });
  sync();
}
