<script>
  import { Settings, Key, Save, Eye, EyeOff, CheckCircle, AlertCircle, TestTube } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { testConnection } from '$lib/github-models.js';

  let githubPat = '';
  let showPat = false;
  let isSaved = false;
  let showToast = false;
  let toastMessage = '';
  let toastType = 'info';
  let isValidating = false;
  let isTesting = false;

  onMount(() => {
    // Load existing PAT from localStorage if available
    const savedPat = localStorage.getItem('github_pat');
    if (savedPat) {
      githubPat = savedPat;
      isSaved = true;
    }
  });

  async function validatePat(pat) {
    if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
      return { valid: false, error: 'Invalid PAT format' };
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'User-Agent': 'Haiku-Studio'
        }
      });

      if (response.ok) {
        const user = await response.json();
        return { valid: true, user: user.login };
      } else {
        return { valid: false, error: 'Invalid PAT or insufficient permissions' };
      }
    } catch (error) {
      return { valid: false, error: 'Network error validating PAT' };
    }
  }

  async function savePat() {
    if (!githubPat.trim()) {
      showToast = true;
      toastMessage = 'Please enter a GitHub Personal Access Token';
      toastType = 'error';
      return;
    }

    isValidating = true;
    const validation = await validatePat(githubPat);
    isValidating = false;

    if (validation.valid) {
      localStorage.setItem('github_pat', githubPat);
      isSaved = true;
      showToast = true;
      toastMessage = `✅ GitHub PAT saved successfully! Authenticated as ${validation.user}`;
      toastType = 'success';
    } else {
      showToast = true;
      toastMessage = `❌ ${validation.error}`;
      toastType = 'error';
    }
  }

  function removePat() {
    localStorage.removeItem('github_pat');
    githubPat = '';
    isSaved = false;
    showToast = true;
    toastMessage = '🗑️ GitHub PAT removed successfully';
    toastType = 'info';
  }

  function toggleShowPat() {
    showPat = !showPat;
  }

  async function testGitHubConnection() {
    if (!githubPat.trim()) {
      showToast = true;
      toastMessage = 'Please enter a GitHub PAT first';
      toastType = 'error';
      return;
    }

    isTesting = true;
    const result = await testConnection();
    isTesting = false;

    if (result.success) {
      showToast = true;
      toastMessage = '✅ GitHub Models connection successful!';
      toastType = 'success';
    } else {
      showToast = true;
      toastMessage = `❌ Connection failed: ${result.error}`;
      toastType = 'error';
    }
  }
</script>

<svelte:head>
  <title>Settings - Haiku Studio</title>
  <meta name="description" content="Configure your GitHub settings for enhanced haiku analysis" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <!-- Header -->
  <div class="text-center mb-8">
    <div class="flex items-center justify-center gap-3 mb-4">
      <Settings class="w-8 h-8 text-blue-600" />
      <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        Settings
      </h1>
    </div>
    <p class="text-gray-600">Configure your preferences for enhanced haiku analysis</p>
  </div>

  <!-- GitHub PAT Section -->
  <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
    <div class="flex items-center gap-3 mb-4">
      <Key class="w-6 h-6 text-gray-700" />
      <h2 class="text-xl font-semibold text-gray-800">GitHub Personal Access Token</h2>
      {#if isSaved}
        <CheckCircle class="w-5 h-5 text-green-600" />
      {/if}
    </div>
    
    <p class="text-gray-600 mb-4">
      Connect your GitHub account to enable advanced AI-powered haiku analysis using GitHub Models.
      Your token is stored securely in your browser and never sent to our servers.
    </p>

    <div class="mb-4">
      <label for="github-pat" class="block text-sm font-medium text-gray-700 mb-2">
        Personal Access Token
      </label>
      <div class="relative">
        <input
          id="github-pat"
          type={showPat ? 'text' : 'password'}
          bind:value={githubPat}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          class="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          class:border-green-500={isSaved}
          class:bg-green-50={isSaved}
        />
        <button
          type="button"
          on:click={toggleShowPat}
          class="absolute inset-y-0 right-12 flex items-center px-2 text-gray-500 hover:text-gray-700"
        >
          {#if showPat}
            <EyeOff class="w-5 h-5" />
          {:else}
            <Eye class="w-5 h-5" />
          {/if}
        </button>
        {#if isSaved}
          <CheckCircle class="absolute inset-y-0 right-3 flex items-center w-5 h-5 text-green-600" />
        {/if}
      </div>
    </div>

    <div class="flex gap-3">
      <button
        on:click={savePat}
        disabled={isValidating}
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {#if isValidating}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Validating...
        {:else}
          <Save class="w-4 h-4" />
          Save Token
        {/if}
      </button>
      
      {#if isSaved}
        <button
          on:click={testGitHubConnection}
          disabled={isTesting}
          class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {#if isTesting}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Testing...
          {:else}
            <TestTube class="w-4 h-4" />
            Test Connection
          {/if}
        </button>
        
        <button
          on:click={removePat}
          class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
        >
          Remove Token
        </button>
      {/if}
    </div>

    <!-- Instructions -->
    <div class="mt-6 p-4 bg-blue-50 rounded-lg">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div class="text-sm text-blue-800">
          <p class="font-medium mb-2">How to create a GitHub Personal Access Token:</p>
          <ol class="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <a href="https://github.com/settings/tokens" target="_blank" class="underline hover:text-blue-900">GitHub Settings → Developer settings → Personal access tokens</a></li>
            <li>Click "Generate new token (classic)"</li>
            <li>Give it a descriptive name like "Haiku Studio"</li>
            <li>No specific scopes are required for the AI models</li>
            <li>Copy the token and paste it above</li>
          </ol>
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation -->
  <div class="text-center">
    <a
      href="/"
      class="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
    >
      ← Back to Haiku Studio
    </a>
  </div>
</div>

{#if showToast}
  <Toast message={toastMessage} type={toastType} bind:show={showToast} />
{/if}