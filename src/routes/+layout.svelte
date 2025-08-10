<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { initTheme, themeMode, setThemeMode, applyTheme } from '$lib/theme.js';
  import { settingsStore } from '$lib/stores/settings.js';

  /** @type {'auto'|'on'|'off'} */
  let currentTheme = 'auto';

  onMount(() => {
    initTheme();
    const unsub = themeMode.subscribe((m) => {
      /** @type {'auto'|'on'|'off'} */
      // @ts-ignore - runtime store can only hold these strings
      const mode = m;
      currentTheme = mode;
      applyTheme(mode);
    });
    return () => unsub();
  });

  /** @param {'auto'|'on'|'off'} mode */
  function selectTheme(mode) {
    setThemeMode(mode);
  }
</script>

<header class="w-full border-b border-base-300 bg-base-100 text-base-content">
  <div class="container mx-auto px-4 py-3">
    <div class="navbar p-0">
      <div class="navbar-start">
        <a href="/" class="font-semibold text-base-content">Not a Haiku</a>
      </div>
      <div class="navbar-center hidden sm:flex">
        <nav class="flex items-center gap-2 text-sm">
          <a href="/settings" class="btn btn-sm btn-ghost">Settings</a>
          <a href="https://github.com/" class="btn btn-sm btn-ghost" rel="noopener noreferrer" target="_blank">GitHub</a>
          <a href="/docs" class="btn btn-sm btn-ghost">Docs</a>
        </nav>
      </div>
      <div class="navbar-end flex items-center gap-2">
        <div class="join hidden md:inline-flex">
          <button class="btn btn-xs btn-ghost join-item {currentTheme === 'auto' ? 'btn-active' : ''}" on:click={() => selectTheme('auto')}>Auto</button>
          <button class="btn btn-xs btn-ghost join-item {currentTheme === 'off' ? 'btn-active' : ''}" on:click={() => selectTheme('off')}>Light</button>
          <button class="btn btn-xs btn-ghost join-item {currentTheme === 'on' ? 'btn-active' : ''}" on:click={() => selectTheme('on')}>Dark</button>
        </div>
      </div>
    </div>
  </div>
</header>

<main class="min-h-screen bg-base-100 text-base-content">
  <slot />
</main>