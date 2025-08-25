<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { validateHaiku, countHaikuSyllables, initializeSyllableCounter } from '../onnx-syllable-counter.js';
  import { settingsStore, defaultSettings } from '$lib/stores/settings.js';
  import { poemTypes } from '../poemTypes.js';

  export let title = '';
  export let content = '';
  
  const dispatch = createEventDispatcher();
  
  /** @type {typeof defaultSettings} */
  let settings = defaultSettings;
  let step = 'title'; // 'title' or 'content'
  /** @type {HTMLTextAreaElement} */
  let textareaElement;
  /** @type {HTMLDivElement} */
  let containerElement;
  /** @type {number[]} */
  let syllableCounts = [];
  let isExpanded = false;
  
  // Input handling state from HaikuEditor
  let isShaking = false;
  let isProcessingOverLimit = false;
  let lastValidationTime = 0;
  let isInputBlocked = false;
  let isTemporarilyBlocked = false;
  let isLockedOverLimit = false;
  let lastWordSubmissionValidation = '';
  
  // Subscribe to settings
  const unsubscribeSettings = settingsStore.subscribe((s) => settings = s);
  
  // Get current poem type configuration
  $: currentPoemType = poemTypes[/** @type {keyof typeof poemTypes} */(settings.poemType || 'haiku')] || poemTypes.haiku;
  $: expectedSyllables = currentPoemType.syllables;
  $: expectedLines = expectedSyllables.length;
  $: maxLines = expectedLines;
  
  // Initialize syllable counts based on poem type
  $: {
    if (syllableCounts.length !== maxLines) {
      syllableCounts = new Array(maxLines).fill(0);
    }
  }
  
  // When auto-backspace is disabled, lock input (except navigation/deletion) while over the limit
  $: isLockedOverLimit = !settings.autoBackspace && syllableCounts.some((count, index) => count > expectedSyllables[index]);
  $: isInputBlocked = isTemporarilyBlocked || isLockedOverLimit;
  
  // Calculate dynamic height based on poem type
  $: titleHeight = 60; // Height for title input
  $: lineHeight = 32; // Approximate height per line
  $: padding = 24; // Container padding
  $: expandedHeight = titleHeight + (expectedLines * lineHeight) + padding + 40; // Extra space for title when shrunk
  
  // Handle title submission
  async function handleTitleSubmit() {
    if (!title.trim()) return;
    
    step = 'content';
    isExpanded = true;
    
    // Focus the textarea after expansion
    await tick();
    if (textareaElement) {
      textareaElement.focus();
    }
  }
  
  // Reactive syllable counting (predictive, real-time)
  $: {
    if (content !== undefined && step === 'content') {
      updateSyllableCounts(content).catch(error => {
        console.error('Syllable counting error:', error);
      });
    }
  }
  
  // Predictive syllable counting for real-time feedback
  /** @param {string} text */
  async function updateSyllableCounts(text) {
    try {
      syllableCounts = await countHaikuSyllables(text, expectedSyllables);
      dispatch('syllables', { counts: syllableCounts, expected: expectedSyllables });
      // Ensure overall validation reacts to any content change (not only on spaces)
      const overall = await validateHaiku(text, expectedSyllables, currentPoemType.name);
      dispatch('validation', overall);
    } catch (error) {
      console.error('Syllable counting error:', error);
      syllableCounts = new Array(maxLines).fill(0);
      dispatch('validation', { isValid: false, isComplete: false, feedback: '' });
    }
  }
  
  // Word submission validation - only triggered when space is pressed
  /** @param {string} text */
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
        if (settings.enableShake) {
          // Just shake if auto-backspace is disabled but shake is enabled
          shakeWindow();
        }
      }
      
      // Dispatch validation result
      const validation = await validateHaiku(text, expectedSyllables, currentPoemType.name);
      dispatch('validation', validation);
      
      // Store the text for this validation to avoid duplicate validations
      lastWordSubmissionValidation = text;
      
    } catch (error) {
      console.error('Validation error:', error);
      dispatch('validation', { isValid: false, isComplete: false, feedback: 'Validation error' });
    }
  }
  
  /** @param {string} text @param {number} cursorPos */
  function getCurrentLineIndex(text, cursorPos) {
    const beforeCursor = text.substring(0, cursorPos);
    const lineBreaks = (beforeCursor.match(/\n/g) || []).length;
    return Math.min(lineBreaks, maxLines - 1); // Cap at last line
  }
  
  function handleOverLimit() {
    if (isProcessingOverLimit) return;
    
    isProcessingOverLimit = true;
    
    if (textareaElement) {
      const currentPos = textareaElement.selectionStart;
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
          if (currentLineIndex < maxLines - 1) {
            const beforeCursor = content.substring(0, currentPos);
            const afterCursor = content.substring(currentPos);
            content = beforeCursor + '\n' + afterCursor;
            
            // Set cursor position after the newline
            setTimeout(() => {
              textareaElement.setSelectionRange(currentPos + 1, currentPos + 1);
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
            textareaElement.setSelectionRange(newPos, newPos);
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
  
  // Handle keydown events with full HaikuEditor logic
  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (step === 'title' && event.key === 'Enter') {
      event.preventDefault();
      handleTitleSubmit();
      return;
    }
    
    if (step !== 'content' || !textareaElement) return;
    
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
    
    const cursorPos = textareaElement.selectionStart;
    
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
              textareaElement.setSelectionRange(spacePos + 1, spacePos + 1);
            }, 0);
          }
        }, 10);
      }
      return;
    }
    
    // Handle ENTER - strict line limit enforcement
    if (event.key === 'Enter') {
      // Count existing newlines
      const newlineCount = (content.match(/\n/g) || []).length;
      
      // Block if we're at or would exceed the line limit
      if (newlineCount >= maxLines - 1) {
        event.preventDefault();
        if (settings.enableShake) {
          shakeWindow();
        }
        return;
      }
      
      // Allow newline if under limit and at syllable boundary
      if (currentSyll === expectedSyll && !isAtWordBoundary) {
        event.preventDefault();
        
        if (currentLineIndex < maxLines - 1) {
          // Insert newline and move to next line
          const beforeCursor = content.substring(0, cursorPos);
          const afterCursor = content.substring(cursorPos);
          content = beforeCursor + '\n' + afterCursor;
          
          setTimeout(() => {
            textareaElement.setSelectionRange(cursorPos + 1, cursorPos + 1);
          }, 0);
        }
      }
      return;
    }
  }
  
  /** @param {ClipboardEvent} event */
  function handlePaste(event) {
    event.preventDefault();
    
    // Dispatch toast event to parent
    dispatch('toast', {
      message: "Hey! Keep it original! No plagiarism. 📝",
      type: 'warning'
    });
  }
  
  // Auto-resize textarea based on content
  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = Math.max(expectedLines * lineHeight, textareaElement.scrollHeight) + 'px';
    }
  }
  
  // Reset function
  export function reset() {
    step = 'title';
    isExpanded = false;
    title = '';
    content = '';
    syllableCounts = [];
  }
  
  onMount(async () => {
    try {
      await initializeSyllableCounter();
    } catch (error) {
      console.error('Failed to initialize syllable counter:', error);
    }
  });
  
  // Cleanup
  import { onDestroy } from 'svelte';
  onDestroy(() => unsubscribeSettings());
