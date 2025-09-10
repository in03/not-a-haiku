<script>
  import { Star, Brain, Tag } from 'lucide-svelte';
  import { onMount } from 'svelte';

  /** @type {{ rating: number; comment: string; tags: string[] } | null} */
  export let analysis = null;
  export let isVisible = false;

  /** @type {boolean[]} */
  let starsAnimated = [];
  let commentVisible = false;
  let tagsVisible = false;

  // Reset animations when analysis changes
  $: if (analysis) {
    resetAnimations();
    if (isVisible) {
      startAnimations();
    }
  }

  $: if (isVisible && analysis) {
    startAnimations();
  }

  function resetAnimations() {
    starsAnimated = Array(5).fill(false);
    commentVisible = false;
    tagsVisible = false;
  }

  async function startAnimations() {
    if (!analysis) return;
    
    // Reset first
    resetAnimations();
    
    // Small delay before starting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Animate stars one by one
    for (let i = 0; i < analysis.rating; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      starsAnimated[i] = true;
      starsAnimated = [...starsAnimated]; // Trigger reactivity
    }
    
    // Show comment
    await new Promise(resolve => setTimeout(resolve, 300));
    commentVisible = true;
    
    // Show tags
    await new Promise(resolve => setTimeout(resolve, 400));
    tagsVisible = true;
  }

  /** 
   * @param {number} index
   * @param {number} rating
   */
  function getStarColor(index, rating) {
    return index < rating ? 'text-yellow-400' : 'text-gray-300';
  }

  /** 
   * @param {string} tag
   */
  function getTagColor(tag) {
    const colors = {
      'self-care': 'bg-pink-100 text-pink-800',
      'meditation': 'bg-purple-100 text-purple-800',
      'exercise': 'bg-green-100 text-green-800',
      'work': 'bg-blue-100 text-blue-800',
      'career': 'bg-blue-100 text-blue-800',
      'study': 'bg-indigo-100 text-indigo-800',
      'homework': 'bg-indigo-100 text-indigo-800',
      'chores': 'bg-orange-100 text-orange-800',
      'laundry': 'bg-cyan-100 text-cyan-800',
      'groceries': 'bg-green-100 text-green-800',
      'shopping': 'bg-green-100 text-green-800',
      'cooking': 'bg-yellow-100 text-yellow-800',
      'finance': 'bg-emerald-100 text-emerald-800',
      'taxes': 'bg-red-100 text-red-800',
      'creative': 'bg-purple-100 text-purple-800',
      'hobbies': 'bg-pink-100 text-pink-800',
      'reading': 'bg-amber-100 text-amber-800',
      'writing': 'bg-amber-100 text-amber-800',
      'travel': 'bg-sky-100 text-sky-800',
      'relationships': 'bg-rose-100 text-rose-800',
      'nonsense': 'bg-gray-100 text-gray-800',
      'trolling': 'bg-gray-100 text-gray-800',
      'poetry': 'bg-violet-100 text-violet-800'
    };
    
    return colors[/** @type {keyof typeof colors} */ (tag.toLowerCase())] || 'bg-gray-100 text-gray-800';
  }
</script>

{#if analysis && isVisible}
  <div class="bg-base-200 rounded-xl shadow-lg p-8 text-center space-y-6 border border-base-300">
    <!-- Header -->
    <div class="flex items-center justify-center gap-3 mb-6">
      <Brain class="w-6 h-6 text-primary" />
      <h2 class="text-2xl font-bold text-base-content">AI Analysis</h2>
    </div>

    <!-- Star Rating -->
    <div class="flex items-center justify-center gap-2 mb-6">
      {#each Array(5) as _, i}
        <div
          class="transition-all duration-300 ease-out {starsAnimated[i] ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}"
          style="transition-delay: {i * 150}ms"
        >
          <Star 
            class="w-8 h-8 {getStarColor(i, analysis.rating)} {i < analysis.rating ? 'fill-current' : ''} transition-colors duration-200"
          />
        </div>
      {/each}
    </div>

    <!-- Comment -->
    {#if commentVisible}
      <div class="animate-slide-up">
        <h3 class="text-xl font-bold text-base-content mb-3">Interpretation</h3>
        <p class="text-lg text-base-content/80 italic leading-relaxed max-w-md mx-auto">
          "{analysis.comment}"
        </p>
      </div>
    {/if}

    <!-- Tags -->
    {#if tagsVisible && analysis.tags.length > 0}
      <div class="animate-slide-up" style="animation-delay: 200ms">
        <h4 class="text-lg font-semibold text-base-content mb-4 flex items-center justify-center gap-2">
          <Tag class="w-5 h-5" />
          Task Categories
        </h4>
        <div class="flex flex-wrap gap-2 justify-center">
          {#each analysis.tags as tag, i}
            <span
              class="px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ease-out {getTagColor(tag)} animate-bounce-in"
              style="animation-delay: {i * 100}ms"
            >
              #{tag}
            </span>
          {/each}
        </div>
      </div>
    {/if}

  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bounce-in {
    0% {
      opacity: 0;
      transform: scale(0.5) translateY(10px);
    }
    50% {
      transform: scale(1.1) translateY(-5px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.6s ease-out forwards;
  }

  .animate-slide-up {
    animation: slide-up 0.6s ease-out forwards;
  }

  .animate-bounce-in {
    animation: bounce-in 0.6s ease-out forwards;
    opacity: 0;
  }
</style>