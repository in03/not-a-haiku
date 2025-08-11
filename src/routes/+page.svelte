<script>
  import { Sparkles, Leaf } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import UnifiedHaikuInput from '$lib/components/UnifiedHaikuInput.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { poemTypes } from '$lib/poemTypes.js';
  import confetti from 'canvas-confetti';
  
  let title = '';
  let content = '';
  let validation = { isValid: false, isComplete: false, feedback: '' };
  /** @type {number[]} */
  let syllableCounts = [];
  /** @type {number[]} */
  let expectedSyllables = [];
  let showToast = false;
  let toastMessage = '';
  let toastType = 'info';
  let celebrationIndex = 0;
  /** @type {any} */
  let unifiedInputComponent;
  
  const celebrationMessages = [
    "Well done",
    "You're a natural", 
    "Such poem, much wow",
    "You're a poem writer"
  ];

  /** @param {string} word */
  const articleFor = (word) => {
    if (!word) return 'a';
    return /^(a|e|i|o|u)/i.test(word) ? 'an' : 'a';
  };
  /** @type {any} */
  const poemTypesDict = /** @type {any} */ (poemTypes);
  $: poemTypeKey = /** @type {keyof typeof poemTypes} */ ($settingsStore?.poemType || 'haiku');
  $: currentPoemType = poemTypesDict[poemTypeKey] || poemTypes.haiku;
  $: poemName = currentPoemType.name;
  $: poemNameLower = poemName.toLowerCase();
  $: poemArticle = articleFor(poemNameLower);
  
  /** @param {CustomEvent<{ isValid: boolean, isComplete: boolean, feedback: string }>} event */
  function handleValidation(event) {
    const previousValid = validation.isValid;
    validation = event.detail;
    
    // Cycle celebration message when haiku becomes valid
    if (validation.isValid && !previousValid) {
      celebrationIndex = (celebrationIndex + 1) % celebrationMessages.length;
    }
  }

  /** @param {CustomEvent<{ counts: number[], expected: number[] }>} event */
  function handleSyllables(event) {
    syllableCounts = event.detail.counts || [];
    expectedSyllables = event.detail.expected || [];
  }
  
  function submitHaiku() {
    if (validation.isComplete) {
      // Launch epic confetti celebration!
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      /** @param {number} min @param {number} max */
      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // since particles fall down, start a bit higher than random
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }, 250);
      
      // Show success toast
      showToast = true;
      toastMessage = `✨ "${title}" submitted successfully! Your ${poemNameLower} is beautiful.`;
      toastType = 'success';
      
      // Reset after success
      setTimeout(() => {
        if (unifiedInputComponent) {
          unifiedInputComponent.reset();
        }
        title = '';
        content = '';
        validation = { isValid: false, isComplete: false, feedback: '' };
      }, 3000);
    }
  }
  
  /** @param {CustomEvent<{ message: string, type: 'success'|'error'|'warning'|'info' }>} event */
  function handleToast(event) {
    showToast = true;
    toastMessage = event.detail.message;
    toastType = event.detail.type;
  }
</script>

<svelte:head>
  <title>Haiku Studio - Interactive poem assistant</title>
  <meta name="description" content={`Write beautiful ${poemNameLower} with real-time syllable counting`} />
</svelte:head>

<div class="container mx-auto px-4 py-8 min-h-screen">
  <!-- Header copy -->
  <div class="text-center mb-8 animate-fade-in">
    <div class="flex items-center justify-center gap-3 mb-3">
      <h1 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r {validation.isValid ? 'from-green-400 to-emerald-500' : 'from-sky-400 to-blue-500'} bg-clip-text text-transparent transition-all duration-500">
        {validation.isValid ? `It's ${poemArticle} ${poemName}!` : `Not ${poemArticle} ${poemName}`}
      </h1>
      {#if validation.isValid}
        <Sparkles class="w-7 h-7 sm:w-8 sm:h-8 text-success" />
      {:else}
        <Leaf class="w-7 h-7 sm:w-8 sm:h-8 text-error" />
      {/if}
    </div>
    <div class="relative min-h-[44px] py-1 overflow-visible">
      {#if !(content && expectedSyllables.length)}
        <div class="absolute inset-0 flex items-center justify-center gap-2 text-xs"
          in:fade={{ duration: 500, easing: cubicOut }}
          out:fly={{ x: -20, duration: 400, easing: cubicOut }}
        >
          <div class="badge badge-ghost">calm</div>
          <div class="badge badge-ghost">minimal</div>
          <div class="badge badge-ghost">zen</div>
        </div>
      {/if}

      {#if content && expectedSyllables.length && !validation.isComplete}
        <div class="absolute inset-0 flex items-center justify-center gap-2 text-xs"
          in:fly={{ x: 20, duration: 500, easing: cubicOut }}
        >
          {#each expectedSyllables as expected, index}
            <div class="syllable-indicator {syllableCounts[index] > expected ? 'syllable-over' : syllableCounts[index] === expected ? 'syllable-perfect' : 'syllable-under'}">
              {#if syllableCounts[index] !== undefined}
                {syllableCounts[index]}/{expected}
              {:else}
                0/{expected}
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if content && expectedSyllables.length && validation.isComplete}
        <div class="absolute inset-0 flex items-center justify-center"
          in:fly={{ x: 20, duration: 400, easing: cubicOut }}
        >
          <button class="btn btn-sm btn-primary" on:click={submitHaiku}>Submit {poemNameLower}</button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Simplified Unified Input -->
  <div class="mx-auto max-w-3xl">
    <UnifiedHaikuInput
      bind:this={unifiedInputComponent}
      bind:title
      bind:content
      on:validation={handleValidation}
      on:syllables={handleSyllables}
      on:toast={handleToast}
    />

    <!-- Features row -->
    <div class="mt-6 flex items-center justify-center gap-2 text-xs flex-wrap">
      <div class="badge badge-outline">Auto line breaks</div>
      <div class="badge badge-outline">Real-time validation</div>
      <div class="badge badge-outline">Works offline</div>
    </div>
  </div>
</div>

<!-- Toast Notifications -->
<Toast
  bind:show={showToast}
  message={toastMessage}
  type={toastType}
  on:close={() => showToast = false}
/>

<style>
  .animate-fade-in { animation: fadeIn 0.6s ease-out; }

  .syllable-indicator {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 9999px;
  }
  
  .syllable-perfect {
    color: #15803d;
    background: color-mix(in srgb, #10b981 15%, transparent);
    border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  }
  
  .syllable-over {
    color: #dc2626;
    background: color-mix(in srgb, #ef4444 15%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  }
  
  .syllable-under {
    color: #1d4ed8;
    background: color-mix(in srgb, #3b82f6 12%, transparent);
    border: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
</style>