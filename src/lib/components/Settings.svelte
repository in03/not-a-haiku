<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { poemTypes } from '../poemTypes.js';
  import { authStore } from '$lib/stores/auth.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import { gitHubSync } from '$lib/github-sync.js';
  
  const dispatch = createEventDispatcher();
  
  export let isOpen = false;
  export let isModal = true; // New prop to control modal vs inline behavior
  /** @type {any} */
  export let settings = {
    autoBackspace: true,
    enableShake: true,
    enableConfetti: true,
    poemType: 'haiku',
    showProgressBar: true,
    elevenlabsApiKey: '',
    ttsPauseDuration: 1.0,
    enableTaskTracking: false,
    enableTTS: false,
    enableCritique: false,
    enableSync: true,
    autoSync: true,
    syncInterval: 30,
    syncOnStartup: true,
    showSyncStatus: false,
    hasSeenOnboarding: false
  };

  let activeTab = 'editor';
  let poemTypeExpanded = false;
  let showApiKey = false;
  
  // Sync state
  let isSyncing = false;
  let syncStatus = /** @type {any} */ (null);
  let haikuStats = /** @type {{ total: number; [key: string]: any }} */ ({ total: 0 });
  
  // Load haiku stats on mount
  onMount(async () => {
    try {
      haikuStats = /** @type {any} */ (await haikuStore.getStats());
      if ($authStore.isAuthenticated) {
        syncStatus = await gitHubSync.getSyncStatus();
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  });
  
  // Update stats when auth changes
  $: if ($authStore.isAuthenticated && !syncStatus) {
    gitHubSync.getSyncStatus().then(status => {
      syncStatus = status;
    }).catch(console.error);
  }
  
  // Handle sync action
  async function handleSync() {
    if (isSyncing || !$authStore.isAuthenticated) return;
    
    isSyncing = true;
    try {
      const result = await gitHubSync.sync();
      console.log('Sync result:', result.message);
      
      // Refresh stats after sync
      syncStatus = await gitHubSync.getSyncStatus();
      haikuStats = /** @type {any} */ (await haikuStore.getStats());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      isSyncing = false;
    }
  }
  
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

  // Helper function to check if feature is disabled due to auth/API key requirements
  /** @param {string} feature */
  function isFeatureDisabled(feature) {
    if (feature === 'critique' || feature === 'sync') {
      return !$authStore.isAuthenticated;
    }
    if (feature === 'tts') {
      return !settings.elevenlabsApiKey || settings.elevenlabsApiKey.trim() === '';
    }
    return false;
  }
</script>

{#if isModal}
  {#if isOpen}
    <div class="settings-overlay" role="button" tabindex="0" on:click={handleClose} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClose()}>
      <div class="settings-modal" role="dialog" aria-modal="true" tabindex="0" on:keydown={(e) => e.key === 'Escape' && handleClose()} on:click|stopPropagation>
        <div class="settings-content-wrapper">
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
    </div>
  {/if}
{:else}
  <!-- Inline panel version (content only) -->
  <div class="settings-content-wrapper">
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button class="tab-button {activeTab === 'editor' ? 'active' : ''}" on:click={() => activeTab = 'editor'}>
        Editor
      </button>
      <button class="tab-button {activeTab === 'features' ? 'active' : ''}" on:click={() => activeTab = 'features'}>
        Features
      </button>
      <button class="tab-button {activeTab === 'tts' ? 'active' : ''}" on:click={() => activeTab = 'tts'}>
        TTS
      </button>
      <button class="tab-button {activeTab === 'sync' ? 'active' : ''}" on:click={() => activeTab = 'sync'}>
        Sync
      </button>
      <button class="tab-button {activeTab === 'auth' ? 'active' : ''}" on:click={() => activeTab = 'auth'}>
        Auth
      </button>
    </div>

    <div class="settings-content">
      <!-- Editor Tab -->
      {#if activeTab === 'editor'}
        <div class="setting-group">
          <h3 class="setting-label">Editor Settings</h3>
          
          <!-- Poem Type Selection -->
          <div class="setting-item">
            <div class="setting-item-label" id="poem-type-label">Poem Type</div>
            
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

          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" class="toggle-input" bind:checked={settings.autoBackspace} />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Auto backspace on over-limit</span>
                <div class="setting-description">Automatically removes the last word when syllable limit is exceeded</div>
              </span>
            </label>
          </div>

          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={settings.showProgressBar} class="toggle-input" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Show progress bar</span>
                <div class="setting-description">Displays a thin progress bar that fills as syllables match.</div>
              </span>
            </label>
          </div>

          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" class="toggle-input" bind:checked={settings.enableShake} />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable shake animation</span>
                <div class="setting-description">Shake the editor when limits are reached</div>
              </span>
            </label>
          </div>
          
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={settings.enableConfetti} class="toggle-input" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable celebration (confetti)</span>
                <div class="setting-description">Show confetti when you submit a completed poem</div>
              </span>
            </label>
          </div>
          
        </div>
      {/if}

      <!-- Features Tab -->
      {#if activeTab === 'features'}
        <div class="setting-group">
          <h3 class="setting-label">Features</h3>
          
          <div class="setting-item">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={settings.enableTaskTracking} class="toggle-input" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable task tracking</span>
                <div class="setting-description">Track haikus as tasks with todo/in-progress/done status. Adds checkboxes to grid view and status filtering.</div>
              </span>
            </label>
          </div>
          
          <div class="setting-item">
            <label class="toggle-label {isFeatureDisabled('critique') ? 'disabled' : ''}">
              <input 
                type="checkbox" 
                bind:checked={settings.enableCritique} 
                class="toggle-input"
                disabled={isFeatureDisabled('critique')}
              />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable AI Analysis</span>
                <div class="setting-description">
                  Get AI analysis and critique of your haikus. 
                  {#if isFeatureDisabled('critique')}
                    <span class="requirement-hint">Requires GitHub authentication</span>
                  {:else}
                    Note: This feature uses GitHub Models quota.
                  {/if}
                </div>
              </span>
            </label>
          </div>

        </div>
      {/if}

      <!-- TTS Tab -->
      {#if activeTab === 'tts'}
        <div class="setting-group">
          <h3 class="setting-label">Text to Speech</h3>
          
          <div class="setting-item">
            <label class="toggle-label {isFeatureDisabled('tts') ? 'disabled' : ''}">
              <input 
                type="checkbox" 
                bind:checked={settings.enableTTS} 
                class="toggle-input"
                disabled={isFeatureDisabled('tts')}
              />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable TTS</span>
                <div class="setting-description">
                  Read haikus aloud using ElevenLabs text-to-speech
                  {#if isFeatureDisabled('tts')}
                    <span class="requirement-hint">Requires ElevenLabs API key</span>
                  {/if}
                </div>
              </span>
            </label>
          </div>
          
          <div class="setting-item">
            <div class="range-label">
              <span class="range-title">Pause between lines</span>
              <div class="setting-description">Duration of pause between haiku lines during text-to-speech</div>
              <div class="range-input-container">
                <input 
                  type="range"
                  class="range-input"
                  bind:value={settings.ttsPauseDuration}
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
            </div>
          </div>
        </div>
      {/if}

      <!-- Sync Tab -->
      {#if activeTab === 'sync'}
        <div class="setting-group">
          <h3 class="setting-label">Sync Settings</h3>
          
          <div class="setting-item">
            <label class="toggle-label {isFeatureDisabled('sync') ? 'disabled' : ''}">
              <input 
                type="checkbox" 
                bind:checked={settings.enableSync} 
                class="toggle-input"
                disabled={isFeatureDisabled('sync')}
              />
              <span class="toggle-slider"></span>
              <span class="toggle-text">
                <span class="toggle-title">Enable GitHub Sync</span>
                <div class="setting-description">
                  Sync your haikus to GitHub Gists for backup and cross-device access.
                  {#if isFeatureDisabled('sync')}
                    <span class="requirement-hint">Requires GitHub authentication</span>
                  {:else}
                    Your haikus will be stored in a private GitHub Gist.
                  {/if}
                </div>
              </span>
            </label>
          </div>

          {#if settings.enableSync && !isFeatureDisabled('sync')}
            <div class="setting-item">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={settings.autoSync} class="toggle-input" />
                <span class="toggle-slider"></span>
                <span class="toggle-text">
                  <span class="toggle-title">Automatic Sync</span>
                  <div class="setting-description">Automatically sync at regular intervals</div>
                </span>
              </label>
            </div>

            {#if settings.autoSync}
              <div class="setting-item">
                <div class="range-label">
                  <span class="range-title">Sync Interval</span>
                  <div class="setting-description">How often to automatically sync your haikus</div>
                  <div class="range-input-container">
                    <input 
                      type="range"
                      class="range-input"
                      bind:value={settings.syncInterval}
                      min="5"
                      max="1440"
                      step="5"
                    />
                    <div class="range-value">
                      {settings.syncInterval}m
                    </div>
                  </div>
                  <div class="range-marks">
                    <span>5m</span>
                    <span>720m</span>
                    <span>1440m</span>
                  </div>
                </div>
              </div>
            {/if}

            <div class="setting-item">
              <label class="toggle-label">
                <input type="checkbox" bind:checked={settings.syncOnStartup} class="toggle-input" />
                <span class="toggle-slider"></span>
                <span class="toggle-text">
                  <span class="toggle-title">Sync on Startup</span>
                  <div class="setting-description">Automatically sync when the app starts</div>
                </span>
              </label>
            </div>
          {/if}
        </div>

        <div class="setting-group">
          <h3 class="setting-label">Storage & Sync</h3>
          
          <div class="setting-item">
            <div class="local-storage-info">
              <h4 class="storage-info-title">Local Storage</h4>
              <p class="storage-info-text">
                Your haikus are stored locally in your browser using IndexedDB. 
                They'll persist between sessions and work offline.
              </p>
              <div class="storage-stats">
                <span class="stat-item">
                  <span class="stat-label">Stored locally:</span>
                  <span class="stat-value">{haikuStats.total} haikus</span>
                </span>
                {#if syncStatus}
                  <span class="stat-item">
                    <span class="stat-label">Synced:</span>
                    <span class="stat-value">{syncStatus.synced} haikus</span>
                  </span>
                  <span class="stat-item">
                    <span class="stat-label">Unsynced:</span>
                    <span class="stat-value">{syncStatus.unsynced} haikus</span>
                  </span>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="setting-item">
            <div class="github-sync-section">
              <div class="github-sync-header">
                <span class="github-sync-title">GitHub Sync</span>
                <div class="setting-description">
                  Sync your haikus to GitHub using private gists. 
                  {#if isFeatureDisabled('sync')}
                    <span class="requirement-hint">Requires GitHub authentication</span>
                  {:else}
                    All haikus are stored locally first for offline access.
                  {/if}
                </div>
              </div>
              
              {#if $authStore.isAuthenticated && $authStore.user}
                <!-- Authenticated state -->
                <div class="github-sync-status">
                  <div class="sync-status-indicator success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22,4 12,14.01 9,11.01"></polyline>
                    </svg>
                    <span>GitHub sync available • Private gists will be used for backup</span>
                  </div>
                  
                  <div class="sync-controls">
                    <button 
                      type="button" 
                      class="sync-button" 
                      title="Sync now"
                      on:click={handleSync}
                      disabled={isSyncing}
                    >
                      {#if isSyncing}
                        <div class="sync-spinner"></div>
                        Syncing...
                      {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-2.2M22 12.5a10 10 0 0 1-18.8 2.2"/>
                        </svg>
                        Sync Now
                      {/if}
                    </button>
                    <span class="sync-info">
                      Last sync: {syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              {:else}
                <!-- Unauthenticated state -->
                <div class="github-sync-status">
                  <div class="sync-status-indicator">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>Sign in with GitHub to enable haiku syncing • Available in the navbar</span>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Auth Tab -->
      {#if activeTab === 'auth'}
        <div class="setting-group">
          <h3 class="setting-label">Authentication & API Keys</h3>
          
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
                      src={(/** @type {any} */($authStore.user))?.avatar_url} 
                      alt={(/** @type {any} */($authStore.user))?.name || (/** @type {any} */($authStore.user))?.login}
                      class="github-avatar"
                    />
                    <div class="github-user-details">
                      <div class="github-user-name">
                        {(/** @type {any} */($authStore.user))?.name || (/** @type {any} */($authStore.user))?.login}
                      </div>
                      <div class="github-user-login">@{(/** @type {any} */($authStore.user))?.login}</div>
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
          
          <div class="setting-item">
            <div class="api-key-label">
              <span class="api-key-title">ElevenLabs API Key</span>
              <div class="setting-description">Required for text-to-speech functionality. Your key is stored locally and never sent to our servers.</div>
              <div class="api-key-input-container">
                <input 
                  type={showApiKey ? 'text' : 'password'}
                  class="api-key-input"
                  bind:value={settings.elevenlabsApiKey}
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
            </div>
          </div>
        </div>
      {/if}
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
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px var(--card-shadow);
    max-width: 500px;
    width: 100%;
    max-height: calc(100vh - 40px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .settings-modal > .settings-content-wrapper {
    border-radius: 12px;
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
    border-radius: 8px;
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
    padding: 0;
    box-sizing: border-box;
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    overflow-x: auto;
  }

  .tab-button {
    padding: 16px 24px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-button:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .tab-button.active {
    color: var(--border-focus);
    border-bottom-color: var(--border-focus);
    background: var(--bg-primary);
  }
  
  .settings-content {
    max-width: none;
    width: 100%;
    padding: 24px;
    padding-bottom: 16px;
    background: var(--bg-primary);
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

  .setting-item-label {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
    display: block;
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
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-focus) 15%, transparent);
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
      transform: translateY(-5px);
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

  .toggle-label.disabled {
    opacity: 0.7;
    cursor: not-allowed;
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

  .toggle-input:disabled + .toggle-slider {
    background: var(--bg-tertiary);
    opacity: 0.7;
  }

  .toggle-input:disabled:checked + .toggle-slider {
    background: color-mix(in srgb, var(--border-focus) 60%, var(--bg-tertiary));
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

  .requirement-hint {
    color: var(--border-focus);
    font-weight: 500;
  }
  
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
    border-radius: 8px;
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
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--border-focus) 15%, transparent);
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
    border-radius: 6px;
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
    appearance: none;
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
    box-shadow: 0 4px 12px rgba(36, 41, 47, 0.3);
  }
  
  .github-signin-button:disabled {
    opacity: 0.8;
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
    border-radius: 8px;
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
    border-radius: 8px;
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

  /* GitHub Sync Section Styles */
  .github-sync-section {
    width: 100%;
  }

  .github-sync-header {
    margin-bottom: 16px;
  }

  .github-sync-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  .github-sync-status {
    background: var(--bg-secondary, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .sync-status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }

  .sync-status-indicator.success {
    color: #166534;
  }

  .sync-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sync-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--border-focus, #3b82f6);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sync-button:hover:not(:disabled) {
    background: var(--border-focus-dark, #2563eb);
  }

  .sync-button:disabled {
    opacity: 0.8;
    cursor: not-allowed;
  }

  .sync-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .sync-info {
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }

  .local-storage-info {
    background: var(--bg-tertiary, #f1f5f9);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
  }

  .storage-info-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
    margin-bottom: 8px;
  }

  .storage-info-text {
    font-size: 13px;
    color: var(--text-secondary, #6b7280);
    line-height: 1.4;
    margin-bottom: 12px;
  }

  .storage-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-tertiary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }
</style>