<script>
  import Settings from '$lib/components/Settings.svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { base } from '$app/paths';
  import { ArrowLeft } from 'lucide-svelte';

  /** @type {import('$lib/stores/settings.js').defaultSettings} */
  let settings;
  const unsubscribe = settingsStore.subscribe((s) => settings = { ...s });

  let saved = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let autosaveTimer = null;
  let lastSaved = JSON.stringify(settings);
  $: if (settings) {
    // Debounced autosave when settings change
    const current = JSON.stringify(settings);
    if (current !== lastSaved) {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        settingsStore.set({ ...settings });
        lastSaved = JSON.stringify(settings);
        saved = true;
        setTimeout(() => (saved = false), 1500);
      }, 250);
    }
  }

  function handleBack() { 
    history.back(); 
  }

  function handleClose() { 
    history.back(); 
  }

  // Cleanup subscription on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => unsubscribe());
</script>

<style>
  .settings-page-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 25px 50px var(--card-shadow);
    overflow: hidden;
  }
</style>

<section class="min-h-screen bg-base-100">
  <div class="container mx-auto px-4 py-6">
    <!-- Constrain content width for better readability -->
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <button class="btn btn-ghost btn-sm" on:click={handleBack} aria-label="Go back">
            <ArrowLeft class="w-4 h-4" />
          </button>
          <h1 class="text-xl font-semibold">Settings</h1>
        </div>
        {#if saved}<span class="badge badge-success badge-outline">Saved</span>{/if}
      </div>
      <div class="settings-page-card">
        <Settings isModal={false} bind:settings on:close={handleClose} />
      </div>
    </div>
  </div>
</section>
