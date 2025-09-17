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
  import { getGitHubAuthUrl, generateState, isOAuthAvailable } from '$lib/auth/github.js';
  let isMenuOpen = false;
  
  
  // Grid view state
  let showGridView = false;
  let viewerOpen = false;
  let allHaikus = [];

  function openMenu() { isMenuOpen = true; }
  function closeMenu() { isMenuOpen = false; }
  
  
  
  // Handle keyboard shortcuts
  function handleKeydown(event) {
    // CMD/CTRL + K to open search (grid view)
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      openGridView();
    }
    
    // Escape to close grid view (only if viewer is not open)
    if (event.key === 'Escape' && showGridView && !viewerOpen) {
      closeGridView();
    }
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
    viewerOpen = false;
  }
  
  function handleViewerOpen() {
    viewerOpen = true;
  }
  
  function handleViewerClose() {
    viewerOpen = false;
  }
  
  // Handle edit from viewer
  function handleEdit(event) {
    const haiku = event.detail;
    // Close the grid view and navigate to home with the haiku data
    closeGridView();
    // Store the haiku data for editing
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('editHaiku', JSON.stringify(haiku));
      // Navigate to home page
      window.location.href = base || '/';
    }
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
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
  
  // Handle GitHub sign in
  function handleGitHubSignIn() {
    // Check if OAuth is configured
    if (!isOAuthAvailable) {
      alert('GitHub authentication is not configured. Please check your environment variables.');
      return;
    }
    
    try {
      // Generate CSRF state and store it
      const state = generateState();
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('oauth_state', state);
      }
      
      // Redirect to GitHub OAuth authorization
      const authUrl = getGitHubAuthUrl(state);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error);
      alert('GitHub OAuth is not properly configured. Please check your environment variables.');
    }
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
          
          <!-- Search button -->
          <div class="hidden sm:flex items-center gap-2 ml-4">
            <button class="btn btn-sm btn-ghost" title="Search haikus" on:click={openGridView}>
              <Search class="w-4 h-4" />
              </button>
          </div>
        </div>
        <div class="navbar-end flex items-center gap-2">
          <nav class="hidden sm:flex items-center gap-2">
            <a href="{base}/settings" class="btn btn-sm btn-ghost" aria-label="Settings" title="Settings">
              <SettingsIcon class="w-4 h-4" />
            </a>
            <a href="https://github.com/in03/not-a-haiku" class="btn btn-sm btn-ghost" rel="noopener noreferrer" target="_blank" aria-label="GitHub" title="GitHub">
              <Github class="w-4 h-4" />
            </a>
            <a href="https://en.wikipedia.org/wiki/Haiku" class="btn btn-sm btn-ghost" aria-label="Docs" title="Docs">
              <BookOpen class="w-4 h-4" />
            </a>
            
            <!-- GitHub Authentication - moved to far right -->
            {#if isOAuthAvailable}
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
            {:else}
              <!-- OAuth not configured notice -->
              <span class="text-xs text-base-content/50" title="GitHub authentication requires environment variables">
                OAuth not configured
              </span>
            {/if}
          </nav>
          <div class="flex items-center gap-1 sm:hidden">
            <!-- Search button (Mobile) -->
            <button class="btn btn-sm btn-ghost" on:click={openGridView} aria-label="Search haikus">
              <Search class="w-4 h-4" />
            </button>
            
            <!-- Mobile menu button -->
            <button class="btn btn-sm btn-ghost" aria-label="Open menu" on:click={openMenu}>
              <Menu class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="bg-base-100 text-base-content flex-grow overflow-auto">
    <slot />
  </main>

  <footer class="w-full border-t border-base-300 bg-base-100 text-base-content py-2 flex-shrink-0">
  <div class="container mx-auto px-4">
    <!-- Single row with features left, credit right (features hidden on mobile/tablet) -->
    <div class="flex flex-col sm:flex-row items-center lg:justify-between justify-center gap-2 text-sm">
      <!-- Feature indicators (hidden on mobile and tablet) -->
      <div class="hidden lg:flex items-center gap-3 sm:gap-4 text-xs text-base-content/50">
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-green-500 rounded-full"></span>
          Tasks as poetry
        </span>
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-blue-500 rounded-full"></span>
          ML Syllable smarts
        </span>
        <span class="flex items-center gap-1">
          <span class="w-1 h-1 bg-orange-500 rounded-full"></span>
          AI analysis + sync via GitHub
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
      <!-- Search button (Mobile) - moved to navbar -->
      <div class="divider my-1"></div>
      
      <!-- GitHub Authentication (Mobile) -->
      {#if isOAuthAvailable}
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
      {:else}
        <!-- OAuth not available notice -->
        <div class="text-center py-2">
          <span class="text-xs text-base-content/50">
            GitHub authentication unavailable on static deployments
          </span>
        </div>
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


<!-- Haiku Grid View -->
<HaikuGridView 
  bind:isOpen={showGridView}
  haikus={allHaikus}
  on:close={closeGridView}
  on:viewerOpen={handleViewerOpen}
  on:viewerClose={handleViewerClose}
  on:edit={handleEdit}
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


</style>