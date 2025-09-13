<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-svelte';
  
  export let message = '';
  export let type = 'info'; // 'success', 'error', 'warning', 'info'
  export let duration = 4000;
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeout = null;
  
  const icons = /** @type {const} */ ({
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info
  });
  
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-100',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-100',
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-100'
  };
  
  const iconStyles = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400'
  };
  
  $: if (show && duration > 0) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      show = false;
      dispatch('close');
    }, duration);
  }
  
  function close() {
    if (timeout) clearTimeout(timeout);
    show = false;
    dispatch('close');
  }
</script>

{#if show}
  <div class="fixed top-20 right-4 z-30 animate-scale-in">
    <div class="alert shadow-lg {styles[type]} bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600">
      {#if type === 'success'}
        <CheckCircle class="w-5 h-5 {iconStyles.success}" />
      {:else if type === 'error'}
        <XCircle class="w-5 h-5 {iconStyles.error}" />
      {:else if type === 'warning'}
        <AlertCircle class="w-5 h-5 {iconStyles.warning}" />
      {:else}
        <Info class="w-5 h-5 {iconStyles.info}" />
      {/if}
      <span class="font-medium">{message}</span>
      <button
        on:click={close}
        class="btn btn-sm btn-ghost ml-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        aria-label="Close"
      >
        <XCircle class="w-4 h-4" />
      </button>
    </div>
  </div>
{/if}