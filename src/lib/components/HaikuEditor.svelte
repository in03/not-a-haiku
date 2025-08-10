<script>
  // @ts-nocheck
  import { createEventDispatcher, onMount } from 'svelte';
  import { validateHaiku, countHaikuSyllables, initializeSyllableCounter } from '../onnx-syllable-counter.js';
  import confetti from 'canvas-confetti';
  import { settingsStore, defaultSettings } from '$lib/stores/settings.js';
  import { poemTypes } from '../poemTypes.js';
  
  export let content = '';
  export let placeholder = 'Write your haiku here...';
  export let title = '';
  export let validation = { isValid: false, isComplete: false, feedback: '' };
  
  const dispatch = createEventDispatcher();
  
  // Settings state
  let settings = { ...defaultSettings };
  // subscribe to centralized settings
  const unsubscribeSettings = settingsStore.subscribe((s) => settings = s);
  // Settings managed via header /settings route only
  $: isFocusMode = settings.preset === 'focus' || !!settings.hideHeader;
  
  /** @type {Record<string, any>} */
  const poemTypesDict = /** @type {any} */ (poemTypes);
  $: expectedSyllables = poemTypesDict[settings.poemType].syllables;
  $: maxLines = expectedSyllables.length;
  
  // Focus mode progress calculation
  $: totalExpectedSyllables = expectedSyllables.reduce((sum, count) => sum + count, 0);
  $: totalCurrentSyllables = syllableCounts.reduce((sum, count) => sum + count, 0);
  $: progressPercentage = Math.min(100, (totalCurrentSyllables / totalExpectedSyllables) * 100);
  $: isProgressComplete = totalCurrentSyllables === totalExpectedSyllables;
  $: isProgressOverLimit = totalCurrentSyllables > totalExpectedSyllables;
  
  // Responsive container height based on poem length
  $: editorRows = Math.max(6, maxLines + 2);
  // Base chrome height + per-row estimate; clamp to reasonable bounds
  $: containerMinHeight = Math.min(900, Math.max(420, Math.floor(260 + editorRows * 28)));
  
  // Dark mode handled globally in +layout via theme.js
  
  let textarea;
  let syllableCounts = [];
  let isShaking = false;
  let isFocused = false;
  let ephemeralMessage = '';
  let ephemeralTimer;
  let isErrorPulseActive = false;
  
  // Initialize syllable counts based on poem type
  $: {
    if (syllableCounts.length !== maxLines) {
      syllableCounts = new Array(maxLines).fill(0);
    }
  }
  let isProcessingOverLimit = false;
  let lastValidationTime = 0;
  let hasTriggeredConfetti = false;
  let isInputBlocked = false;
  let isTemporarilyBlocked = false;
  let isLockedOverLimit = false;
  let lastWordSubmissionValidation = '';

  // When auto-backspace is disabled, lock input (except navigation/deletion) while over the limit
  $: isLockedOverLimit = !settings.autoBackspace && syllableCounts.some((count, index) => count > expectedSyllables[index]);
  $: isInputBlocked = isTemporarilyBlocked || isLockedOverLimit;

  // Ensure user still sees a shake once when lock engages
  let hasShakenForLock = false;
  $: if (isLockedOverLimit && !hasShakenForLock) {
    hasShakenForLock = true;
    if (settings.enableShake) {
      shakeWindow();
    }
  }
  $: if (!isLockedOverLimit && hasShakenForLock) {
    hasShakenForLock = false;
  }
  
  // Reactive syllable counting (predictive, real-time)
  $: {
    if (content !== undefined) {
      updateSyllableCounts(content).catch(error => {
        console.error('Syllable counting error:', error);
      });
    }
  }
  
  // Predictive syllable counting for real-time feedback
  async function updateSyllableCounts(text) {
    try {
      syllableCounts = await countHaikuSyllables(text, expectedSyllables);
    } catch (error) {
      console.error('Syllable counting error:', error);
      syllableCounts = new Array(maxLines).fill(0);
    }
  }

  // Ephemeral microcopy for focus mode
  $: if (isFocusMode && validation) {
    // Show soft, non-judgmental microcopy briefly
    if (validation.isComplete) {
      showEphemeral('Complete');
    } else if (validation.feedback) {
      const msg = validation.feedback.replace(/too many syllables/i, 'A syllable too far.');
      showEphemeral(msg);
    }
  }

  function showEphemeral(message) {
    clearTimeout(ephemeralTimer);
    ephemeralMessage = message;
    ephemeralTimer = setTimeout(() => (ephemeralMessage = ''), 1500);
  }
  
  // Word submission validation - only triggered when space is pressed
  async function validateWordSubmission(text) {
    const now = performance.now();
    lastValidationTime = now;
    
    try {
      // Update syllable counts for the latest text
      await updateSyllableCounts(text);
      
      // Check for over-limit after word completion
      const hasOverLimit = syllableCounts.some((count, index) => count > expectedSyllables[index]);
      if (hasOverLimit && settings.autoBackspace) {
        // Word submission caused over-limit - enforce correction if auto-backspace is enabled
        setTimeout(() => {
          handleOverLimit();
        }, 50);
      } else if (hasOverLimit) {
        if (isFocusMode && settings.enableGentleErrorPulse) {
          // Trigger a brief error pulse via class binding
          isErrorPulseActive = false;
          requestAnimationFrame(() => {
            isErrorPulseActive = true;
            setTimeout(() => (isErrorPulseActive = false), 250);
          });
        } else if (settings.enableShake) {
          // Just shake if auto-backspace is disabled but shake is enabled
          shakeWindow();
        }
      }
      
      // Dispatch validation result
      const validation = await validateHaiku(text, expectedSyllables, poemTypes[settings.poemType].name);
      dispatch('validation', validation);
      
      // Don't trigger confetti automatically - only on manual submission
      
      // Store the text for this validation to avoid duplicate validations
      lastWordSubmissionValidation = text;
      
    } catch (error) {
      console.error('Validation error:', error);
      dispatch('validation', { isValid: false, isComplete: false, feedback: 'Validation error' });
    }
  }
  
  function getCurrentLineIndex(text, cursorPos) {
    const beforeCursor = text.substring(0, cursorPos);
    const lineBreaks = (beforeCursor.match(/\n/g) || []).length;
    return Math.min(lineBreaks, maxLines - 1); // Cap at last line
  }
  
  function handleOverLimit() {
    if (isProcessingOverLimit) return;
    
    isProcessingOverLimit = true;

    
    if (textarea) {
      const currentPos = textarea.selectionStart;
      const currentLineIndex = getCurrentLineIndex(content, currentPos);
      
      if (currentPos > 0 && currentLineIndex >= 0) {
        // Find the start of the current line
        let lineStart = content.lastIndexOf('\n', currentPos - 1) + 1;
        if (lineStart === 0) lineStart = 0;
        
        // Get the current line's content
        const currentLine = content.substring(lineStart, currentPos);
        const isPartialWord = !currentLine.endsWith(' ');
        
        // If we're at exactly the right syllables and it's a complete word
        if (syllableCounts[currentLineIndex] === expectedSyllables[currentLineIndex] && !isPartialWord) {
  
          // Move to next line if not the last line
          if (currentLineIndex < 2) {
            const beforeCursor = content.substring(0, currentPos);
            const afterCursor = content.substring(currentPos);
            content = beforeCursor + '\n' + afterCursor;
            
            // Set cursor position after the newline
            setTimeout(() => {
              textarea.setSelectionRange(currentPos + 1, currentPos + 1);
            }, 0);
          }
        } else {
          // Remove the last complete word on the current line (skip trailing spaces first)
          let end = currentPos;
          while (end > lineStart && content[end - 1] === ' ') {
            end--;
          }
          // Now walk back to the previous space/newline – this is the start of the last word
          let lastWordStart = end;
          while (lastWordStart > lineStart && content[lastWordStart - 1] !== ' ' && content[lastWordStart - 1] !== '\n') {
            lastWordStart--;
          }
          // Compose the new line up to the start of the last word
          const keptLine = content.substring(lineStart, lastWordStart).trimEnd();
          const beforeLine = content.substring(0, lineStart);
          const afterCursor = content.substring(currentPos);
          const rebuiltLine = keptLine.length > 0 ? keptLine + ' ' : '';
          content = beforeLine + rebuiltLine + afterCursor;
          // Move cursor to end of rebuilt line
          const newPos = lineStart + rebuiltLine.length;
          setTimeout(() => {
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
        
        // Shake the window to indicate the limit was reached
        shakeWindow();
      }
    }
    
    // Reset processing flag after a short delay
    setTimeout(() => {
      isProcessingOverLimit = false;
    }, 100);
  }
  
  function handleKeydown(event) {
    if (!textarea) return;
    
    // Block all input during the no-input period
    if (isInputBlocked) {
      // Still allow navigation and deletion keys during blocking
      const allowedDuringBlock = [
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End', 'PageUp', 'PageDown',
        'Backspace', 'Delete', 'Tab', 'Escape'
      ];
      
      if (!allowedDuringBlock.includes(event.key) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        return;
      }
    }
    
    const cursorPos = textarea.selectionStart;
    

    
    // Allow special keys
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown',
      'Backspace', 'Delete', 'Tab', 'Escape'
    ];
    
    if (allowedKeys.includes(event.key)) {

      return;
    }
    
    // Allow Ctrl/Cmd combinations, but block paste
    if (event.ctrlKey || event.metaKey) {
      // Block Ctrl+V/Cmd+V paste
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        dispatch('toast', {
          message: "Hey! Keep it original! No plagiarism. 📝",
          type: 'warning'
        });
        return;
      }
      return;
    }
    
    // Filter input to alphabetical characters and basic punctuation only
    // Allowed: letters, spaces, newlines, apostrophes, periods, commas, semicolons, colons, exclamation, question marks, hyphens
    if (event.key.length === 1) { // Only check single character inputs
      const allowedCharPattern = /[a-zA-Z\s\n'.,;:!?\-\(\)]/;
      if (!allowedCharPattern.test(event.key)) {
        event.preventDefault();
        return;
      }
    }
    
    // Get current line info
    const currentLineIndex = getCurrentLineIndex(content, cursorPos);

    
    // Only enforce on lines within the poem structure
    if (currentLineIndex >= maxLines) {
      return;
    }
    
    const expectedSyll = expectedSyllables[currentLineIndex];
    const currentSyll = syllableCounts[currentLineIndex] || 0;
    

    
    // Check if we're at a word boundary (space or newline before cursor)
    const isAtWordBoundary = cursorPos === 0 || 
                            content[cursorPos - 1] === ' ' || 
                            content[cursorPos - 1] === '\n';
    
    // Handle SPACE - trigger word submission validation
    if (event.key === ' ') {
      // Allow the space to be typed first
      setTimeout(() => {
        // Trigger validation after the space is added
        const newContent = content.substring(0, cursorPos) + ' ' + content.substring(cursorPos);
        if (newContent !== lastWordSubmissionValidation) {
          validateWordSubmission(newContent);
        }
      }, 0);
      
      // Check if we're at syllable limits after space
      if (currentSyll === expectedSyll && !isAtWordBoundary) {
        // Don't prevent default - let the space be typed
        // But trigger line break if appropriate
        setTimeout(() => {
          if (currentLineIndex < maxLines - 1) {
            // Insert newline after the space
            const spacePos = cursorPos + 1;
            const beforeSpace = content.substring(0, spacePos);
            const afterSpace = content.substring(spacePos);
            content = beforeSpace + '\n' + afterSpace;
            
            setTimeout(() => {
              textarea.setSelectionRange(spacePos + 1, spacePos + 1);
            }, 0);
          }
        }, 10);
      }
      return;
    }
    
    // Handle ENTER at syllable limits
    if (event.key === 'Enter' && currentSyll === expectedSyll && !isAtWordBoundary) {
      event.preventDefault();
      
      if (currentLineIndex < maxLines - 1) {
        // Insert newline and move to next line
        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);
        content = beforeCursor + '\n' + afterCursor;
        
        setTimeout(() => {
          textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
        }, 0);
      } else {
        // At last line limit - shake to indicate no more lines
        if (settings.enableShake) {
          shakeWindow();
        }
      }
      return;
    }
    
    // Allow typing to continue - syllable counting is predictive
    // Word submission validation will handle enforcement when space is pressed
    
    // Allow input if under the limit

  }
  
  function shakeWindow() {
    if (!settings.enableShake || isShaking) {
      return;
    }
    
    isShaking = true;
    isTemporarilyBlocked = true;
    
    // Shake animation ends after 500ms
    setTimeout(() => {
      isShaking = false;
    }, 500);
    
    // Input blocking continues for 1 second total
    setTimeout(() => {
      isTemporarilyBlocked = false;
    }, 1000);
  }
  
  function handlePaste(event) {
    event.preventDefault();
    
    // Dispatch toast event to parent
    dispatch('toast', {
      message: "Hey! Keep it original! No plagiarism. 📝",
      type: 'warning'
    });
  }
  
  // Track poemType changes from global settings; clear editor to avoid mixed structure
  let lastPoemType = settings.poemType;
  $: if (lastPoemType !== settings.poemType) {
    lastPoemType = settings.poemType;
    if (content.trim()) {
      content = '';
      syllableCounts = new Array(maxLines).fill(0);
    }
  }
  
  // Manual submission function
  async function submitPoem() {
    try {
      const validation = await validateHaiku(content, expectedSyllables, poemTypes[settings.poemType].name);
      
      if (validation.isComplete && settings.enableConfetti) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
        });
      }
      
      dispatch('submit', validation);
    } catch (error) {
      console.error('Submission error:', error);
    }
  }
  
  // Watch for over-limit conditions only after word submission validation
  // This is now more lenient and only triggers enforcement on completed words
  
  let systemPrefersDark = false;
  onMount(() => {
    (async () => {
      try {
        await initializeSyllableCounter();
      } catch (error) {
        console.error('Failed to initialize ONNX syllable counter:', error);
      }
    })();

    // Check system dark mode preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemPrefersDark = mediaQuery.matches;
      const handleChange = (e) => {
        systemPrefersDark = e.matches;
      };
      mediaQuery.addEventListener('change', handleChange);
      // Cleanup listener on component destroy
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    if (textarea) {
      textarea.focus();
    }
  });

  import { onDestroy } from 'svelte';
  onDestroy(() => unsubscribeSettings());
