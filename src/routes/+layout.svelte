<script>
  import '../app.css';
  import { Menu, X, Settings as SettingsIcon, Github, BookOpen, User, Search, LayoutGrid } from 'lucide-svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { authStore } from '$lib/stores/auth.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import { getPoemType } from '$lib/poemTypes.js';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import HaikuGridView from '$lib/components/HaikuGridView.svelte';
  import confetti from 'canvas-confetti';
  let isMenuOpen = false;
  let searchQuery = '';
  let showSearchResults = false;
  let searchResults = [];
  let searchInput;
  
  // Quick search modal state
  let showQuickSearch = false;
  let quickSearchQuery = '';
  let quickSearchResults = [];
  let quickSearchInput;
  
  // Grid view state
  let showGridView = false;
  let allHaikus = [];

  function openMenu() { isMenuOpen = true; }
  function closeMenu() { isMenuOpen = false; }
  
  // Search functionality
  async function handleSearch() {
    if (!searchQuery.trim()) {
      showSearchResults = false;
      return;
    }
    
    try {
      searchResults = await haikuStore.search(searchQuery);
      showSearchResults = true;
    } catch (error) {
      console.error('Search failed:', error);
      searchResults = [];
    }
  }
  
  function clearSearch() {
    searchQuery = '';
    showSearchResults = false;
    searchResults = [];
  }
  
  // Handle search input
  function onSearchInput() {
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      showSearchResults = false;
    }
  }
  
  // Close search results when clicking outside
  function handleClickOutside(event) {
    if (searchInput && !searchInput.contains(event.target)) {
      showSearchResults = false;
    }
  }
  
  // Quick search functionality
  async function handleQuickSearch() {
    if (!quickSearchQuery.trim()) {
      quickSearchResults = [];
      return;
    }
    
    try {
      quickSearchResults = await haikuStore.search(quickSearchQuery);
    } catch (error) {
      console.error('Quick search failed:', error);
      quickSearchResults = [];
    }
  }
  
  function openQuickSearch() {
    showQuickSearch = true;
    quickSearchQuery = '';
    quickSearchResults = [];
    
    // Focus the input after a tick
    setTimeout(() => {
      if (quickSearchInput) {
        quickSearchInput.focus();
      }
    }, 10);
  }
  
  function closeQuickSearch() {
    showQuickSearch = false;
    quickSearchQuery = '';
    quickSearchResults = [];
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event) {
    // CMD/CTRL + K for quick search
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      openQuickSearch();
    }
    
    // Escape to close quick search
    if (event.key === 'Escape' && showQuickSearch) {
      closeQuickSearch();
    }
  }
  
  // Handle quick search input
  function onQuickSearchInput() {
    handleQuickSearch();
  }
  
  // Grid view functionality
  async function openGridView() {
    try {
      allHaikus = await haikuStore.load();
      showGridView = true;
    } catch (error) {
      console.error('Failed to load haikus for grid view:', error);
    }
  }
  
  function closeGridView() {
    showGridView = false;
  }
  
  async function refreshHaikus() {
    try {
      allHaikus = await haikuStore.load();
    } catch (error) {
      console.error('Failed to refresh haikus:', error);
    }
  }
  
  // Confetti celebration function
  function triggerConfetti() {
    if ($settingsStore.enableConfetti) {
      confetti({
        particleCount: 150,
        spread: 80,
        startVelocity: 80,
        origin: { y: 1.2 } // Position below viewport
      });
    }
  }

  /** @param {string} word */
  const articleFor = (word) => /^(a|e|i|o|u)/i.test(word || '') ? 'an' : 'a';
  $: poem = getPoemType($settingsStore?.poemType || 'haiku');
  $: poemName = poem?.name || 'Haiku';
  $: poemNameLower = poemName.toLowerCase();
  $: poemArticle = articleFor(poemNameLower);
  
  // Initialize auth store on mount
  onMount(() => {
    authStore.init();
    
    // Add event listeners
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
  
  // Handle GitHub sign in
  function handleGitHubSignIn() {
    window.location.href = '/api/auth/github';
  }
  
  // Modal state
  let showSignOutModal = false;
  
  // Handle GitHub sign out
  function handleGitHubSignOut() {
    authStore.signOut();
    showSignOutModal = false;
  }
  
  // Show sign out confirmation
  function showSignOutConfirmation() {
    showSignOutModal = true;
  }
</script>

<div class="h-screen flex flex-col">
  <header class="w-full border-b border-base-300 bg-base-100 text-base-content flex-shrink-0">
    <div class="container mx-auto px-4 py-3">
      <div class="navbar p-0">
        <div class="navbar-start">
          <a href="{base}/" class="font-semibold text-base-content site-title-link">Not {poemArticle} {poemName}</a>
        </div>
        <div class="navbar-center hidden sm:flex relative flex-1 justify-center">
          <div class="search-container" bind:this={searchInput}>
            <div class="search-input-wrapper">
              <Search class="search-icon" size="16" />
              <input
                type="text"
                placeholder="Search haikus..."
                class="search-input"
                bind:value={searchQuery}
                on:input={onSearchInput}
                on:focus={() => searchQuery && (showSearchResults = true)}
              />
              {#if searchQuery}
                <button class="search-clear" on:click={clearSearch} aria-label="Clear search">
                  <X size="14" />
                </button>
              {/if}
              <button class="grid-view-button" title="View all haikus" on:click={openGridView}>
                <LayoutGrid size="16" />
              </button>
            </div>
            
            {#if showSearchResults}
              <div class="search-results">
                {#if searchResults.length > 0}
                  <div class="search-results-header">
                    <span class="search-results-count">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="search-results-list">
                    {#each searchResults as haiku}
                      <div class="search-result-item">
                        <div class="search-result-title">{haiku.title}</div>
                        <div class="search-result-content">
                          {haiku.lines.join(' / ')}
                        </div>
                        <div class="search-result-meta">
                          {#if haiku.tags.length > 0}
                            <div class="search-result-tags">
                              {#each haiku.tags as tag}
                                <span class="search-result-tag">{tag}</span>
                              {/each}
                            </div>
                          {/if}
                          <span class="search-result-status status-{haiku.status}">{haiku.status}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="search-no-results">
                    <span>No haikus found for "{searchQuery}"</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        <div class="navbar-end flex items-center gap-2">
          <nav class="hidden sm:flex items-center gap-2">
            <!-- GitHub Authentication -->
            {#if $authStore.isAuthenticated && $authStore.user}
              <!-- Sign Out Button -->
              <button 
                class="btn btn-sm btn-outline btn-error"
                on:click={showSignOutConfirmation}
              >
                <Github class="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            {:else}
              <!-- Sign In Button -->
              <button 
                class="btn btn-sm btn-primary"
                on:click={handleGitHubSignIn}
                disabled={$authStore.isLoading}
              >
                {#if $authStore.isLoading}
                  <span class="loading loading-spinner loading-xs"></span>
                  <span>Connecting...</span>
                {:else}
                  <Github class="w-4 h-4" />
                  <span>Sign In</span>
                {/if}
              </button>
            {/if}
            
            <a href="{base}/settings" class="btn btn-sm btn-ghost" aria-label="Settings" title="Settings">
              <SettingsIcon class="w-4 h-4" />
            </a>
            <a href="https://github.com/in03/not-a-haiku" class="btn btn-sm btn-ghost" rel="noopener noreferrer" target="_blank" aria-label="GitHub" title="GitHub">
              <Github class="w-4 h-4" />
            </a>
            <a href="https://en.wikipedia.org/wiki/Haiku" class="btn btn-sm btn-ghost" aria-label="Docs" title="Docs">
              <BookOpen class="w-4 h-4" />
            </a>
          </nav>
          <button class="btn btn-sm btn-ghost sm:hidden" aria-label="Open menu" on:click={openMenu}>
            <Menu class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="bg-base-100 text-base-content flex-grow overflow-auto">
    <slot />
  </main>

  <footer class="w-full border-t border-base-300 bg-base-100 text-base-content py-2 flex-shrink-0">
  <div class="container mx-auto px-4">
    <!-- Single row with features left, credit right -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
      <!-- Feature indicators -->
      <div class="flex items-center gap-3 sm:gap-4 text-xs text-base-content/50">
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-green-500 rounded-full"></span>
          Auto line breaks
        </span>
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-blue-500 rounded-full"></span>
          Real-time validation
        </span>
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-orange-500 rounded-full"></span>
          Works offline
        </span>
      </div>
      
      <!-- Credit -->
      <p class="text-sm text-base-content/70">
        Made with <span class="text-red-500">♥</span> by 
        <a href="https://calebtrevatt.com" target="_blank" rel="noopener noreferrer" class="link link-hover text-base-content font-medium">Caleb Trevatt</a>
      </p>
    </div>
  </div>
  </footer>
</div>

{#if isMenuOpen}
  <div class="drawer-overlay" role="button" tabindex="0" aria-label="Close menu" on:click={closeMenu} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeMenu()}></div>
  <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu" tabindex="0" on:keydown={(e) => e.key === 'Escape' && closeMenu()}>
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm text-neutral-400">Menu</span>
      <button class="btn btn-xs btn-ghost" aria-label="Close" on:click={closeMenu}>
        <X class="w-4 h-4" />
      </button>
    </div>
    <nav class="flex flex-col gap-2">
      <!-- GitHub Authentication (Mobile) -->
      {#if $authStore.isAuthenticated && $authStore.user}
        <button 
          class="btn btn-outline btn-error"
          on:click={() => { showSignOutConfirmation(); closeMenu(); }}
        >
          <Github class="w-4 h-4" />
          <span class="ml-2">Sign Out</span>
        </button>
        <div class="divider my-1"></div>
      {:else}
        <button 
          class="btn btn-primary"
          on:click={() => { handleGitHubSignIn(); closeMenu(); }}
          disabled={$authStore.isLoading}
        >
          {#if $authStore.isLoading}
            <span class="loading loading-spinner loading-xs"></span>
            <span class="ml-2">Connecting...</span>
          {:else}
            <Github class="w-4 h-4" />
            <span class="ml-2">Sign In with GitHub</span>
          {/if}
        </button>
        <div class="divider my-1"></div>
      {/if}
      
      <a href="{base}/settings" class="btn btn-ghost" on:click={closeMenu}>
        <SettingsIcon class="w-4 h-4" />
        <span class="ml-2">Settings</span>
      </a>
      <a href="https://github.com/in03/not-a-haiku" class="btn btn-ghost" rel="noopener noreferrer" target="_blank" on:click={closeMenu}>
        <Github class="w-4 h-4" />
        <span class="ml-2">GitHub</span>
      </a>
      <a href="https://en.wikipedia.org/wiki/Haiku" class="btn btn-ghost" rel="noopener noreferrer" target="_blank" on:click={closeMenu}>
        <BookOpen class="w-4 h-4" />
        <span class="ml-2">Docs</span>
      </a>
    </nav>
  </div>
{/if}

<!-- Sign Out Confirmation Modal -->
{#if showSignOutModal && $authStore.user}
  <!-- Modal overlay - responsive approach -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <!-- Modal content - responsive sizing -->
    <div class="bg-base-100 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
      <!-- Modal header -->
      <div class="flex items-center justify-between p-6 border-b border-base-300">
        <h3 class="text-lg font-semibold">Sign Out</h3>
        <button 
          class="btn btn-sm btn-ghost btn-circle"
          on:click={() => showSignOutModal = false}
          aria-label="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      
      <!-- Modal body -->
      <div class="p-6 text-center">
        <!-- User avatar -->
        <div class="flex justify-center mb-4">
          <div class="avatar">
            <div class="w-16 rounded-full ring-2 ring-base-300">
              <img 
                src={$authStore.user.avatar_url} 
                alt={$authStore.user.name || $authStore.user.login}
                class="rounded-full"
              />
            </div>
          </div>
        </div>
        
        <!-- Confirmation text -->
        <h4 class="text-base font-medium mb-2">
          Are you sure you want to sign out?
        </h4>
        <p class="text-sm text-base-content/70 mb-6">
          You'll be signed out of <strong>{$authStore.user.name || $authStore.user.login}</strong>
        </p>
        
        <!-- Action buttons -->
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-3 sm:justify-center">
          <button 
            class="btn btn-ghost order-2 sm:order-1"
            on:click={() => showSignOutModal = false}
          >
            Cancel
          </button>
          <button 
            class="btn btn-error order-1 sm:order-2"
            on:click={handleGitHubSignOut}
          >
            <Github class="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Quick Search Modal (CMD/CTRL + K) -->
{#if showQuickSearch}
  <div class="quick-search-overlay" on:click={closeQuickSearch}>
    <div class="quick-search-modal" on:click|stopPropagation>
      <div class="quick-search-header">
        <div class="quick-search-input-wrapper">
          <Search class="quick-search-icon" size="20" />
          <input
            type="text"
            placeholder="Search haikus..."
            class="quick-search-input"
            bind:value={quickSearchQuery}
            bind:this={quickSearchInput}
            on:input={onQuickSearchInput}
          />
          <div class="quick-search-shortcut">
            <span>ESC</span>
          </div>
        </div>
      </div>
      
      <div class="quick-search-results">
        {#if quickSearchQuery.trim() === ''}
          <div class="quick-search-empty">
            <Search class="quick-search-empty-icon" size="32" />
            <div class="quick-search-empty-text">
              <h3>Search your haikus</h3>
              <p>Start typing to find haikus by title, content, or tags</p>
            </div>
            <div class="quick-search-tip">
              <span>Tip: Use <kbd>Ctrl</kbd> + <kbd>K</kbd> to open search anytime</span>
            </div>
          </div>
        {:else if quickSearchResults.length > 0}
          <div class="quick-search-results-list">
            {#each quickSearchResults as haiku, index}
              <div class="quick-search-result-item" data-index={index}>
                <div class="quick-search-result-content">
                  <div class="quick-search-result-title">{haiku.title}</div>
                  <div class="quick-search-result-text">
                    {haiku.lines.join(' / ')}
                  </div>
                  <div class="quick-search-result-meta">
                    {#if haiku.tags.length > 0}
                      <div class="quick-search-result-tags">
                        {#each haiku.tags as tag}
                          <span class="quick-search-result-tag">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                    <span class="quick-search-result-status status-{haiku.status}">{haiku.status}</span>
                  </div>
                </div>
                <div class="quick-search-result-action">
                  <span class="quick-search-action-hint">↵</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="quick-search-no-results">
            <div class="quick-search-no-results-text">
              <h3>No haikus found</h3>
              <p>No results for "<strong>{quickSearchQuery}</strong>"</p>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="quick-search-footer">
        <div class="quick-search-shortcuts">
          <span class="quick-search-shortcut-group">
            <kbd>↑</kbd><kbd>↓</kbd> navigate
          </span>
          <span class="quick-search-shortcut-group">
            <kbd>↵</kbd> select
          </span>
          <span class="quick-search-shortcut-group">
            <kbd>ESC</kbd> close
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Haiku Grid View -->
<HaikuGridView 
  bind:isOpen={showGridView}
  haikus={allHaikus}
  on:close={closeGridView}
  on:haikuUpdated={refreshHaikus}
  on:haikuDeleted={refreshHaikus}
  on:confetti={triggerConfetti}
/>

<style>
  .site-title-link {
    position: relative;
    transition: color 0.2s ease;
  }
  
  .site-title-link::after {
    content: '';
    position: absolute;
    width: 0;
    height: 2px;
    bottom: -2px;
    left: 50%;
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
    transition: all 0.3s ease;
    transform: translateX(-50%);
  }
  
  .site-title-link:hover::after {
    width: 100%;
  }
  
  .site-title-link:hover {
    color: #3b82f6;
  }

  /* Search Styles */
  .search-container {
    position: relative;
    width: 100%;
    max-width: 400px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .search-input-wrapper:focus-within {
    background: var(--bg-primary);
    border-color: var(--border-focus);
  }

  .search-icon {
    position: absolute;
    left: 14px;
    color: var(--text-secondary);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 88px 10px 42px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    position: absolute;
    right: 50px;
    padding: 4px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .search-clear:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .grid-view-button {
    position: absolute;
    right: 14px;
    padding: 6px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .grid-view-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 25px var(--card-shadow);
    z-index: 1000;
    max-height: 400px;
    overflow-y: auto;
  }

  .search-results-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .search-results-count {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .search-results-list {
    padding: 4px 0;
  }

  .search-result-item {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .search-result-item:hover {
    background: var(--bg-secondary);
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .search-result-title {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
    margin-bottom: 4px;
  }

  .search-result-content {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .search-result-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .search-result-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .search-result-tag {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 11px;
    border-radius: 4px;
  }

  .search-result-status {
    padding: 2px 6px;
    font-size: 11px;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-todo {
    background: #fef3c7;
    color: #92400e;
  }

  .status-in_progress {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-done {
    background: #d1fae5;
    color: #065f46;
  }

  .search-no-results {
    padding: 24px 12px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  /* Quick Search Modal Styles */
  .quick-search-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 100px;
  }

  .quick-search-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 25px 50px var(--card-shadow);
    width: 100%;
    max-width: 600px;
    max-height: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    margin: 0 20px;
  }

  .quick-search-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .quick-search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .quick-search-icon {
    position: absolute;
    left: 12px;
    color: hsl(var(--bc) / 0.6);
    pointer-events: none;
  }

  .quick-search-input {
    width: 100%;
    padding: 12px 80px 12px 44px;
    background: hsl(var(--b2));
    border: 1px solid hsl(var(--b3));
    border-radius: 8px;
    outline: none;
    font-size: 16px;
    transition: all 0.2s ease;
    color: hsl(var(--bc));
  }

  .quick-search-input:focus {
    background: hsl(var(--b1));
    border-color: hsl(var(--p));
    box-shadow: 0 0 0 3px hsl(var(--p) / 0.1);
  }

  .quick-search-shortcut {
    position: absolute;
    right: 12px;
    background: hsl(var(--b3));
    color: hsl(var(--bc) / 0.7);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .quick-search-results {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
  }

  .quick-search-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
  }

  .quick-search-empty-icon {
    color: #d1d5db;
    margin-bottom: 16px;
  }

  .quick-search-empty-text h3 {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 8px 0;
  }

  .quick-search-empty-text p {
    color: #6b7280;
    margin: 0 0 24px 0;
    line-height: 1.5;
  }

  .quick-search-tip {
    color: #9ca3af;
    font-size: 14px;
  }

  .quick-search-tip kbd {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 12px;
    margin: 0 2px;
  }

  .quick-search-results-list {
    padding: 8px 0;
  }

  .quick-search-result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #f8fafc;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .quick-search-result-item:hover {
    background: #f8fafc;
  }

  .quick-search-result-item:last-child {
    border-bottom: none;
  }

  .quick-search-result-content {
    flex: 1;
    min-width: 0;
  }

  .quick-search-result-title {
    font-weight: 600;
    color: #1f2937;
    font-size: 15px;
    margin-bottom: 4px;
  }

  .quick-search-result-text {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .quick-search-result-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .quick-search-result-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .quick-search-result-tag {
    padding: 2px 6px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    border-radius: 4px;
  }

  .quick-search-result-status {
    padding: 2px 6px;
    font-size: 11px;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .quick-search-result-action {
    display: flex;
    align-items: center;
    margin-left: 12px;
  }

  .quick-search-action-hint {
    background: #f1f5f9;
    color: #64748b;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .quick-search-no-results {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
  }

  .quick-search-no-results-text h3 {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 8px 0;
  }

  .quick-search-no-results-text p {
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .quick-search-footer {
    padding: 12px 20px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
  }

  .quick-search-shortcuts {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    color: #64748b;
  }

  .quick-search-shortcut-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .quick-search-shortcuts kbd {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 11px;
    margin: 0 1px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
</style>