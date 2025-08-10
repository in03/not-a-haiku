<script>
  import { Sparkles, Leaf, Send, XCircle, CheckCircle } from 'lucide-svelte';
  import HaikuEditor from '$lib/components/HaikuEditor.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import confetti from 'canvas-confetti';
  
  let step = 'title'; // 'title', 'content', 'complete'
  let title = '';
  let content = '';
  let validation = { isValid: false, isComplete: false, feedback: '' };
  let showToast = false;
  let toastMessage = '';
  let toastType = 'info';
  let celebrationIndex = 0;
  
  const celebrationMessages = [
    "Well done",
    "You're a natural", 
    "Such poem, much wow",
    "You're a poem writer"
  ];
  
  function startHaiku() {
    if (title.trim()) {
      step = 'content';
    }
  }
  
  /** @param {CustomEvent<{ isValid: boolean, isComplete: boolean, feedback: string }>} event */
  function handleValidation(event) {
    const previousValid = validation.isValid;
    validation = event.detail;
    
    // Cycle celebration message when haiku becomes valid
    if (validation.isValid && !previousValid) {
      celebrationIndex = (celebrationIndex + 1) % celebrationMessages.length;
    }
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
      toastMessage = `✨ "${title}" submitted successfully! Your haiku is beautiful.`;
      toastType = 'success';
      
      // Reset after success
      setTimeout(() => {
        step = 'title';
        title = '';
        content = '';
        validation = { isValid: false, isComplete: false, feedback: '' };
      }, 3000);
    }
  }
  
  function cancelHaiku() {
    step = 'title';
    title = '';
    content = '';
    validation = { isValid: false, isComplete: false, feedback: '' };
  }
  
  /** @param {KeyboardEvent} event */
  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      startHaiku();
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
  <meta name="description" content="Write beautiful haiku with real-time syllable counting" />
</svelte:head>

<div class="container mx-auto px-4 py-8 min-h-screen">
  <!-- Header copy -->
  <div class="text-center mb-8 animate-fade-in">
    <div class="flex items-center justify-center gap-3 mb-3">
      <h1 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r {validation.isValid ? 'from-green-600 to-emerald-600' : 'from-primary to-secondary'} bg-clip-text text-transparent transition-all duration-500">
        {validation.isValid ? 'It\'s a Haiku!' : 'Not a Haiku'}
      </h1>
      {#if validation.isValid}
        <Sparkles class="w-7 h-7 sm:w-8 sm:h-8 text-success" />
      {:else}
        <Leaf class="w-7 h-7 sm:w-8 sm:h-8 text-error" />
      {/if}
    </div>
    <div class="flex items-center justify-center gap-2">
      {#if validation.isValid}
        <div class="badge badge-success badge-outline">balanced</div>
      {/if}
      <div class="badge badge-ghost">calm</div>
      <div class="badge badge-ghost">minimal</div>
      <div class="badge badge-ghost">zen</div>
    </div>
  </div>

  <!-- Unified Card: title → editor -->
  <div class="mx-auto max-w-3xl">
    <div class="card bg-base-100 shadow-lg rounded-2xl animate-scale-in">
      <div class="card-body p-6 sm:p-8">
        {#if step === 'title'}
          <div class="text-center mb-6">
            <h2 class="text-2xl font-semibold mb-3 text-base-content">Haiku title</h2>
            <p class="text-sm opacity-70">Press Enter to continue</p>
          </div>

          <div class="relative">
            <input
              bind:value={title}
              on:keydown={handleTitleKeydown}
              placeholder="Enter your haiku title..."
              class="input input-bordered input-lg rounded-xl w-full text-center"
              autocomplete="off"
            />
            {#if title.trim()}
              <button
                on:click={startHaiku}
                class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-primary"
                aria-label="Start writing haiku"
              >
                <Sparkles class="w-5 h-5" />
              </button>
            {/if}
          </div>
        {:else if step === 'content'}
          <HaikuEditor
            bind:content
            {title}
            {validation}
            on:validation={handleValidation}
            on:toast={handleToast}
            on:cancel={cancelHaiku}
            on:complete={submitHaiku}
            placeholder="The pen is mightier than the sword"
          />
        {/if}
      </div>
    </div>

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
  .animate-fade-in {
    animation: fadeIn 0.6s ease-out;
  }
  
  .animate-scale-in {
    animation: scaleIn 0.4s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  

  
  /* Styling for text area and indicators now lives in app-wide CSS variables and classes */
  
  /* .animate-shake removed; using global animation classes */
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
</style>