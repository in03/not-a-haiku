<script>
  import Settings from '$lib/components/Settings.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { settingsStore } from '$lib/stores/settings.js';

  /** @type {import('$lib/stores/settings.js').defaultSettings} */
  let settings;
  const unsubscribe = settingsStore.subscribe((s) => settings = { ...s });

  let saved = false;
  let showToast = false;
  let toastMessage = '';
  let toastType = 'success';
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
        showToast = true;
        toastMessage = 'Settings saved';
        toastType = 'success';
        setTimeout(() => (saved = false), 1500);
      }, 250);
    }
  }

  function resetToDefaults() {
    settingsStore.reset();
    // subscription will update local settings, autosave effect will run
  }

  function handleClose() { history.back(); }

  // Cleanup subscription on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => unsubscribe());
</script>

<section class="container mx-auto px-4 py-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold">Settings</h1>
    {#if saved}<span class="badge badge-success badge-outline">Saved</span>{/if}
  </div>
  <div class="card shadow">
    <div class="card-body p-0">
      <Settings isModal={false} bind:settings on:close={handleClose} />
    </div>
    <div class="card-footer flex items-center justify-end gap-2 text-sm">
      <button class="btn btn-outline" on:click={resetToDefaults}>Reset to defaults</button>
      <a href="/" class="btn btn-primary">Done</a>
    </div>
  </div>
</section>

<Toast bind:show={showToast} message={toastMessage} type={toastType} on:close={() => (showToast = false)} />
