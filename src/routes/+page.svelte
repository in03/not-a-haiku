<script>
  import { Sparkles, Leaf, Edit3 } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import UnifiedHaikuInput from '$lib/components/UnifiedHaikuInput.svelte';
  import AnalysisResults from '$lib/components/AnalysisResults.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import ModelErrorModal from '$lib/components/ModelErrorModal.svelte';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import { settingsStore } from '$lib/stores/settings.js';
  import { authStore } from '$lib/stores/auth.js';
  import { haikuStore } from '$lib/stores/haiku-db.js';
  import { poemTypes, detectPoemType } from '$lib/poemTypes.js';
  import { analyzeHaiku } from '$lib/github-models.js';
  import { initializeSyllableCounter } from '$lib/onnx-syllable-counter.js';
  import confetti from 'canvas-confetti';
  import { onMount, onDestroy, tick } from 'svelte';
  
  // Initialize syllable counter on mount
  onMount(async () => {
    try {
      const success = await initializeSyllableCounter();
      if (!success) {
        modelError = new Error('Failed to initialize syllable counter');
        showModelError = true;
      }
    } catch (error) {
      modelError = error instanceof Error ? error : new Error(String(error));
      showModelError = true;
    }
    
    // Check for edit haiku data from session storage
    if (typeof window !== 'undefined') {
      const editHaikuData = sessionStorage.getItem('editHaiku');
      if (editHaikuData) {
        try {
          const haiku = JSON.parse(editHaikuData);
          // Load the haiku for editing
          title = haiku.title || '';
          content = haiku.content || '';
          
          // Detect poem type from content and temporarily switch to it
          const detectedPoemType = detectPoemType(content);
          if (detectedPoemType !== $settingsStore.poemType) {
            console.log(`Detected poem type: ${detectedPoemType}, switching from ${$settingsStore.poemType}`);
            // Temporarily update the settings store for editing
            settingsStore.update(settings => ({
              ...settings,
              poemType: detectedPoemType
            }));
          }
          
          // Clear the session storage
          sessionStorage.removeItem('editHaiku');
          
          // Update the input component after a tick to ensure settings are applied
          await tick();
          if (unifiedInputComponent) {
            unifiedInputComponent.updateContent(content);
            // Force the component to expand to content step if there's content
            if (content.trim()) {
              unifiedInputComponent.expandToContent();
            }
          }
        } catch (error) {
          console.error('Failed to parse edit haiku data:', error);
          sessionStorage.removeItem('editHaiku');
        }
      }
    }
    
    // Global error handler for ML errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.message && event.error.message.includes('ML syllable counting failed')) {
        modelError = event.error;
        showModelError = true;
      }
    });

    // Show onboarding modal for new users
    // Note: We'll use a reactive statement to handle auth store initialization timing

    // Listen for clear editor events from the site title
    document.addEventListener('clearEditor', handleClearEditor);
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    document.removeEventListener('clearEditor', handleClearEditor);
  });
  
  let title = '';
  let content = '';
  let validation = { isValid: false, isComplete: false, feedback: '' };
  /** @type {number[]} */
  let syllableCounts = [];
  /** @type {number[]} */
  let expectedSyllables = [];
  
  // Debounced UI state for smoother animations
  let debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
  /** @type {ReturnType<typeof setTimeout> | null} */
  let validationTimeout = null;
  let progressBarValue = 0;
  let progressBarTarget = 0;
  let showToast = false;
  let toastMessage = '';
  let toastType = 'info';
  let celebrationIndex = 0;
  
  // Model error state
  let showModelError = false;
  /** @type {Error | null} */
  let modelError = null;

  // Onboarding modal state
  let showOnboarding = false;
  let onboardingChecked = false;
  /** @type {any} */
  let unifiedInputComponent;
  /** @type {HTMLDivElement | null} */
  let syllableScrollContainer = null;
  
  // Analysis state
  /** @type {{ rating: number; comment: string; tags: string[] } | null} */
  let analysis = null;
  let showAnalysis = false;
  
  // Current haiku ID for updating with analysis
  /** @type {string | null} */
  let currentHaikuId = null;
  let isAnalyzing = false;
  let isEditingHaiku = false;
  
  // Handle onboarding modal close
  function handleOnboardingClose() {
    showOnboarding = false;
    settingsStore.update(settings => ({
      ...settings,
      hasSeenOnboarding: true
    }));
  }

  // Debug function to manually trigger onboarding (localhost only)
  function debugTriggerOnboarding() {
    settingsStore.update(settings => ({
      ...settings,
      hasSeenOnboarding: false
    }));
    showOnboarding = true;
  }

  // Debug function to reset onboarding state (localhost only)
  function debugResetOnboarding() {
    settingsStore.update(settings => ({
      ...settings,
      hasSeenOnboarding: false
    }));
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app-settings');
    }
    // Reload the page to reinitialize stores
    window.location.reload();
  }

  // Clear editor event handler
  const handleClearEditor = () => {
    clearEditorState();
  };

  // Clear all editor state
  function clearEditorState() {
    // Reset all form variables
    title = '';
    content = '';
    validation = { isValid: false, isComplete: false, feedback: '' };
    syllableCounts = [];
    expectedSyllables = [];
    
    // Reset debounced UI state
    debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }
    progressBarValue = 0;
    progressBarTarget = 0;
    
    // Reset analysis state
    analysis = null;
    showAnalysis = false;
    currentHaikuId = null;
    isAnalyzing = false;
    isEditingHaiku = false;
    
    // Reset toast state
    showToast = false;
    toastMessage = '';
    toastType = 'info';
    celebrationIndex = 0;
    
    // Reset the unified input component (this handles most of the state)
    if (unifiedInputComponent) {
      unifiedInputComponent.reset();
    }
    
    // Clear any session storage edit data
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('editHaiku');
    }
  }
  
  // Function to start a new haiku
  function startNewHaiku() {
    // Clear any pending validation timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }
    
    if (unifiedInputComponent) {
      unifiedInputComponent.reset();
    }
    title = '';
    content = '';
    syllableCounts = [];
    validation = { isValid: false, isComplete: false, feedback: '' };
    debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
    analysis = null;
    showAnalysis = false;
    currentHaikuId = null;
    isEditingHaiku = false;
  }

  // Function to edit the current haiku
  function handleEditHaiku() {
    // Clear any pending validation timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }
    
    // Hide analysis and go back to input form
    showAnalysis = false;
    analysis = null;
    
    // Set editing mode
    isEditingHaiku = true;
    
    // Reset validation states
    validation = { isValid: false, isComplete: false, feedback: '' };
    debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
    
    // Set the form to content step since we have content
    if (unifiedInputComponent) {
      unifiedInputComponent.step = 'content';
      unifiedInputComponent.isExpanded = true;
    }
    
    // Focus the textarea after a brief delay
    setTimeout(() => {
      if (unifiedInputComponent && unifiedInputComponent.textareaElement) {
        unifiedInputComponent.textareaElement.focus();
      }
    }, 100);
  }
  
  // All available poem templates organized by type
  const poemTemplates = {
    haiku: [
    {
      id: 'lamenting-chores',
      title: '😔 lamenting chores',
      content: 'So much washing left.\nI don\'t want to but I must!\nEndless dirty shirts'
    },
    {
      id: 'wistful-heart', 
      title: '💘 wistful heart',
      content: 'Pretty lonely hey\ngotta get a lady, man.\nMaybe she\'ll love me?'
    },
    {
      id: 'shower-thoughts',
      title: '🤔 shower thoughts', 
      content: 'A cold toilet seat\nis a horrible feeling\nbut warm is much worse'
    },
    {
      id: 'wifi-woes',
      title: '📶 wifi woes',
      content: 'Password incorrect\nBut I typed it perfectly\nRouter why you suck'
    },
    {
      id: 'monday-blues',
      title: '🙄 monday blues', 
      content: 'Coffee cup empty\nAlarm clock screaming at me\nWeekend, please come back'
    },
    {
      id: 'autocorrect-fail',
      title: '📱 autocorrect fail',
      content: 'Autocorrect strikes\nChanging words I never meant\nMessages confused'
      }
    ],
    tanka: [
      {
        id: 'coding-life',
        title: '💻 coding life',
        content: 'Debug at midnight\nCoffee cold, but spirit warm\nOne more try might work\nStack Overflow saves the day\nCommit and push to master'
      },
      {
        id: 'grocery-run',
        title: '🛒 grocery run',
        content: 'Make a shopping list\nForget it on kitchen desk\nWander aisles confused\nBuy random things that look good\nStill need milk but forgot it'
      },
      {
        id: 'exercise-goals',
        title: '🏃 exercise goals',
        content: 'New resolution\nSigned up to the gym again\nJanuary aight\nFebruary went okay\nMarch finds me back on the couch'
      }
    ],
    cinquain: [
      {
        id: 'coffee-break',
        title: '☕ coffee break',
        content: 'Working\nMeeting drags on\nNeed caffeine boost right now\nEscape to kitchen for quick fix\nAwake'
      },
      {
        id: 'plant-care',
        title: '🌱 plant care',
        content: 'Greenish\nLeaves are wilting...\nForgot to water! Dang\nSorry little plant friend of mine\Forgive?'
      },
      {
        id: 'deadline-stress',
        title: '⏰ deadline stress',
        content: 'Rushhhhing!\nPanic sets in\nDeadline is tomorrow\nWhy did I leave this so late, man?\nI\'m doomed'
      }
    ],
    nonet: [
      {
        id: 'morning-routine',
        title: '🌅 morning routine',
        content: 'Alarm clock beeping at seven AM.\nMash the snooze button a few times.\nThe coffee machine starts up.\nGet the toothbrush buzzing.\nShower water pours.\nToast is golden\nKeys in hand.\nGet out.\nGo!'
      },
      {
        id: 'weekend-plans',
        title: '🛋️ weekend plans',
        content: 'Saturday morning, I\'ve got big plans:\nClean the house, tidy the garage,\ncall my parents and catch up,\nmaybe I\'ll go shopping,\nthen watch a movie,\neat some pizza!\nnap a bit...\nSounds good.\nYeah.'
      },
    ],
    shadorma: [
      {
        id: 'tax-season',
        title: '📊 tax season',
        content: 'Receipts lost\nForms spread everywhere\nCalculate\nDeductions\nAccountant calls with bad news\nI owe more money'
      },
      {
        id: 'pet-care',
        title: '🐕 pet care',
        content: 'Dog walking\nThree times daily now\nRaining hard\nBut still must\nPut on boots and grab the leash\nGood boy, fluffy dog'
      },
      {
        id: 'social-plans',
        title: '📱 social plans',
        content: 'Ping group chat\nMake some dinner plans\nChoose a place\nSuch chaos\nEveryone votes differently\nJust stay home instead'
      }
    ],
    etheree: [
      {
        id: 'productivity',
        title: '📈 productivity',
        content: 'Start!\nTry hard...\nPut in work.\nMake solid plans\nOrganize my desk\nOpen laptop ready\nCheck email first then socials\nSuddenly three hours have passed\nWhat the actual heck just happened\nGuess I need to stay back til late tonight'
      },
      {
        id: 'vacation-prep',
        title: '✈️ vacation prep',
        content: 'Yay!\nPack bags\nMake a list\nPassport, tickets\nWeather forecast\'s dece\nExcitement building up\nDouble check everything, twice\nMissing phone charger and toothbrush\nHow does this happen every time!\nI\'ll buy them when I get to the airport...'
      }
    ],
    etheree_desc: [
      {
        id: 'cooking-dinner',
        title: '🍳 cooking dinner',
        content: "Recipe with many ingredients\nPrepare vegetables and measure spice\nHeat oil while checking the cookbook\nSuddenly, something's burning\nSmoke alarm going off\nOpen all windows\nOrder takeout\nCleanup mess\nTasty!\n(soup)"
      },
      {
        id: 'home-improvement',
        title: '🔨 home improvement',
        content: 'Weekend project seemed simple in the store\nRead instructions carefully three times\nGather tools and lay out the parts\nRealize missing some screws\nDrive back to hardware store\nGot parts, still confused\nCall smart neighbor\nStill takes long\nFar out...\nDone.'
      }
    ]
  };

  // Current random selection of 3 templates
  /** @type {Array<{id: string, title: string, content: string}>} */
  let currentTemplates = [];
  
  // Function to get 3 random templates for current poem type
  function getRandomTemplates() {
    const currentPoemType = $settingsStore.poemType || 'haiku';
    const availableTemplates = poemTemplates[/** @type {keyof typeof poemTemplates} */(currentPoemType)] || poemTemplates.haiku;
    const shuffled = [...availableTemplates].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(3, availableTemplates.length));
  }
  
  // Initialize with random templates
  currentTemplates = getRandomTemplates();
  
  // Track previous content state and poem type to detect when templates should refresh
  let previousContentEmpty = true;
  let previousPoemType = $settingsStore.poemType;
  
  // Refresh templates when content becomes empty again or poem type changes
  $: if ((!content.trim() && !previousContentEmpty) || $settingsStore.poemType !== previousPoemType) {
    currentTemplates = getRandomTemplates();
    previousContentEmpty = true;
    previousPoemType = $settingsStore.poemType;
  } else if (content.trim()) {
    previousContentEmpty = false;
  }
  
  // Template selection handler
  /** @param {{ id: string, title: string, content: string }} template */
  function selectTemplate(template) {
    if (unifiedInputComponent) {
      unifiedInputComponent.reset();
    }
    title = template.title;
    content = template.content;
    // Clear previous state
    syllableCounts = [];
    validation = { isValid: false, isComplete: false, feedback: '' };
    analysis = null;
    showAnalysis = false;
    
    // Trigger validation for the new content
    if (unifiedInputComponent) {
      unifiedInputComponent.updateContent(template.content);
    }
  }
  
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
  
  // Auth is initialized in layout
  
  // Reactive statement to check onboarding when auth store is ready
  $: if (!$authStore.isLoading && !onboardingChecked) {
    onboardingChecked = true;
    
    if (!$settingsStore.hasSeenOnboarding && !$authStore.isAuthenticated) {
      showOnboarding = true;
    }
  }
  
  // no decorative leaves
  
  /** @param {CustomEvent<{ isValid: boolean, isComplete: boolean, feedback: string }>} event */
  function handleValidation(event) {
    const previousValid = validation.isValid;
    validation = event.detail;
    
    // Clear existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    
    // If validation becomes invalid, immediately update debounced state
    if (!validation.isValid) {
      debouncedValidation = { ...validation };
    } else {
      // If validation becomes valid, debounce the update (300ms delay)
      validationTimeout = setTimeout(() => {
        const previousDebouncedValid = debouncedValidation.isValid;
        debouncedValidation = { ...validation };
        
        // Cycle celebration message when haiku becomes valid
        if (!previousDebouncedValid && debouncedValidation.isValid) {
          celebrationIndex = (celebrationIndex + 1) % celebrationMessages.length;
        }
      }, 300);
    }
    
    // Update progress bar target immediately for smooth animation
    updateProgressBarTarget();
  }
  
  /** @param {CustomEvent<{ counts: number[], expected: number[] }>} event */
  function handleSyllables(event) {
    syllableCounts = event.detail.counts;
    expectedSyllables = event.detail.expected;
    updateProgressBarTarget();
  }
  
  // Update progress bar target based on current validation state
  function updateProgressBarTarget() {
    if (!validation.isValid || !validation.isComplete) {
      // Calculate progress based on syllable completion
      const totalExpected = expectedSyllables.reduce((sum, count) => sum + count, 0);
      const totalCurrent = syllableCounts.reduce((sum, count) => sum + count, 0);
      progressBarTarget = totalExpected > 0 ? Math.min((totalCurrent / totalExpected) * 100, 100) : 0;
    } else {
      // Haiku is complete
      progressBarTarget = 100;
    }
  }
  
  // Smooth progress bar animation
  function animateProgressBar() {
    const diff = progressBarTarget - progressBarValue;
    if (Math.abs(diff) < 0.1) {
      progressBarValue = progressBarTarget;
      return;
    }
    
    // Different speeds for forward vs backward movement
    const speed = diff > 0 ? 0.15 : 0.05; // Faster forward, slower backward
    progressBarValue += diff * speed;
    
    requestAnimationFrame(animateProgressBar);
  }
  
  // Start progress bar animation when target changes
  $: if (progressBarTarget !== progressBarValue) {
    requestAnimationFrame(animateProgressBar);
  }
  
  /** @param {CustomEvent<any>} event */
  async function handleSubmit(event) {
    if (event.detail.isComplete) {
      // Save or update the haiku to IndexedDB
      try {
        const lines = content.split('\n').filter(line => line.trim());
        const haikuData = {
          title: title || 'Untitled Haiku',
          lines: lines,
          text: content,
          tags: [], // Start with no tags, user can add them in grid view
          status: $settingsStore.enableTaskTracking ? 'todo' : 'done'
        };

        if (isEditingHaiku && currentHaikuId) {
          // Update existing haiku
          await haikuStore.update(currentHaikuId, haikuData);
          console.log('Updated existing haiku:', currentHaikuId);
        } else {
          // Create new haiku
          const savedHaiku = await haikuStore.create(haikuData);
          currentHaikuId = savedHaiku.id;
          console.log('Created new haiku:', currentHaikuId);
        }
      } catch (error) {
        console.error('Failed to save haiku:', error);
      }
      
      // Show success message
      showToast = true;
      toastMessage = isEditingHaiku ? 'Haiku updated! ✨' : celebrationMessages[celebrationIndex];
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
      
      // Try to analyze the haiku if user is authenticated and critique is enabled
      if ($authStore.isAuthenticated && $authStore.accessToken && $settingsStore.enableCritique) {
        try {
          isAnalyzing = true;
          showToast = true;
          toastMessage = 'Analyzing your haiku...';
          toastType = 'info';
          
          const result = /** @type {any} */ (await analyzeHaiku(content, title, $authStore.accessToken));
          
          if (result.success) {
            analysis = result.analysis;
            showAnalysis = true;
            showToast = true;
            toastMessage = 'Analysis complete! ✨';
            toastType = 'success';
            
            // Update the saved haiku with analysis results
            if (currentHaikuId && analysis) {
              try {
                await haikuStore.update(currentHaikuId, {
                  tags: analysis.tags, // Copy suggested tags to main tags field
                  analysis: {
                    rating: analysis.rating,
                    commentary: analysis.comment,
                    suggestedTags: analysis.tags
                  }
                });
              } catch (error) {
                console.error('Failed to update haiku with analysis:', error);
              }
            }
          } else {
            // Use fallback analysis if API fails
            analysis = result.fallback;
            showAnalysis = true;
            showToast = true;
            toastMessage = 'Analysis failed, but your haiku is still beautiful! 🌸';
            toastType = 'warning';
            
            // Update the saved haiku with fallback analysis
            if (currentHaikuId && analysis) {
              try {
                await haikuStore.update(currentHaikuId, {
                  tags: analysis.tags, // Copy suggested tags to main tags field
                  analysis: {
                    rating: analysis.rating,
                    commentary: analysis.comment,
                    suggestedTags: analysis.tags
                  }
                });
              } catch (error) {
                console.error('Failed to update haiku with fallback analysis:', error);
              }
            }
          }
        } catch (error) {
          console.error('Analysis error:', error);
          showToast = true;
          toastMessage = 'Analysis failed. Try signing out and back in to GitHub.';
          toastType = 'error';
        } finally {
          isAnalyzing = false;
          // Reset editing flag after analysis completes
          isEditingHaiku = false;
        }
      }
      
      // Don't auto-reset if analysis is shown - let user manually start new haiku
      if (!showAnalysis) {
        setTimeout(() => {
          // Clear any pending validation timeout
          if (validationTimeout) {
            clearTimeout(validationTimeout);
            validationTimeout = null;
          }
          
          if (unifiedInputComponent) {
            unifiedInputComponent.reset();
          }
          title = '';
          content = '';
          syllableCounts = [];
          validation = { isValid: false, isComplete: false, feedback: '' };
          debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
          celebrationIndex = (celebrationIndex + 1) % celebrationMessages.length;
        }, 3000);
      }
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
  
  // Use smooth animated progress bar value
  $: progressPercentage = $settingsStore.showProgressBar ? progressBarValue : 0;
  
  // Detect when content is expanding to adjust centering
  // Trigger expansion when there's actual content being typed or analysis is shown
  $: contentExpanding = (content.trim().length > 0 && content.includes('\n')) || 
                       showAnalysis || 
                       debouncedValidation.isComplete ||
                       syllableCounts.length > 0 ||
                       (title.trim().length > 0 && content.trim().length > 0);
  

</script>

<svelte:head>
  <title>Not a Haiku - Haiku assistance and stuff</title>
  <meta name="description" content={`Write beautiful ${poemNameLower} with real-time syllable counting`} />
</svelte:head>

<div class="main-content-wrapper {contentExpanding ? 'content-expanding' : ''}">
<div class="container mx-auto px-4 py-4">
  <!-- Header copy -->
  <div class="text-center mb-4 animate-fade-in">
    <div class="flex items-center justify-center gap-3 mb-3 relative progress-title {$settingsStore.showProgressBar && progressPercentage > 0 ? 'show-progress' : ''}" 
         style="--progress: {progressPercentage}%">
      <h1 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r {debouncedValidation.isValid ? 'from-green-400 to-emerald-500' : 'from-sky-400 to-blue-500'} bg-clip-text text-transparent transition-all duration-500 mb-2">
        {debouncedValidation.isValid ? `It's ${poemArticle} ${poemName}!` : `Not ${poemArticle} ${poemName}`}
      </h1>
      {#if debouncedValidation.isValid}
        <Sparkles class="w-7 h-7 sm:w-8 sm:h-8 text-success" />
      {:else}
        <Leaf class="w-7 h-7 sm:w-8 sm:h-8 text-error" />
      {/if}
    </div>
    <div class="relative min-h-[44px] py-1 overflow-visible">
      {#if !(content && expectedSyllables.length)}
        <div class="absolute inset-0 flex items-center justify-center text-sm text-base-content/60"
          in:fly={{ x: -20, duration: 400, easing: cubicOut }}
          out:fly={{ x: -20, duration: 400, easing: cubicOut }}
        >
          Write something! Or choose an example 👇
        </div>
      {/if}

      {#if content && expectedSyllables.length && !debouncedValidation.isComplete}
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
      
      {#if debouncedValidation.isComplete}
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
    {#if showAnalysis && analysis}
      <!-- Analysis Results - replaces haiku input -->
      <div transition:fly={{ y: 20, duration: 500, easing: cubicOut }}>
        <AnalysisResults 
          {analysis}
          isVisible={showAnalysis}
          {title}
          {content}
        />
        
        <!-- Action Buttons -->
        <div class="mt-8 flex justify-center items-center gap-6">
          <button 
            class="btn btn-outline btn-lg flex items-center gap-2"
            on:click={handleEditHaiku}
            title="Edit this haiku"
          >
            <Edit3 class="w-5 h-5" />
            I can do better
          </button>
          <button 
            class="btn btn-primary btn-lg"
            on:click={startNewHaiku}
          >
            ✨ Write Another {poemName}
          </button>
        </div>
      </div>
    {:else}
      <!-- Title input, haiku editor with integrated submission -->
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

      <!-- Template inspiration section -->
      {#if !content.trim()}
        <div class="mt-4 text-center" 
          in:fade={{ duration: 300 }}
          out:fade={{ duration: 200 }}
        >
          <!-- <p class="text-sm text-base-content/60 mb-3">or try one of these...</p> -->
          <div class="flex items-center justify-center gap-2 flex-wrap">
            {#each currentTemplates as template}
              <button 
                class="template-badge"
                on:click={() => selectTemplate(template)}
                title="Click to use this template"
              >
                {template.title}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
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

<!-- Model Error Modal -->
<ModelErrorModal
  bind:isOpen={showModelError}
  error={modelError}
/>

<!-- Onboarding Modal -->
<OnboardingModal
  bind:isOpen={showOnboarding}
  on:close={handleOnboardingClose}
/>

<!-- Debug controls (only show in development) -->
{#if typeof window !== 'undefined' && window.location.hostname === 'localhost'}
  <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; font-size: 12px;">
    <div>Debug Controls:</div>
    <button on:click={debugTriggerOnboarding} style="margin: 2px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Show Onboarding</button>
    <button on:click={debugResetOnboarding} style="margin: 2px; padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Reset Onboarding</button>
    <div style="margin-top: 5px; font-size: 10px;">
      hasSeen: {$settingsStore.hasSeenOnboarding}<br>
      isAuth: {$authStore.isAuthenticated}<br>
      showOnboarding: {showOnboarding}
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fade-in 0.8s ease-out;
  }
  
  /* Template badge styling */
  .template-badge {
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    background: var(--bg-secondary, hsl(var(--b2)));
    border: 1px solid var(--border-color, hsl(var(--bc) / 0.1));
    border-radius: 24px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary, hsl(var(--bc) / 0.7));
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }
  
  .template-badge:hover {
    background: var(--bg-tertiary, hsl(var(--b3)));
    border-color: var(--border-focus, hsl(var(--p)));
    color: var(--text-primary, hsl(var(--bc)));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px hsl(var(--bc) / 0.1);
  }
  
  .template-badge:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px hsl(var(--bc) / 0.1);
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
  
  /* Progressive underline for title */
  .progress-title {
    display: inline-flex;
    position: relative;
  }
  
  .progress-title::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    height: 3px;
    width: var(--progress);
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 2px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
  }
  
  /* Show progress underline when enabled and there's progress */
  .progress-title.show-progress::after {
    opacity: 1;
  }
  
  /* removed decorative leaves */
  
  /* Main content wrapper for better vertical centering */
  .main-content-wrapper {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem 0;
    transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Container that grows from center */
  .main-content-wrapper .container {
    width: 100%;
    max-width: 1200px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center center;
  }
  
  /* When content is expanding, keep center anchor but reduce padding */
  .main-content-wrapper.content-expanding {
    /* Keep center justification - this is key for center expansion */
    justify-content: center;
    /* Reduce padding to give more room for content while maintaining center anchor */
    padding: 1rem 0;
  }
  
  /* Add subtle scale effect for smoother expansion feeling */
  .main-content-wrapper:not(.content-expanding) .container {
    transform: scale(0.98);
  }
  
  .main-content-wrapper.content-expanding .container {
    transform: scale(1);
  }
  
  /* Mobile adjustments - use less aggressive centering on small screens */
  @media (max-height: 600px) {
    .main-content-wrapper {
      justify-content: flex-start;
      padding: 2rem 0 1rem 0;
    }
    
    .main-content-wrapper.content-expanding {
      padding: 1rem 0;
    }
    
    /* Reduce scale effect on mobile */
    .main-content-wrapper:not(.content-expanding) .container {
      transform: scale(1);
    }
  }
  
  /* On very small viewports, prioritize usability */
  @media (max-height: 500px) {
    .main-content-wrapper {
      justify-content: flex-start;
      padding: 1rem 0;
    }
    
    .main-content-wrapper.content-expanding {
      padding: 0.5rem 0;
    }
  }
</style>