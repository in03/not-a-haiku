<script>
  import '../app.css';
  import { Settings } from 'lucide-svelte';
  import { page } from '$app/stores';
</script>

<main class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
  <!-- Navigation -->
  {#if $page.url.pathname !== '/settings'}
    <nav class="absolute top-4 right-4 z-10">
      <a
        href="/settings"
        class="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-sm"
        title="Settings"
      >
        <Settings class="w-4 h-4" />
        Settings
      </a>
    </nav>
  {/if}
  
  <slot />
</main>