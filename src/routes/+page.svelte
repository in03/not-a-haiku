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
  
  function handleValidation(event) {
    const previousValid = validation.isValid;
    validation = event.detail;
    console.log('Validation update:', validation);
    
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
  
  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      startHaiku();
    }
  }
</script>

<svelte:head>
  <title>Haiku Studio - Client-Side Syllable Validation</title>
  <meta name="description" content="Write beautiful haiku with real-time syllable counting" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="text-center mb-12 animate-fade-in">
    <div class="flex items-center justify-center gap-3 mb-4">
      {#if validation.isValid}
        <CheckCircle class="w-8 h-8 text-success" />
      {:else}
        <XCircle class="w-8 h-8 text-error" />
      {/if}
      <h1 class="text-4xl font-bold bg-gradient-to-r {validation.isValid ? 'from-green-600 to-emerald-600' : 'from-red-600 to-pink-600'} bg-clip-text text-transparent transition-all duration-500">
        {validation.isValid ? 'It\'s a Haiku!' : 'Not a Haiku'}
      </h1>
      {#if validation.isValid}
        <Sparkles class="w-8 h-8 text-success" />
      {:else}
        <Leaf class="w-8 h-8 text-error" />
      {/if}
    </div>
    <p class="text-gray-600 text-lg transition-all duration-500">
      {validation.isValid ? celebrationMessages[celebrationIndex] : 'We\'ll be the judge...'}
    </p>
    <div class="text-sm text-gray-500 mt-2">
      🚀 Client-side ML • 📖 CMU Dictionary • ⚡ Instant feedback
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="max-w-2xl mx-auto">
    {#if step === 'title'}
      <!-- Title Input Step -->
      <div class="zen-card p-8 animate-scale-in">
        <div class="text-center mb-6">
          <h2 class="text-2xl font-semibold text-gray-800 mb-2">
            What shall we call your haiku?
          </h2>
          <p class="text-gray-600">
            Give your poem a title, then press Enter to begin
          </p>
        </div>
        
        <div class="relative">
          <input
            bind:value={title}
            on:keydown={handleTitleKeydown}
            placeholder="Enter your haiku title..."
            class="input input-bordered w-full text-center text-lg bg-white/80"
            autocomplete="off"
            autofocus
          />
          
          {#if title.trim()}
            <button
              on:click={startHaiku}
              class="btn btn-success btn-sm absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="Start writing haiku"
            >
              <Sparkles class="w-5 h-5" />
            </button>
          {/if}
        </div>
      </div>
      
    {:else if step === 'content'}
      <!-- Haiku Editor Step -->
      <div class="zen-card p-8 animate-scale-in">
        <div class="text-center mb-6">
          <h2 class="text-xl font-semibold text-gray-800 mb-1">
            "{title}"
          </h2>
          <p class="text-gray-600 text-sm">
            {validation.feedback || 'Write your 5-7-5 syllable haiku...'}
          </p>
        </div>
        
        <HaikuEditor
          bind:content
          on:validation={handleValidation}
          placeholder="The pen is mightier than the sword"
        />
        
        <!-- Action Buttons -->
        <div class="flex gap-3 mt-6 justify-center">
          <button
            on:click={cancelHaiku}
            class="btn btn-ghost"
          >
            Cancel
          </button>
          
          {#if validation.isComplete}
            <button
              on:click={submitHaiku}
              class="btn btn-primary"
            >
              <Send class="w-4 h-4" />
              Submit Haiku
            </button>
          {:else}
            <button
              disabled
              class="btn btn-disabled"
            >
              <Send class="w-4 h-4" />
              Complete Your Haiku
            </button>
          {/if}
        </div>
        
        <!-- Validation Status -->
        {#if validation.feedback}
          <div class="alert mt-4 {validation.isComplete ? 'alert-success' : validation.isValid ? 'alert-info' : 'alert-warning'}">
            <span>{validation.feedback}</span>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Instructions -->
    <div class="mt-8 text-center text-sm text-gray-500">
      <p class="mb-2">
        <strong>How it works:</strong> Type naturally and watch the syllable magic happen!
      </p>
      <p>
        ✨ Auto line breaks • 🔄 Real-time validation • 📱 Works offline
      </p>
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
</style>