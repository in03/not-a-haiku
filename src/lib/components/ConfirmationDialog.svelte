<script>
  import { createEventDispatcher } from 'svelte';
  import { X, AlertTriangle, CheckCircle } from 'lucide-svelte';

  export let isOpen = false;
  export let title = 'Confirm Action';
  export let message = 'Are you sure you want to proceed?';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let type = 'warning'; // 'warning' or 'danger'
  export let confirmButtonClass = '';

  const dispatch = createEventDispatcher();

  function handleConfirm() {
    dispatch('confirm');
    isOpen = false;
  }

  function handleCancel() {
    dispatch('cancel');
    isOpen = false;
  }

  function handleKeydown(event) {
    if (!isOpen) return;
    
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter') {
      handleConfirm();
    }
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div class="confirmation-overlay" on:click={handleOverlayClick} role="dialog" aria-modal="true" tabindex="-1">
    <div class="confirmation-modal">
      <div class="confirmation-header">
        <div class="confirmation-icon">
          {#if type === 'danger'}
            <AlertTriangle size="24" />
          {:else}
            <CheckCircle size="24" />
          {/if}
        </div>
        <h3 class="confirmation-title">{title}</h3>
        <button class="confirmation-close" on:click={handleCancel} title="Close">
          <X size="20" />
        </button>
      </div>
      
      <div class="confirmation-content">
        <p class="confirmation-message">{message}</p>
      </div>
      
      <div class="confirmation-actions">
        <button class="confirmation-button cancel" on:click={handleCancel}>
          {cancelText}
        </button>
        <button 
          class="confirmation-button confirm {confirmButtonClass}" 
          class:danger={type === 'danger'}
          class:primary={type === 'warning'}
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirmation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
  }

  .confirmation-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 400px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    animation: scale-in 0.2s ease-out;
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .confirmation-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .confirmation-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--bg-secondary);
    flex-shrink: 0;
  }

  .confirmation-icon :global(svg) {
    color: var(--text-secondary);
  }

  .confirmation-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    flex: 1;
  }

  .confirmation-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .confirmation-close:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .confirmation-content {
    padding: 16px 20px 20px;
  }

  .confirmation-message {
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
    font-size: 14px;
  }

  .confirmation-actions {
    display: flex;
    gap: 12px;
    padding: 16px 20px 20px;
    justify-content: flex-end;
  }

  .confirmation-button {
    padding: 10px 20px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
  }

  .confirmation-button.cancel {
    background: var(--bg-primary);
    color: var(--text-secondary);
  }

  .confirmation-button.cancel:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .confirmation-button.primary {
    background: var(--border-focus);
    border-color: var(--border-focus);
    color: white;
  }

  .confirmation-button.primary:hover {
    background: color-mix(in srgb, var(--border-focus) 90%, black);
  }

  .confirmation-button.danger {
    background: #ef4444;
    border-color: #ef4444;
    color: white;
  }

  .confirmation-button.danger:hover {
    background: #dc2626;
    border-color: #dc2626;
  }

  @media (max-width: 480px) {
    .confirmation-modal {
      margin: 10px;
      max-width: none;
    }
    
    .confirmation-actions {
      flex-direction: column-reverse;
    }
    
    .confirmation-button {
      width: 100%;
    }
  }
</style>
