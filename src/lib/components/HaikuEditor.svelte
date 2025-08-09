<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { validateHaiku, countHaikuSyllables, initializeSyllableCounter } from '../onnx-syllable-counter.js';
  import confetti from 'canvas-confetti';
  
  export let content = '';
  export let placeholder = 'Write your haiku here...';
  
  const dispatch = createEventDispatcher();
  const expectedSyllables = [5, 7, 5];
  
  let textarea;
  let syllableCounts = [0, 0, 0];
  let isShaking = false;
  let isProcessingOverLimit = false;
  let lastValidationTime = 0;
  let hasTriggeredConfetti = false;
  let isInputBlocked = false;
  
  // Reactive validation
  $: {
    if (content !== undefined) {
      validateContent(content).catch(error => {
        console.error('Reactive validation error:', error);
      });
    }
  }
  
  async function validateContent(text) {
    const now = performance.now();
    lastValidationTime = now;
    
    try {
      // Update syllable counts
      syllableCounts = await countHaikuSyllables(text);
      
      // Dispatch validation result
      const validation = await validateHaiku(text);
      dispatch('validation', validation);
      
      // Trigger confetti when they achieve perfect haiku structure
      if (validation.isValid && !hasTriggeredConfetti) {
        hasTriggeredConfetti = true;
        confetti({
          particleCount: 30,
          spread: 45,
          origin: { y: 0.7 },
          colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
        });
      } else if (!validation.isValid) {
        hasTriggeredConfetti = false;
      }
      

    } catch (error) {
      console.error('Validation error:', error);
      // Fallback to basic validation
      syllableCounts = [0, 0, 0];
      dispatch('validation', { isValid: false, isComplete: false, feedback: 'Validation error' });
    }
  }
  
  function getCurrentLineIndex(text, cursorPos) {
    const beforeCursor = text.substring(0, cursorPos);
    const lineBreaks = (beforeCursor.match(/\n/g) || []).length;
    return Math.min(lineBreaks, 2); // Cap at line 2 (third line)
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
        const words = currentLine.split(' ');
        const lastWord = words[words.length - 1] || '';
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
    
          // Find the last word boundary before the current position
          let lastWordBoundary = currentPos;
          while (lastWordBoundary > lineStart && 
                 content[lastWordBoundary - 1] !== ' ' && 
                 content[lastWordBoundary - 1] !== '\n') {
            lastWordBoundary--;
          }
          
          // Get content up to the last word boundary
          const lineContent = content.substring(lineStart, lastWordBoundary);
          const validWords = lineContent.split(' ').filter(w => w.length > 0);
          
          // Join words and ensure proper spacing
          const validLine = validWords.join(' ');
          const cursorLine = validLine.trimEnd();
          const newContent = validLine + (validLine.length > 0 ? ' ' : '');
          
          // Construct the new content
          const beforeLine = content.substring(0, lineStart);
          const afterCursor = content.substring(currentPos);
          content = beforeLine + newContent + afterCursor;
          
          // Set cursor position at the end of the last valid word
          const newPos = lineStart + cursorLine.length;
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

    
    // Only enforce on first 3 lines
    if (currentLineIndex >= 3) {

      return;
    }
    
    const expectedSyll = expectedSyllables[currentLineIndex];
    const currentSyll = syllableCounts[currentLineIndex] || 0;
    

    
    // Check if we're at a word boundary (space or newline before cursor)
    const isAtWordBoundary = cursorPos === 0 || 
                            content[cursorPos - 1] === ' ' || 
                            content[cursorPos - 1] === '\n';
    
    // Handle SPACE and ENTER at syllable limits
    if ((event.key === ' ' || event.key === 'Enter') && currentSyll === expectedSyll && !isAtWordBoundary) {

      event.preventDefault();
      
      if (currentLineIndex < 2) {
        // Insert newline and move to next line
        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);
        content = beforeCursor + '\n' + afterCursor;
        
        setTimeout(() => {
          textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
        }, 0);
      } else {
        // At line 3 limit - shake to indicate no more lines
        shakeWindow();
      }
      return;
    }
    
    // Allow typing to continue - validation will catch up and handle over-limit
    if (currentSyll > expectedSyll && !isAtWordBoundary) {

      // Don't prevent default - let the user keep typing
      shakeWindow();
      return;
    }
    
    // Allow input if under the limit

  }
  
  function shakeWindow() {
    if (isShaking) {

      return;
    }
    

    isShaking = true;
    isInputBlocked = true;
    
    // Shake animation ends after 500ms
    setTimeout(() => {
      isShaking = false;
    }, 500);
    
    // Input blocking continues for 1 second total
    setTimeout(() => {
      isInputBlocked = false;
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
  
  // Watch for over-limit conditions after validation
  $: {
    if (syllableCounts.some((count, index) => count > expectedSyllables[index])) {
      // Delay to allow typing to complete
      setTimeout(() => {
        if (syllableCounts.some((count, index) => count > expectedSyllables[index])) {
          handleOverLimit();
        }
      }, 50);
    }
  }
  
  onMount(async () => {
    // Initialize the ONNX model
    try {
      await initializeSyllableCounter();

    } catch (error) {
      console.error('Failed to initialize ONNX syllable counter:', error);
    }
    
    if (textarea) {
      textarea.focus();
    }
  });
</script>

<div class="relative {isShaking ? 'animate-shake' : ''} {isInputBlocked ? 'input-blocked' : ''}">
  <!-- Syllable indicators -->
  <div class="flex gap-2 mb-4">
    {#each syllableCounts as count, index}
      <div class="syllable-indicator {count === expectedSyllables[index] ? 'syllable-perfect' : count > expectedSyllables[index] ? 'syllable-over' : 'syllable-under'}">
        Line {index + 1}: {count}/{expectedSyllables[index]}
      </div>
    {/each}
  </div>
  
  <!-- Haiku editor -->
  <textarea
    bind:this={textarea}
    bind:value={content}
    on:keydown={handleKeydown}
    on:paste={handlePaste}
    {placeholder}
    class="zen-textarea"
    rows="6"
    autocomplete="off"
    spellcheck="false"
  ></textarea>
</div>

<style>
  textarea {
    font-family: 'Georgia', serif;
    line-height: 1.8;
  }
  
  .input-blocked {
    opacity: 0.4;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
  }
  
  .input-blocked textarea {
    cursor: not-allowed;
  }
</style>