</script>



<!-- Editor Container -->
<div class="editor-container" style="min-height: {containerMinHeight}px;">
  <div class="editor-panel">
    {#if !isFocusMode}
      <!-- Title and subtitle (hidden in focus mode) -->
      <div class="main-header">
        <h2 class="main-title">"{title}"</h2>
        <p class="main-subtitle">
          {validation.feedback || `Write your ${expectedSyllables.join('-')} syllable ${poemTypesDict[settings.poemType].name.toLowerCase()}...`}
        </p>
      </div>
    {/if}
    
    <div class="relative {isShaking ? 'animate-shake' : ''} {isInputBlocked ? 'opacity-50 pointer-events-none' : ''} {isFocusMode ? 'focus-mode' : ''}">
      {#if !isFocusMode}
        <!-- Header with poem type (settings managed via header page) -->
        <div class="editor-header card bg-base-100 shadow">
          <div class="card-body py-3">
          <div class="poem-type-info">
            <h3 class="poem-type-name">{poemTypesDict[settings.poemType].name}</h3>
            <div class="poem-type-pattern">
              {expectedSyllables.join('-')} syllables
            </div>
          </div>
          </div>
        </div>
        
        <!-- Syllable indicators (hidden in focus mode) -->
        {#if settings.indicatorMode === 'count'}
          <div class="syllable-indicators">
            {#each syllableCounts as count, index}
              <div class="syllable-indicator {count === expectedSyllables[index] ? 'syllable-perfect' : count > expectedSyllables[index] ? 'syllable-over' : 'syllable-under'}">
                Line {index + 1}: {count}/{expectedSyllables[index]}
              </div>
            {/each}
          </div>
        {:else}
          <div class="syllable-indicators">
            {#each expectedSyllables as expected, index}
              <div class="syllable-indicator {syllableCounts[index] > expected ? 'syllable-over' : syllableCounts[index] === expected ? 'syllable-perfect' : 'syllable-under'}">
                Line {index + 1}: {syllableCounts[index] > expected ? 'over' : syllableCounts[index] === expected ? 'ok' : '...' }
              </div>
            {/each}
          </div>
        {/if}
      {/if}
      
      <!-- Progress indicator (focus mode only) -->
        {#if isFocusMode && settings.showProgressBar}
        <div class="progress-container">
          <div class="progress-bar {isProgressComplete ? 'complete' : isProgressOverLimit ? 'over-limit' : 'in-progress'}" style="transform: scaleX({progressPercentage / 100});"></div>
        </div>
      {/if}
      
      <!-- Poem editor -->
        <textarea
        bind:this={textarea}
        bind:value={content}
        on:keydown={handleKeydown}
        on:paste={handlePaste}
        on:focus={() => (isFocused = true)}
        on:blur={() => (isFocused = false)}
        placeholder={placeholder || `Write your ${poemTypesDict[settings.poemType].name.toLowerCase()} here...`}
        class="textarea textarea-bordered rounded-lg w-full {isFocusMode ? 'focus-textarea' : ''} {isErrorPulseActive ? 'error-pulse' : ''}"
        rows={Math.max(6, maxLines + 2)}
        autocomplete="off"
        spellcheck="false"
      ></textarea>

      {#if isFocusMode}
        <!-- Line guide on focus -->
        {#if settings.lineGuideOnFocus && isFocused}
          <div class="line-guide">Line {getCurrentLineIndex(content, textarea?.selectionStart || 0) + 1} of {maxLines}</div>
        {/if}

        <!-- Ephemeral microcopy -->
        {#if ephemeralMessage}
          <div class="ephemeral">{ephemeralMessage}</div>
        {/if}
      {/if}
    </div>
    
    {#if !isFocusMode}
      <!-- Action Buttons (hidden in focus mode) -->
      <div class="action-buttons" style="flex-wrap: wrap;">
        <button class="btn btn-ghost" on:click={() => dispatch('cancel')} style="max-width: 100%;">
          Cancel
        </button>
        
        {#if validation.isComplete}
          <button class="btn btn-primary" on:click={() => dispatch('complete')} style="max-width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
            Submit {poemTypesDict[settings.poemType].name}
          </button>
        {:else}
          <button class="btn btn-primary btn-disabled" disabled style="max-width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
            Complete Your {poemTypesDict[settings.poemType].name}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Settings container with slide transition */
  .editor-container {
    position: relative;
    overflow: hidden;
    width: 100%;
    min-height: 500px;
    height: auto;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.3s, color 0.3s;
  }
  
  .editor-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
  }
  
  .editor-panel { transform: translateX(0); }

  textarea {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    line-height: 1.8;
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 14px 18px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }
  
  .poem-type-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .poem-type-name {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .poem-type-pattern {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-family: 'Courier New', monospace;
  }
  
  
  
  .syllable-indicators {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  
  
  
  
  
  /* Main header styles */
  .main-header {
    text-align: center;
    margin-bottom: 24px;
  }
  
  .main-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }
  
  .main-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  /* Action buttons */
  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
  
  
  
  
  
  
  
  /* Focus mode styles */
  .focus-mode {
    position: relative;
  }
  /* Gentle error pulse for focus mode */
  .error-pulse {
    animation: pulseBorder 200ms ease-in-out 2;
  }
  @keyframes pulseBorder {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0); }
    50% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25); }
  }
  
  
  
  .progress-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--bg-tertiary);
    border-radius: 2px 2px 0 0;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    transform-origin: left center;
    transition: transform 0.3s ease, background-color 0.2s ease;
    border-radius: 2px 2px 0 0;
  }
  
  .progress-bar.in-progress {
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
  }
  
  .progress-bar.complete {
    background: linear-gradient(90deg, #10b981, #059669);
  }
  
  .progress-bar.over-limit {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }
  
  .focus-textarea {
    border-top: 3px solid transparent;
    border-radius: 0 0 8px 8px;
    outline: none;
  }

  .line-guide {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .ephemeral {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    opacity: 0.9;
  }
  
  /* Responsive styles */
  @media (max-width: 768px) {
    .editor-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .syllable-indicators {
      gap: 6px;
    }
    
    .action-buttons { flex-direction: column; align-items: stretch; }
    
    .btn { width: 100%; justify-content: center; }
    
    .main-title {
      font-size: 1.1rem;
    }
    
    .main-subtitle {
      font-size: 0.8rem;
    }
  }
  
  @media (max-width: 480px) {
    .editor-header {
      padding: 8px 12px;
    }
    
    .syllable-indicators {
      flex-wrap: wrap;
      gap: 4px;
    }
    
    .main-header {
      margin-bottom: 16px;
    }
  }
</style>