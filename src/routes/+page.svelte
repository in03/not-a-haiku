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
  
  // no decorative leaves
  
  /** @param {CustomEvent<{ isValid: boolean, isComplete: boolean, feedback: string }>} event */
  function handleValidation(event) {
    const previousValid = validation.isValid;
    validation = event.detail;
    
    // Cycle celebration message when haiku becomes valid
    if (!previousValid && validation.isValid) {
      celebrationIndex = (celebrationIndex + 1) % celebrationMessages.length;
    }
  }
  
  /** @param {CustomEvent<{ counts: number[], expected: number[] }>} event */
  function handleSyllables(event) {
    syllableCounts = event.detail.counts;
    expectedSyllables = event.detail.expected;
  }
  
  /** @param {CustomEvent<any>} event */
  async function handleSubmit(event) {
    if (event.detail.isComplete) {
      // Show success message
      showToast = true;
      toastMessage = celebrationMessages[celebrationIndex];
      toastType = 'success';
      
      // Trigger confetti if enabled
      if ($settingsStore.enableConfetti) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      
      // Reset after delay
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
  <title>Not a Haiku - Haiku assistance and stuff</title>
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
          <div class="badge badge-ghost">calm 🌿</div>
          <div class="badge badge-ghost">minimal 🌱</div>
          <div class="badge badge-ghost">zen 🌵</div>
        </div>
      {/if}

      {#if content && expectedSyllables.length && !validation.isComplete}
        <div class="absolute inset-0 flex items-center justify-center gap-2 text-xs"
          in:fade={{ duration: 500, easing: cubicOut }}
          out:fly={{ x: 20, duration: 400, easing: cubicOut }}
        >
          {#each expectedSyllables as expected, index}
            <div class="badge {syllableCounts[index] > expected ? 'badge-error' : syllableCounts[index] === expected ? 'badge-success' : 'badge-ghost'}">
              {syllableCounts[index] || 0}/{expected}
            </div>
          {/each}
        </div>
      {/if}
      
      {#if validation.isComplete}
        <div class="absolute inset-0 flex items-center justify-center text-xs"
          in:fade={{ duration: 500, easing: cubicOut }}
          out:fly={{ x: 20, duration: 400, easing: cubicOut }}
        >
          <div class="badge badge-success">{celebrationMessages[celebrationIndex]} ✨</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Simplified Unified Input -->
  <div class="mx-auto max-w-3xl relative">
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
      <div class="badge badge-outline">Auto line breaks ⛓️</div>
      <div class="badge badge-outline">Real-time validation 🔄</div>
      <div class="badge badge-outline">Works offline 📴</div>
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
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fade-in 0.8s ease-out;
  }
  
  /* removed decorative leaves */
</style>