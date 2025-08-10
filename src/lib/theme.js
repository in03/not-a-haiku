import { writable } from 'svelte/store';

// Persisted theme mode: 'auto' | 'on' | 'off'
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme-mode') : null;
export const themeMode = writable(stored || 'auto');

/** @type {MediaQueryList | undefined} */
let mediaQuery;

function prefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (!mediaQuery) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  return !!mediaQuery.matches;
}

/**
 * @param {boolean} isDark
 */
function setDaisyTheme(isDark) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  // Use native daisyUI themes
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  // Ensure legacy dark class does NOT interfere with daisyUI
  root.classList.remove('dark');
}

/**
 * @param {'auto'|'on'|'off'} mode
 */
export function applyTheme(mode) {
  const isDark = mode === 'on' || (mode === 'auto' && prefersDark());
  setDaisyTheme(isDark);
}

export function initTheme() {
  if (typeof window === 'undefined') return;
  /** @type {'auto'|'on'|'off'} */
  const currentMode = (stored === 'on' || stored === 'off' || stored === 'auto') ? stored : 'auto';
  applyTheme(currentMode);

  // React to system changes when in auto
  if (!mediaQuery && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }
  const handleChange = () => {
    let modeNow = null;
    themeMode.update((m) => {
      modeNow = m;
      return m;
    });
    if (modeNow === 'auto') applyTheme('auto');
  };
  mediaQuery && mediaQuery.addEventListener && mediaQuery.addEventListener('change', handleChange);
}

/**
 * @param {'auto'|'on'|'off'} mode
 */
export function setThemeMode(mode) {
  themeMode.set(mode);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('theme-mode', mode); } catch {}
  applyTheme(mode);
}

