<script>
  import { createEventDispatcher } from 'svelte';
  import { AlertTriangle, ExternalLink } from 'lucide-svelte';
  
  const dispatch = createEventDispatcher();
  
  export let isOpen = false;
  /** @type {Error | null} */
  export let error = null;
  
  function handleClose() {
    // Modal is undismissable - do nothing
    // dispatch('close');
  }
  
  function handleCreateIssue() {
    // Open GitHub issues page
    window.open('https://github.com/your-username/not-a-haiku/issues/new', '_blank');
  }
  
  function handleCopyError() {
    if (error) {
      navigator.clipboard.writeText(JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }, null, 2));
    }
  }
</script>

{#if isOpen}
  <div class="model-error-overlay" role="dialog" aria-modal="true" tabindex="0">
    <div class="model-error-modal" role="dialog" aria-modal="true" tabindex="0" on:click|stopPropagation>
      <div class="model-error-content">
        <div class="error-icon">
          <AlertTriangle class="w-12 h-12 text-red-500" />
        </div>
        
        <h2 class="error-title">Oops! Neural Model Failed to Load</h2>
        
        <p class="error-description">
          The neural model failed to load and the app cannot function without it. This is likely due to a deployment issue or network problem. Please report this issue to help us fix it.
        </p>
        
        <div class="error-actions">
          <button 
            class="btn btn-primary" 
            on:click={handleCreateIssue}
          >
            <ExternalLink class="w-4 h-4" />
            Create Issue
          </button>
          
          <button 
            class="btn btn-ghost" 
            on:click={handleCopyError}
          >
            Copy Error Info
          </button>
        </div>
        
        <div class="error-help">
          <p class="text-sm text-gray-600">
            Please check your browser's developer console for more details and share the error information when creating an issue.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .model-error-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    backdrop-filter: blur(6px);
    padding: 20px;
    box-sizing: border-box;
  }
  
  .model-error-modal {
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px var(--card-shadow);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }
  
  .model-error-content {
    padding: 32px;
    text-align: center;
  }
  
  .error-icon {
    margin-bottom: 24px;
  }
  
  .error-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }
  
  .error-description {
    color: var(--text-secondary);
    margin-bottom: 32px;
    line-height: 1.6;
  }
  
  .error-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  
  .error-help {
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
  }
  
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  
  .btn-ghost:hover {
    background: var(--bg-secondary);
  }
</style>
