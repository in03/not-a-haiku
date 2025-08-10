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
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };
  
  const iconStyles = {
    success: 'text-success',
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-info'
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
  <div class="toast toast-top toast-end z-50 animate-scale-in">
    <div class="alert shadow-lg {styles[type]}">
      <div class="flex items-center gap-3">
        <svelte:component this={icons[type]} class="w-5 h-5 {iconStyles[type]}" />
        <span class="font-medium">{message}</span>
      </div>
      <div>
        <button
          on:click={close}
          class="btn btn-ghost btn-xs"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}