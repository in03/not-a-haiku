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
  /** @type {HTMLDivElement | null} */
  let syllableScrollContainer = null;
  
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
          particleCount: 150,
          spread: 80,
          startVelocity: 80,
          origin: { y: 1.2 } // Position below viewport
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
  
  // Auto-scroll to current line indicator based on cursor position
  /** @param {number} lineIndex */
  function scrollToLineIndicator(lineIndex) {
    if (!syllableScrollContainer || lineIndex < 0) return;
    
    // Find the badge element for the specified line
    const badges = syllableScrollContainer.children;
    if (badges[lineIndex]) {
      const badge = /** @type {HTMLElement} */ (badges[lineIndex]);
      const containerWidth = syllableScrollContainer.offsetWidth;
      const badgeLeft = badge.offsetLeft;
      const badgeWidth = badge.offsetWidth;
      
      // Calculate scroll position to center the current badge
      const scrollLeft = badgeLeft - (containerWidth / 2) + (badgeWidth / 2);
      
      syllableScrollContainer.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth'
      });
    }
  }
  
  // Handle cursor position changes from the input component
  /** @param {CustomEvent<{ cursorLine: number }>} event */
  function handleCursorMove(event) {
    scrollToLineIndicator(event.detail.cursorLine);
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
          in:fly={{ x: -20, duration: 400, easing: cubicOut }}
          out:fly={{ x: -20, duration: 400, easing: cubicOut }}
        >
          <div class="badge badge-ghost">calm 🌿</div>
          <div class="badge badge-ghost">minimal 🌱</div>
          <div class="badge badge-ghost">zen 🌵</div>
        </div>
      {/if}

      {#if content && expectedSyllables.length && !validation.isComplete}
        <div class="syllable-indicator-container"
          in:fly={{ x: 20, duration: 400, easing: cubicOut }}
          out:fly={{ x: 20, duration: 400, easing: cubicOut }}
        >
          <div class="syllable-indicator-scroll" bind:this={syllableScrollContainer}>
            {#each expectedSyllables as expected, index}
              <div class="badge {syllableCounts[index] > expected ? 'badge-error' : syllableCounts[index] === expected ? 'badge-success' : 'badge-ghost'}">
                {syllableCounts[index] || 0}/{expected}
              </div>
            {/each}
          </div>
          <div class="fade-left"></div>
          <div class="fade-right"></div>
        </div>
      {/if}
      
      {#if validation.isComplete}
        <div class="absolute inset-0 flex items-center justify-center text-xs"
          in:fly={{ x: 20, duration: 400, easing: cubicOut }}
          out:fly={{ x: -20, duration: 400, easing: cubicOut }}
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
      on:haikuSubmit={handleSubmit}
      on:cursorMove={handleCursorMove}
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
  
  /* Responsive syllable indicator container */
  .syllable-indicator-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  .syllable-indicator-scroll {
    display: flex;
    gap: 8px;
    align-items: center;
    text-align: center;
    font-size: 12px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 0 32px; /* Space for fade edges */
    max-width: 100%;
  }
  
  .syllable-indicator-scroll::-webkit-scrollbar {
    display: none;
  }
  
  /* Fade edges */
  .fade-left, .fade-right {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    z-index: 1;
  }
  
  .fade-left {
    left: 0;
    background: linear-gradient(to right, var(--bg-primary, #ffffff), transparent);
  }
  
  .fade-right {
    right: 0;
    background: linear-gradient(to left, var(--bg-primary, #ffffff), transparent);
  }
  
  /* Dark mode support for fade edges */
  @media (prefers-color-scheme: dark) {
    .fade-left {
      background: linear-gradient(to right, var(--bg-primary, #1f2937), transparent);
    }
    
    .fade-right {
      background: linear-gradient(to left, var(--bg-primary, #1f2937), transparent);
    }
  }
  
  /* removed decorative leaves */
</style>