import { writable } from 'svelte/store';

export const defaultSettings = {
  autoBackspace: false,
  enableShake: true,
  enableConfetti: true,
  poemType: 'haiku',
  showProgressBar: false,
  preset: 'default', // 'default' | 'focus' | 'custom'
  elevenlabsApiKey: '', // ElevenLabs API key for text-to-speech
  ttsPauseDuration: 1.0 // Pause duration between lines in seconds (default 1 second)
};

export const focusPreset = {
  // Visual/behavior tweaks tailored for deep focus
  autoBackspace: true,
  enableShake: false,
  enableConfetti: false,
  showProgressBar: true,
  // focus preset no longer hides editor chrome; progress bar remains
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
        // Only keep known keys to avoid carrying removed settings forward
        const filtered = Object.fromEntries(
          Object.keys(defaultSettings).map((key) => [
            key,
            Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : defaultSettings[/** @type {keyof typeof defaultSettings} */(key)]
          ])
        );
        return /** @type {typeof defaultSettings} */ (filtered);
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


