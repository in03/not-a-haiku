<script>
  import { createEventDispatcher } from 'svelte';
  import { poemTypes } from '../poemTypes.js';
  import { authStore } from '$lib/stores/auth.js';
  
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
    preset: 'default',
    elevenlabsApiKey: '',
    ttsPauseDuration: 1.0
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
  let showApiKey = false;
  
  // Handle GitHub sign in
  function handleGitHubSignIn() {
    // Redirect to OAuth endpoint
    window.location.href = '/api/auth/github';
  }
  
  // Handle GitHub sign out
  function handleGitHubSignOut() {
    authStore.signOut();
  }
  
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
        
      </div>
      
      <!-- AI Analysis Settings -->
      <div class="setting-group">
        <h3 class="setting-label">AI Analysis</h3>
        
        <div class="setting-item">
          <div class="github-auth-section">
            <div class="github-auth-header">
              <span class="github-auth-title">GitHub Authentication</span>
              <div class="setting-description">
                Sign in with GitHub to enable AI-powered haiku analysis using GitHub Models. 
                Each user gets their own free quota.
              </div>
            </div>
            
            {#if $authStore.isAuthenticated && $authStore.user}
              <!-- Authenticated state -->
              <div class="github-user-card">
                <div class="github-user-info">
                  <img 
                    src={$authStore.user.avatar_url} 
                    alt={$authStore.user.name || $authStore.user.login}
                    class="github-avatar"
                  />
                  <div class="github-user-details">
                    <div class="github-user-name">
                      {$authStore.user.name || $authStore.user.login}
                    </div>
                    <div class="github-user-login">@{$authStore.user.login}</div>
                  </div>
                </div>
                <button 
                  type="button"
                  class="github-signout-button"
                  on:click={handleGitHubSignOut}
                  aria-label="Sign out of GitHub"
                >
                  Sign Out
                </button>
              </div>
              
              <div class="github-status-indicator success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22,4 12,14.01 9,11.01"></polyline>
                </svg>
                <span>Connected • AI analysis enabled • Using your GitHub Models quota</span>
              </div>
            {:else}
              <!-- Unauthenticated state with rationale -->
              <div class="github-signin-rationale">
                <div class="rationale-content">
                  <h4 class="rationale-title">🤖 Enable AI Analysis</h4>
                  <p class="rationale-description">
                    Sign in with GitHub to unlock AI-powered haiku analysis! Get instant feedback with:
                  </p>
                  <ul class="rationale-features">
                    <li>⭐ Star ratings (1-5 stars)</li>
                    <li>💭 Thoughtful AI commentary</li>
                    <li>🏷️ Smart task categorization</li>
                    <li>🎯 Personal quota usage</li>
                  </ul>
                  <p class="rationale-note">
                    Uses <strong>GitHub Models</strong> - each user gets their own free quota. 
                    No API keys needed, just sign in!
                  </p>
                </div>
                
                <div class="github-signin-container">
                  <button 
                    type="button"
                    class="github-signin-button"
                    on:click={handleGitHubSignIn}
                    disabled={$authStore.isLoading}
                  >
                    {#if $authStore.isLoading}
                      <div class="github-signin-spinner"></div>
                      <span>Connecting...</span>
                    {:else}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span>Sign in with GitHub</span>
                    {/if}
                  </button>
                  
                  {#if $authStore.error}
                    <div class="github-error-message">
                      {$authStore.error}
                    </div>
                  {/if}
                </div>
              </div>
              
              <div class="github-status-indicator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Sign in required for AI analysis • Available in navbar for convenience</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Text-to-Speech Settings -->
      <div class="setting-group">
        <h3 class="setting-label">Text-to-Speech</h3>
        
        <div class="setting-item">
          <label class="api-key-label">
            <span class="api-key-title">ElevenLabs API Key</span>
            <div class="setting-description">Required for text-to-speech functionality. Your key is stored locally and never sent to our servers.</div>
            <div class="api-key-input-container">
                <input 
                  type={showApiKey ? 'text' : 'password'}
                  class="api-key-input"
                  bind:value={settings.elevenlabsApiKey}
                  on:input={() => settings.preset = 'custom'}
                  placeholder="sk-..."
                  autocomplete="off"
                  spellcheck="false"
                />
                <button 
                  type="button"
                  class="api-key-toggle"
                  on:click={() => showApiKey = !showApiKey}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {#if showApiKey}
                    <!-- Eye slash icon -->
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  {:else}
                    <!-- Eye icon -->
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  {/if}
                </button>
              </div>
          </label>
        </div>
        
        <div class="setting-item">
          <label class="range-label">
            <span class="range-title">Pause Between Lines</span>
            <div class="setting-description">Duration of pause between haiku lines during text-to-speech</div>
            <div class="range-input-container">
                <input 
                  type="range"
                  class="range-input"
                  bind:value={settings.ttsPauseDuration}
                  on:input={() => settings.preset = 'custom'}
                  min="0.1"
                  max="3.0"
                  step="0.1"
                />
              <div class="range-value">
                {settings.ttsPauseDuration}s
              </div>
            </div>
            <div class="range-marks">
                <span>0.1s</span>
                <span>1.5s</span>
                <span>3.0s</span>
            </div>
          </label>
        </div>
      </div>

  <!-- Removed non-functional toggles: gentle error pulse, line guide on focus, soft success pulse, hide header, indicator mode, ephemeral hints -->
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
  
  /* API Key Input Styles */
  .api-key-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  
  .api-key-title {
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
  }
  
  .api-key-input-container {
    position: relative;
    display: flex;
    align-items: center;
    margin-top: 8px;
  }
  
  .api-key-input {
    width: 100%;
    padding: 12px 48px 12px 16px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: 'Courier New', monospace;
    transition: all 0.2s;
  }
  
  .api-key-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-focus) 20%, transparent);
  }
  
  .api-key-input::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  .api-key-toggle {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    color: var(--text-secondary);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .api-key-toggle:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  /* Range input styles */
  .range-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  
  .range-title {
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
  }
  
  .range-input-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }
  
  .range-input {
    flex: 1;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    transition: all 0.2s;
  }
  
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--border-focus);
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .range-input::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .range-input::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--border-focus);
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .range-input::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .range-value {
    min-width: 40px;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--border-focus);
    font-family: 'Courier New', monospace;
  }
  
  .range-marks {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  /* Inline panel styles */
  /* unused: .settings-panel-content ... */
  
  /* unused */
  
  /* unused */
  
  /* unused */
  
  /* unused */
  
  /* unused: .hidden */
  
  /* GitHub OAuth UI Styles */
  .github-auth-section {
    width: 100%;
  }
  
  .github-auth-header {
    margin-bottom: 16px;
  }
  
  .github-auth-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }
  
  .github-signin-container {
    margin-bottom: 12px;
  }
  
  .github-signin-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    background: #24292f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .github-signin-button:hover:not(:disabled) {
    background: #1f2328;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(36, 41, 47, 0.3);
  }
  
  .github-signin-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .github-signin-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .github-user-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-secondary, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  
  .github-user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .github-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--border-color, #e2e8f0);
  }
  
  .github-user-details {
    display: flex;
    flex-direction: column;
  }
  
  .github-user-name {
    font-weight: 600;
    color: var(--text-primary, #1f2937);
    font-size: 14px;
  }
  
  .github-user-login {
    color: var(--text-secondary, #6b7280);
    font-size: 12px;
  }
  
  .github-signout-button {
    padding: 6px 12px;
    background: transparent;
    color: var(--text-secondary, #6b7280);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .github-signout-button:hover {
    background: var(--bg-tertiary, #f1f5f9);
    color: var(--text-primary, #1f2937);
  }
  
  .github-status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-tertiary, #f1f5f9);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }
  
  .github-status-indicator.success {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #166534;
  }
  
  .github-error-message {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #dc2626;
    font-size: 12px;
  }
  
  .github-signin-rationale {
    background: var(--bg-secondary, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  }
  
  .rationale-content {
    margin-bottom: 16px;
  }
  
  .rationale-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
    margin-bottom: 8px;
  }
  
  .rationale-description {
    font-size: 14px;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 12px;
    line-height: 1.5;
  }
  
  .rationale-features {
    list-style: none;
    padding: 0;
    margin: 0 0 12px 0;
  }
  
  .rationale-features li {
    font-size: 13px;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 4px;
    padding-left: 8px;
  }
  
  .rationale-note {
    font-size: 12px;
    color: var(--text-tertiary, #9ca3af);
    line-height: 1.4;
    margin: 0;
  }
  
  .rationale-note strong {
    color: var(--text-secondary, #6b7280);
  }
</style>