</script>

<div 
  bind:this={containerElement}
  class="unified-input-container"
  class:expanded={isExpanded}
  class:animate-shake={isShaking}
  style="--title-height: {titleHeight}px; --expanded-height: {expandedHeight}px; --expected-lines: {expectedLines};"
>
  <!-- Title when expanded (shrunk and positioned top-left) -->
  {#if step === 'content' && title}
    <div class="title-shrunk">
      {title}
    </div>
  {/if}
  
  <!-- Unified text input -->
  <div class="input-wrapper" class:content-mode={step === 'content'}>
    {#if step === 'title'}
      <input
        bind:value={title}
        on:keydown={handleKeydown}
        placeholder={`Give your ${currentPoemType.name.toLowerCase()} a title...`}
        maxlength="40"
        class="title-input"
        autocomplete="off"
        aria-label={`${currentPoemType.name} title`}
      />
      {#if title.trim()}
        <button 
          class="submit-button"
          on:click={handleTitleSubmit}
          aria-label={`Start writing ${currentPoemType.name.toLowerCase()}`}
        >
          →
        </button>
      {/if}
    {:else}
      <textarea
        bind:this={textareaElement}
        bind:value={content}
        on:input={autoResize}
        on:focus={() => autoResize()}
        on:keydown={handleKeydown}
        on:paste={handlePaste}
        placeholder="Write your {currentPoemType.name.toLowerCase()} here..."
        class="content-textarea {isInputBlocked ? 'opacity-50 pointer-events-none' : ''}"
        rows={expectedLines}
        autocomplete="off"
        spellcheck="false"
      ></textarea>
    {/if}
  </div>
</div>

<style>
  .unified-input-container {
    position: relative;
    width: 100%;
    height: var(--title-height);
    background: var(--bg-primary, #ffffff);
    border: 2px solid var(--border-color, #e5e7eb);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  
  .unified-input-container.expanded {
    height: var(--expanded-height);
    padding-top: 50px; /* Make room for shrunk title */
  }
  
  /* Keep container border always visible - don't hide on focus/hover */
  
  .title-shrunk {
    position: absolute;
    top: 16px;
    left: 16px;
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary, #1f2937);
    opacity: 0;
    transform: translateY(10px);
    animation: slideInTitle 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
  }
  
  @keyframes slideInTitle {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .input-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .input-wrapper.content-mode {
    align-items: flex-start;
    padding-top: 8px;
  }
  
  .title-input,
  .content-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none !important;
    font-family: inherit;
    color: var(--text-primary, #1f2937);
    resize: none;
  }
  
  /* Ensure NO outlines on focus for any input/textarea */
  .title-input:focus,
  .content-textarea:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  .title-input {
    font-size: 24px;
    text-align: center;
    font-weight: 500;
  }
  
  .title-input::placeholder {
    color: var(--text-tertiary, #9ca3af);
  }
  
  .content-textarea {
    font-size: 18px;
    line-height: 1.8;
    min-height: calc(var(--expected-lines) * 32px);
    max-height: calc(var(--expected-lines) * 32px);
    overflow: hidden; /* No scrollbars */
  }
  
  .content-textarea::placeholder {
    color: var(--text-tertiary, #9ca3af);
  }
  
  .submit-button {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.2s ease;
  }
  
  .submit-button:hover {
    background: var(--primary-hover, #2563eb);
    transform: translateY(-50%) scale(1.05);
  }
  
  /* Shake animation */
  .animate-shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  
  @keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .unified-input-container {
      background: var(--bg-primary, #1f2937);
      border-color: var(--border-color, #374151);
    }
    
    .title-input,
    .content-textarea {
      color: var(--text-primary, #f9fafb);
    }
    
    .title-shrunk {
      color: var(--text-primary, #f9fafb);
    }
  }
</style>
