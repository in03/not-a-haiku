<script>
  import { createEventDispatcher } from 'svelte';
  import { poemTypes } from '../poemTypes.js';
  
  const dispatch = createEventDispatcher();
  
  export let isOpen = false;
  export let isModal = true; // New prop to control modal vs inline behavior
  // @ts-ignore - allow shape extension from store
  export let settings = {
    autoBackspace: false,
    enableShake: true,
    enableConfetti: true,
    poemType: 'haiku',
    showProgressBar: false,
    preset: 'default'
  };
  // Removed optional focus-only fields (no longer configurable)

  import { presets, settingsStore } from '$lib/stores/settings.js';

  // Handle preset changes by using the store's applyPreset method
  let lastPreset = settings.preset;
  $: if (settings.preset !== lastPreset && (settings.preset === 'default' || settings.preset === 'focus')) {
    settingsStore.applyPreset(settings.preset);
    lastPreset = settings.preset;
  }
  
  let poemTypeExpanded = false;
  
  function handleClose() {
    isOpen = false;
    dispatch('close');
  }
  
  function togglePoemTypeSelector() {
    poemTypeExpanded = !poemTypeExpanded;
  }
  
  /** @param {string} key */
  function selectPoemType(key) {
    settings.poemType = key;
    settings.preset = 'custom';
    poemTypeExpanded = false;
  }
  
  function handleSave() {
    dispatch('save', settings);
    handleClose();
  }
  
  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
  
  $: if (isOpen && typeof window !== 'undefined') {
    document.addEventListener('keydown', handleKeydown);
  } else if (typeof window !== 'undefined') {
    document.removeEventListener('keydown', handleKeydown);
  }
</script>

