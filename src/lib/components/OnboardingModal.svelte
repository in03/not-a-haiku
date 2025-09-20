<script>
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth.js';
  import { Github, X, Sparkles, Brain, Cloud, CheckCircle } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  export let isOpen = false;

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  function handleGitHubSignIn() {
    // Redirect to OAuth endpoint
    window.location.href = '/api/auth/github';
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="onboarding-overlay" role="button" tabindex="0" on:click={handleClose} on:keydown={handleKeydown}>
    <div class="onboarding-modal" role="dialog" aria-modal="true" tabindex="0" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && handleClose()}>
      <!-- Close button -->
      <button class="close-button" on:click={handleClose} aria-label="Close welcome modal">
        <X class="w-5 h-5" />
      </button>

      <!-- Header -->
      <div class="header">
        <div class="icon-wrapper">
          <span class="app-icon">🍃</span>
        </div>
        <h2 class="title">What's all this then?</h2>
        <p class="subtitle"><strong><u>Save your notes as haikus!</u></strong> Syllable constrained micro-journalling meets task management for arguably minimal productivity benefit.</p>
      </div>

      <!-- Features -->
      <div class="features">
        <div class="feature-item">
          <div class="feature-icon">
            <CheckCircle class="w-5 h-5 text-green-500" />
          </div>
          <div class="feature-content">
            <h3>Real-time Validation</h3>
            <p>Fast syllable counting with ML.</p>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <Sparkles class="w-5 h-5 text-purple-500" />
          </div>
          <div class="feature-content">
            <h3>Multiple Poem Types</h3>
            <p>Haiku, Tanka, Cinquain, Nonet, etc.</p>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <Brain class="w-5 h-5 text-blue-500" />
          </div>
          <div class="feature-content">
            <h3>AI Analysis with GitHub Models</h3>
            <p>Automatically rate, critique and categorize your poems.</p>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">
            <Cloud class="w-5 h-5 text-indigo-500" />
          </div>
          <div class="feature-content">
            <h3>Sync across devices</h3>
            <p>Private, free sync using GitHub Gist.</p>
          </div>
        </div>
      </div>

      <!-- GitHub CTA -->
      <div class="github-cta">        
        <button 
          type="button"
          class="github-signin-button"
          on:click={handleGitHubSignIn}
          disabled={$authStore.isLoading}
        >
          {#if $authStore.isLoading}
            <div class="github-signin-spinner"></div>
            <span>Connecting...</span>
          {:else}
            <Github class="w-5 h-5" />
            <span>Sign in with GitHub</span>
          {/if}
        </button>
        
        {#if $authStore.error}
          <div class="github-error-message">
            {$authStore.error}
          </div>
        {/if}
      </div>

      <!-- Skip option -->
      <div class="skip-section">
        <button class="skip-button" on:click={handleClose}>
          Skip the Github Goodies for now
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    backdrop-filter: blur(8px);
    padding: 20px;
    box-sizing: border-box;
  }

  .onboarding-modal {
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px var(--card-shadow);
    max-width: 500px;
    width: 100%;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    position: relative;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    color: var(--text-secondary);
    transition: all 0.2s;
    z-index: 1;
  }

  .close-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .header {
    text-align: center;
    padding: 20px 32px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .icon-wrapper {
    margin-bottom: 8px;
  }

  .app-icon {
    font-size: 40px;
    display: inline-block;
    animation: leafFloat 3s ease-in-out infinite;
  }

  @keyframes leafFloat {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(2deg); }
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px 0;
    background: linear-gradient(135deg, #10b981, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .features {
    padding: 16px 32px;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .feature-item:last-child {
    margin-bottom: 0;
  }

  .feature-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--bg-secondary);
    margin-top: 2px;
  }

  .feature-content h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 4px 0;
  }

  .feature-content p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }


  .github-cta {
    padding: 16px 32px;
  }

  .cta-content {
    text-align: center;
    margin-bottom: 12px;
  }

  .cta-content h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .cta-content p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
    line-height: 1.5;
  }

  .benefits {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    text-align: left;
  }

  .benefits li {
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding: 4px 0;
  }

  .github-signin-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 20px;
    background: #2563eb;
    color: white;
    border: 2px solid #1d4ed8;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }

  .github-signin-button:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1e40af;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
    transform: translateY(-1px);
  }

  .github-signin-button:disabled {
    opacity: 0.8;
    cursor: not-allowed;
    transform: none;
  }

  .github-signin-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .github-error-message {
    padding: 8px 12px;
    background: color-mix(in srgb, #ef4444 10%, var(--bg-primary));
    border: 1px solid color-mix(in srgb, #ef4444 30%, var(--border-color));
    border-radius: 8px;
    color: #ef4444;
    font-size: 0.8rem;
    text-align: center;
  }

  .skip-section {
    padding: 8px 32px 16px;
    text-align: center;
    border-top: 1px solid var(--border-color);
  }

  .skip-button {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .skip-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  /* Mobile responsiveness */
  @media (max-width: 600px) {
    .onboarding-modal {
      margin: 0 16px;
      max-width: none;
    }

    .header {
      padding: 24px 20px 20px;
    }

    .features {
      padding: 20px;
    }

    .github-cta {
      padding: 20px;
    }

    .skip-section {
      padding: 12px 20px 20px;
    }

    .benefits {
      grid-template-columns: 1fr;
    }

    .title {
      font-size: 1.5rem;
    }
  }
</style>
