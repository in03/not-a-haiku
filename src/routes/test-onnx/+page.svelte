<script>
  import { onMount } from 'svelte';
  import { initializeSyllableCounter, countSyllables, validateHaiku } from '$lib/onnx-syllable-counter.js';
  
  let isInitialized = false;
  let testResults = [];
  let isLoading = false;
  
  onMount(async () => {
    try {
      isLoading = true;
      isInitialized = await initializeSyllableCounter();
      console.log('ONNX initialization result:', isInitialized);
    } catch (error) {
      console.error('ONNX initialization failed:', error);
      isInitialized = false;
    } finally {
      isLoading = false;
    }
  });
  
  async function runTests() {
    if (!isInitialized) {
      testResults = [{ word: 'Error', expected: 'Model not initialized', actual: 'Failed' }];
      return;
    }
    
    const testWords = [
      'hello',
      'world',
      'beautiful',
      'poetry',
      'haiku',
      'syllable',
      'counting'
    ];
    
    testResults = [];
    
    for (const word of testWords) {
      try {
        const result = await countSyllables(word);
        testResults.push({
          word,
          expected: 'Dictionary or ML',
          actual: result.total,
          breakdown: result.words
        });
      } catch (error) {
        testResults.push({
          word,
          expected: 'Error',
          actual: error.message
        });
      }
    }
  }
  
  async function testHaiku() {
    if (!isInitialized) return;
    
    const haiku = "An old silent pond\nA frog jumps into the pond\nSplash! Silence again.";
    
    try {
      const validation = await validateHaiku(haiku);
      console.log('Haiku validation:', validation);
    } catch (error) {
      console.error('Haiku validation error:', error);
    }
  }
</script>

<svelte:head>
  <title>ONNX Syllable Counter Test</title>
</svelte:head>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-6">ONNX Syllable Counter Test</h1>
  
  <div class="mb-6">
    <h2 class="text-xl font-semibold mb-2">Initialization Status</h2>
    {#if isLoading}
      <p class="text-blue-600">Loading ONNX model...</p>
    {:else if isInitialized}
      <p class="text-green-600">✅ ONNX model initialized successfully!</p>
    {:else}
      <p class="text-red-600">❌ ONNX model initialization failed</p>
    {/if}
  </div>
  
  <div class="mb-6">
    <button 
      on:click={runTests}
      disabled={!isInitialized}
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
    >
      Run Word Tests
    </button>
    
    <button 
      on:click={testHaiku}
      disabled={!isInitialized}
      class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-4 disabled:opacity-50"
    >
      Test Haiku Validation
    </button>
  </div>
  
  {#if testResults.length > 0}
    <div class="mb-6">
      <h2 class="text-xl font-semibold mb-2">Test Results</h2>
      <div class="bg-gray-100 p-4 rounded">
        {#each testResults as result}
          <div class="mb-2">
            <strong>{result.word}:</strong> {result.actual} syllables
            {#if result.breakdown}
              <div class="text-sm text-gray-600 ml-4">
                Breakdown: {JSON.stringify(result.breakdown)}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  <div class="text-sm text-gray-600">
    <p>This page tests the ONNX-based syllable counter implementation.</p>
    <p>Check the browser console for detailed logs.</p>
  </div>
</div> 