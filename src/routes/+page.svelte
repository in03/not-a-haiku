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
        <CheckCircle class="w-8 h-8 text-green-600" />
      {:else}
        <XCircle class="w-8 h-8 text-red-600" />
      {/if}
      <h1 class="text-4xl font-bold bg-gradient-to-r {validation.isValid ? 'from-green-600 to-emerald-600' : 'from-red-600 to-pink-600'} bg-clip-text text-transparent transition-all duration-500">
        {validation.isValid ? 'It\'s a Haiku!' : 'Not a Haiku'}
      </h1>
      {#if validation.isValid}
        <Sparkles class="w-8 h-8 text-green-600" />
      {:else}
        <Leaf class="w-8 h-8 text-red-600" />
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
            class="w-full p-4 text-lg text-center border-2 border-green-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors bg-white/80"
            autocomplete="off"
            autofocus
          />
          
          {#if title.trim()}
            <button
              on:click={startHaiku}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
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
            class="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          {#if validation.isComplete}
            <button
              on:click={submitHaiku}
              class="px-8 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <Send class="w-4 h-4" />
              Submit Haiku
            </button>
          {:else}
            <button
              disabled
              class="px-8 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed flex items-center gap-2"
            >
              <Send class="w-4 h-4" />
              Complete Your Haiku
            </button>
          {/if}
        </div>
        
        <!-- Validation Status -->
        {#if validation.feedback}
          <div class="mt-4 p-3 rounded-lg text-center text-sm {validation.isComplete ? 'bg-green-50 text-green-700' : validation.isValid ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}">
            {validation.feedback}
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
  
  .zen-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  
  .zen-textarea {
    background: rgba(255, 255, 255, 0.8);
    border: 2px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    padding: 16px;
    font-size: 16px;
    transition: all 0.3s ease;
    resize: none;
  }
  
  .zen-textarea:focus {
    outline: none;
    border-color: rgba(34, 197, 94, 0.5);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }
  
  .syllable-indicator {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
  }
  
  .syllable-perfect {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(22, 163, 74);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }
  
  .syllable-over {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(185, 28, 28);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  
  .syllable-under {
    background: rgba(245, 158, 11, 0.1);
    color: rgb(180, 83, 9);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
</style>