<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-svelte';
  
  export let message = '';
  export let type = 'info'; // 'success', 'error', 'warning', 'info'
  export let duration = 4000;
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let timeout;
  
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info
  };
  
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  
  const iconStyles = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500'
  };
  
  $: if (show && duration > 0) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      show = false;
      dispatch('close');
    }, duration);
  }
  
  function close() {
    clearTimeout(timeout);
    show = false;
    dispatch('close');
  }
</script>

{#if show}
  <div class="fixed top-4 right-4 z-50 animate-scale-in">
    <div class="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm {styles[type]}">
      <svelte:component this={icons[type]} class="w-5 h-5 {iconStyles[type]}" />
      <span class="font-medium">{message}</span>
      <button
        on:click={close}
        class="ml-2 p-1 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Close"
      >
        <XCircle class="w-4 h-4" />
      </button>
    </div>
  </div>
{/if}