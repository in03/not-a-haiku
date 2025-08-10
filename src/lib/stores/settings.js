import { writable } from 'svelte/store';

export const defaultSettings = {
  autoBackspace: false,
  enableShake: true,
  enableConfetti: true,
  enableGentleErrorPulse: true,
  lineGuideOnFocus: true,
  softSuccessPulse: true,
  poemType: 'haiku',
  indicatorMode: 'count', // 'count' | 'minimal'
  showProgressBar: false,
  hideHeader: false,
  enableEphemeralHints: true,
  preset: 'default' // 'default' | 'focus' | 'custom'
};

export const focusPreset = {
  // Visual/behavior tweaks tailored for deep focus
  autoBackspace: true,
  enableShake: false,
  enableConfetti: false,
  enableGentleErrorPulse: true,
  lineGuideOnFocus: true,
  softSuccessPulse: true,
  indicatorMode: 'minimal',
  showProgressBar: true,
  hideHeader: true,
  enableEphemeralHints: true
};

export const presets = {
  default: defaultSettings,
  focus: { ...defaultSettings, ...focusPreset }
};

function safeGetStoredSettings() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('app-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to avoid missing keys after upgrades
        return { ...defaultSettings, ...parsed };
      }
    }
  } catch (err) {
    // Ignore storage errors
  }
  return { ...defaultSettings };
}

/**
 * @param {typeof defaultSettings} value
 */
function persistSettings(value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('app-settings', JSON.stringify(value));
    }
  } catch (err) {
    // Ignore storage errors
  }
}

function createSettingsStore() {
  const initial = safeGetStoredSettings();
  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    /** @param {typeof defaultSettings} value */
    set: (value) => {
      persistSettings(value);
      set(value);
    },
    /** @param {(v: typeof defaultSettings) => typeof defaultSettings} updater */
    update: (updater) => update((current) => {
      const next = updater(current);
      persistSettings(next);
      return next;
    }),
    reset: () => {
      const next = { ...defaultSettings };
      persistSettings(next);
      set(next);
    },
    defaultSettings,
    /** @param {'default'|'focus'} name */
    applyPreset: (name) => {
      const base = presets[/** @type {'default'|'focus'} */(name)] || defaultSettings;
      update((current) => {
        const next = {
          ...current,
          ...base,
          poemType: current.poemType,
          preset: name
        };
        persistSettings(next);
        return next;
      });
    }
  };
}

export const settingsStore = createSettingsStore();