{#if isModal}
  {#if isOpen}
    <div class="settings-overlay" role="button" tabindex="0" on:click={handleClose} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClose()}>
      <div class="settings-modal" role="dialog" aria-modal="true" tabindex="0" on:keydown={(e) => e.key === 'Escape' && handleClose()} on:click|stopPropagation>
        <div class="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button class="close-button" on:click={handleClose} aria-label="Close settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="settings-content">
          <!-- Modal content here -->
        </div>
        
        <div class="settings-footer">
          <button class="cancel-button" on:click={handleClose}>Cancel</button>
          <button class="save-button" on:click={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <!-- Inline panel version (content only) -->
  <div class="settings-content-wrapper">
    <div class="settings-content">
      <!-- Presets -->
      <div class="setting-group">
        <h3 id="preset-group-label" class="setting-label">Preset</h3>
        <div class="radio-group" role="radiogroup" aria-labelledby="preset-group-label">
          <label class="radio-option">
            <input type="radio" class="radio-input" bind:group={settings.preset} value="default" />
            <span class="radio-custom"></span>
            <span class="radio-text">Default</span>
          </label>
          <label class="radio-option">
            <input type="radio" class="radio-input" bind:group={settings.preset} value="focus" />
            <span class="radio-custom"></span>
            <span class="radio-text">Focus</span>
          </label>
          <label class="radio-option">
            <input type="radio" class="radio-input" bind:group={settings.preset} value="custom" />
            <span class="radio-custom"></span>
            <span class="radio-text">Custom</span>
          </label>
        </div>
        <div class="setting-description">Choose a preset; changing individual settings switches to Custom.</div>
      </div>
      <!-- Poem Type Selection -->
      <div class="setting-group">
        <h3 class="setting-label" id="poem-type-label">Poem Type</h3>
        
        <!-- Dropdown-style trigger -->
          <button id="poem-type-trigger" aria-labelledby="poem-type-label" class="poem-type-trigger" type="button" on:click={togglePoemTypeSelector} aria-expanded={poemTypeExpanded} aria-controls="poem-type-grid">
            <div class="poem-type-current">
              <div class="poem-type-name">{poemTypes[/** @type {keyof typeof poemTypes} */ (settings.poemType)].name}</div>
              <div class="poem-type-syllables">{poemTypes[/** @type {keyof typeof poemTypes} */ (settings.poemType)].syllables.join('-')} syllables</div>
            </div>
          <svg class="dropdown-icon {poemTypeExpanded ? 'expanded' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>
        
        <!-- Expandable grid -->
        {#if poemTypeExpanded}
          <div id="poem-type-grid" class="poem-type-grid">
            {#each Object.entries(poemTypes) as [key, type]}
              <button 
                class="poem-type-option {settings.poemType === key ? 'selected' : ''}"
                on:click={() => selectPoemType(key)}
              >
                <div class="poem-type-name">{type.name}</div>
                <div class="poem-type-description">{type.description}</div>
                <div class="poem-type-syllables">
                  {type.syllables.join('-')} syllables
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Behavior Settings -->
      <div class="setting-group">
        <h3 class="setting-label">Behavior</h3>
        
        <div class="setting-item">
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" bind:checked={settings.autoBackspace} on:change={() => settings.preset = 'custom'} />
            <span class="toggle-slider"></span>
            <span class="toggle-text">
              <span class="toggle-title">Auto-backspace last word on over-limit</span>
              <div class="setting-description">Automatically removes the last word when syllable limit is exceeded</div>
            </span>
          </label>
        </div>
        
        <div class="setting-item">
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" bind:checked={settings.enableShake} on:change={() => settings.preset = 'custom'} />
            <span class="toggle-slider"></span>
            <span class="toggle-text">
              <span class="toggle-title">Enable shake animation</span>
              <div class="setting-description">Shake the editor when limits are reached</div>
            </span>
          </label>
        </div>
        
        <div class="setting-item">
          <label class="toggle-label">
            <input 
              type="checkbox" 
              bind:checked={settings.enableConfetti}
              class="toggle-input"
              on:change={() => settings.preset = 'custom'}
            />
            <span class="toggle-slider"></span>
            <span class="toggle-text">
              <span class="toggle-title">Enable confetti celebration</span>
              <div class="setting-description">
                Show confetti when you submit a completed poem
              </div>
            </span>
          </label>
        </div>
        
        <!-- Explicit controls that focus preset toggles -->
        <div class="setting-item">
          <label class="toggle-label">
            <input 
              type="checkbox" 
              bind:checked={settings.showProgressBar}
              class="toggle-input"
              on:change={() => settings.preset = 'custom'}
            />
            <span class="toggle-slider"></span>
            <span class="toggle-text">
              <span class="toggle-title">Show progress bar</span>
              <div class="setting-description">Displays a thin progress bar that fills as syllables match.</div>
            </span>
          </label>
        </div>
        
        

  <!-- Removed non-functional toggles: gentle error pulse, line guide on focus, soft success pulse, hide header, indicator mode, ephemeral hints -->
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    backdrop-filter: blur(6px);
    padding: 20px;
    box-sizing: border-box;
  }
  
  .settings-modal {
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px var(--card-shadow);
    max-width: 500px;
    width: 100%;
    max-height: calc(100vh - 40px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .settings-content-wrapper {
    border-radius: inherit;
    overflow: hidden;
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    color: var(--text-secondary);
    transition: all 0.2s;
  }
  
  .close-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .settings-content-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    box-sizing: border-box;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .settings-content {
    max-width: none;
    width: 100%;
    padding-bottom: 16px;
  }
  
  .setting-group {
    margin-bottom: 32px;
  }
  
  .setting-group:last-child {
    margin-bottom: 0;
  }
  
  .setting-label {
    display: block;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }
  
  .poem-type-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 12px;
  }
  
  .poem-type-trigger:hover {
    border-color: var(--border-focus);
  }
  
  .poem-type-trigger:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-focus) 20%, transparent);
  }
  
  .poem-type-current {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  
  .dropdown-icon {
    transition: transform 0.2s;
    color: var(--text-secondary);
  }
  
  .dropdown-icon.expanded {
    transform: rotate(180deg);
  }
  
  .poem-type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    animation: expandIn 0.2s ease-out;
    margin-top: 12px;
  }
  
  @media (max-width: 768px) {
    .poem-type-grid {
      grid-template-columns: 1fr;
    }
  }
  
  @keyframes expandIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .poem-type-option {
    position: relative;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-primary);
    transition: all 0.2s;
    cursor: pointer;
    text-align: left;
  }
  
  .poem-type-option:hover {
    border-color: var(--border-focus);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--card-shadow);
  }
  
  .poem-type-option.selected {
    border-color: var(--border-focus);
    background: color-mix(in srgb, var(--bg-secondary) 80%, transparent);
  }
  
  .poem-type-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  
  .poem-type-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }
  
  .poem-type-syllables {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--border-focus);
    font-family: 'Courier New', monospace;
  }
  
  .setting-item {
    margin-bottom: 20px;
  }
  
  .setting-item:last-child {
    margin-bottom: 0;
  }
  
  .toggle-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    min-height: 48px;
    width: 100%;
  }
  
  .toggle-input {
    display: none;
  }
  
  .toggle-slider {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    transition: background-color 0.2s;
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--bg-primary);
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .toggle-input:checked + .toggle-slider {
    background: var(--border-focus);
  }
  
  .toggle-input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }
  
  .toggle-text {
    flex: 1;
    color: var(--text-primary);
    min-width: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  
  .toggle-title {
    font-weight: 500;
    display: block;
    line-height: 1.4;
  }
  
  .setting-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 400;
    margin-top: 4px;
    line-height: 1.4;
  }
  
  /* Radio group styles */
  /* unused: .setting-label-inline */
  
  .radio-group {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
  }
  
  .radio-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .radio-input {
    display: none;
  }
  
  .radio-custom {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-radius: 50%;
    position: relative;
    transition: all 0.2s;
  }
  
  .radio-custom::before {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-focus);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0.2s;
  }
  
  .radio-input:checked + .radio-custom {
    border-color: var(--border-focus);
  }
  
  .radio-input:checked + .radio-custom::before {
    transform: translate(-50%, -50%) scale(1);
  }
  
  .radio-text {
    font-size: 0.875rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  /* Improve spacing for dense items */
  .setting-item .toggle-text { padding-top: 2px; }
  .setting-item .toggle-title { margin-bottom: 2px; }
  
  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 24px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
  
  .cancel-button, .save-button {
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .cancel-button {
    background: var(--bg-primary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  
  .cancel-button:hover {
    background: var(--bg-secondary);
  }
  
  .save-button {
    background: linear-gradient(135deg, #10b981, #3b82f6);
    color: #ffffff;
  }
  
  .save-button:hover {
    filter: brightness(0.95);
  }
  
  /* Inline panel styles */
  /* unused: .settings-panel-content ... */
  
  /* unused */
  
  /* unused */
  
  /* unused */
  
  /* unused */
  
  /* unused: .hidden */
</style>