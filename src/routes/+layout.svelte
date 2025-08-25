<script>
  import '../app.css';
  import { Menu, X, Settings as SettingsIcon, Github, BookOpen } from 'lucide-svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { getPoemType } from '$lib/poemTypes.js';
  let isMenuOpen = false;

  function openMenu() { isMenuOpen = true; }
  function closeMenu() { isMenuOpen = false; }

  /** @param {string} word */
  const articleFor = (word) => /^(a|e|i|o|u)/i.test(word || '') ? 'an' : 'a';
  $: poem = getPoemType($settingsStore?.poemType || 'haiku');
  $: poemName = poem?.name || 'Haiku';
  $: poemNameLower = poemName.toLowerCase();
  $: poemArticle = articleFor(poemNameLower);
</script>

<header class="w-full border-b border-base-300 bg-base-100 text-base-content">
  <div class="container mx-auto px-4 py-3">
    <div class="navbar p-0">
      <div class="navbar-start">
        <a href="/" class="font-semibold text-base-content site-title-link">Not {poemArticle} {poemName}</a>
      </div>
      <div class="navbar-center hidden sm:flex"></div>
      <div class="navbar-end flex items-center gap-2">
        <nav class="hidden sm:flex items-center gap-2">
          <a href="/settings" class="btn btn-sm btn-ghost" aria-label="Settings" title="Settings">
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

<main class="min-h-screen bg-base-100 text-base-content">
  <slot />
</main>

<footer class="w-full border-t border-base-300 bg-base-100 text-base-content py-4">
  <div class="container mx-auto px-4 text-center">
    <p class="text-sm text-base-content/70">
      Made with <span class="text-red-500">♥</span> by 
      <a href="https://calebtrevatt.com" target="_blank" rel="noopener noreferrer" class="link link-hover text-base-content font-medium">Caleb Trevatt</a>
    </p>
  </div>
</footer>

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
      <a href="/settings" class="btn btn-ghost" on:click={closeMenu}>
        <SettingsIcon class="w-4 h-4" />
        <span class="ml-2">Settings</span>
      </a>
      <a href="https://github.com/in03/not-a-haiku" class="btn btn-ghost" rel="noopener noreferrer" target="_blank" on:click={closeMenu}>
        <Github class="w-4 h-4" />
        <span class="ml-2">GitHub</span>
      </a>
      <a href="https://en.wikipedia.org/wiki/Haiku" class="btn btn-ghost" on:click={closeMenu}>
        <BookOpen class="w-4 h-4" />
        <span class="ml-2">Docs</span>
      </a>
    </nav>
  </div>
{/if}

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