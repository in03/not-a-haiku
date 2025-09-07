<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.js';
  import { exchangeCodeForToken, getGitHubUser } from '$lib/auth/github.js';
  
  let status = 'processing'; // 'processing', 'success', 'error'
  let message = 'Completing GitHub authentication...';
  /** @type {string | null} */
  let error = null;
  
  onMount(async () => {
    try {
      // Get code and state from URL parameters
      const code = $page.url.searchParams.get('code');
      const state = $page.url.searchParams.get('state');
      const errorParam = $page.url.searchParams.get('error');
      
      // Check for OAuth errors
      if (errorParam) {
        throw new Error(`GitHub OAuth error: ${errorParam}`);
      }
      
      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }
      
      authStore.setLoading(true);
      
      // Exchange code for token
      message = 'Exchanging authorization code...';
      const tokenResult = /** @type {any} */ (await exchangeCodeForToken(code, state));
      
      if (tokenResult.error) {
        throw new Error(tokenResult.error);
      }
      
      if (!tokenResult.access_token || !tokenResult.user) {
        throw new Error('Invalid token exchange response');
      }
      
      // Store authentication data
      authStore.setUser(tokenResult.access_token, tokenResult.user);
      
      status = 'success';
      message = `Welcome, ${tokenResult.user.name || tokenResult.user.login}!`;
      
      // Redirect to home page after success
      setTimeout(() => {
        goto('/', { replaceState: true });
      }, 2000);
      
    } catch (err) {
      console.error('OAuth callback error:', err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      status = 'error';
      error = errorObj.message;
      message = 'Authentication failed';
      authStore.setError(errorObj.message);
      
      // Redirect to home page after error
      setTimeout(() => {
        goto('/', { replaceState: true });
      }, 3000);
    }
  });
</script>

<svelte:head>
  <title>GitHub Authentication - Haiku Studio</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-100">
  <div class="max-w-md w-full mx-4">
    <div class="bg-base-200 rounded-xl shadow-lg p-8 text-center border border-base-300">
      <!-- Loading spinner or status icon -->
      <div class="mb-6">
        {#if status === 'processing'}
          <div class="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        {:else if status === 'success'}
          <div class="inline-flex items-center justify-center w-16 h-16 bg-success/20 rounded-full mb-4">
            <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        {:else}
          <div class="inline-flex items-center justify-center w-16 h-16 bg-error/20 rounded-full mb-4">
            <svg class="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        {/if}
      </div>
      
      <!-- Status message -->
      <h1 class="text-2xl font-bold text-base-content mb-2">
        {#if status === 'processing'}
          Authenticating...
        {:else if status === 'success'}
          Success!
        {:else}
          Authentication Failed
        {/if}
      </h1>
      
      <p class="text-base-content/70 mb-4">{message}</p>
      
      {#if error}
        <div class="bg-error/10 border border-error/30 rounded-lg p-4 mb-4">
          <p class="text-sm text-error">{/** @type {string} */ (error)}</p>
        </div>
      {/if}
      
      <!-- Progress or action -->
      {#if status === 'processing'}
        <div class="text-sm text-base-content/60">
          Please wait while we complete your authentication...
        </div>
      {:else if status === 'success'}
        <div class="text-sm text-base-content/60">
          Redirecting you back to the app...
        </div>
      {:else}
        <div class="text-sm text-base-content/60">
          You'll be redirected back to the app shortly.
        </div>
        <button 
          class="mt-4 btn btn-primary"
          on:click={() => goto('/')}
        >
          Return to App
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Ensure the page takes full height */
  :global(html, body) {
    height: 100%;
  }
</style>
