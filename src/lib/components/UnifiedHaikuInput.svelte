<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { validateHaiku, countHaikuSyllables } from '../onnx-syllable-counter.js';
  import { settingsStore, defaultSettings } from '$lib/stores/settings.js';
  import { poemTypes } from '../poemTypes.js';
  import { convertTextToSpeechWithTiming, playAudioWithWordTiming, streamTextToSpeechWithTiming, simpleTextToSpeechWithTiming, isValidApiKey } from '../elevenlabs-tts.js';
  import { Volume2, VolumeX } from 'lucide-svelte';

  export let title = '';
  export let content = '';
  
  const dispatch = createEventDispatcher();
  
  // Track validation state for submit button
  let validation = { isValid: false, isComplete: false, feedback: '' };
  
  // Debounced validation state for UI elements (300ms delay)
  let debouncedValidation = { isValid: false, isComplete: false, feedback: '' };
  /** @type {ReturnType<typeof setTimeout> | null} */
  let validationTimeout = null;
  
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
  
  // TTS state
  let isPlaying = false;
  let highlightedWordIndex = -1;
  /** @type {Array<{word: string, index: number, isHighlighted: boolean, isNonWord?: boolean, isSpace?: boolean, x?: number, y?: number, width?: number, height?: number, lineIndex?: number}>} */
  let currentWords = []; // Store parsed words for highlighting
  /** @type {HTMLCanvasElement | null} */
  let highlightCanvas; // Reference to canvas element
  /** @type {HTMLAudioElement | null} */
  let currentAudio = null;
  /** @type {string[]} */
  let words = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  let clearHighlightTimeoutId = null;
  
  // Simple highlighting - just use reactive variables
  // No complex DOM manipulation needed!
  
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
  
  // Update debounced validation for UI elements (300ms delay)
  /** @param {{ isValid: boolean, isComplete: boolean, feedback: string }} newValidation */
  function updateDebouncedValidation(newValidation) {
    // Clear existing timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    
    // Debounce validation updates for UI (300ms delay)
    validationTimeout = setTimeout(() => {
      debouncedValidation = { ...newValidation };
    }, 300);
  }

  // Handle haiku submission
  function handleHaikuSubmit() {
    if (validation.isValid && validation.isComplete) {
      dispatch('haikuSubmit', { 
        title, 
        content, 
        isComplete: validation.isComplete 
      });
    }
  }
  
  // Handle TTS toggle
  async function handleTTSToggle() {
    if (!settings.enableTTS) {
      dispatch('toast', {
        message: 'Text-to-speech is disabled in Settings.',
        type: 'warning'
      });
      return;
    }
    
    if (!isValidApiKey(settings.elevenlabsApiKey)) {
      dispatch('toast', {
        message: 'Add your ElevenLabs API key in Settings to enable text-to-speech.',
        type: 'warning'
      });
      return;
    }
    
    if (isPlaying) {
      stopTTS();
    } else {
      await startTTS();
    }
  }
  


  // Start text-to-speech
  async function startTTS() {
    console.log('TTS start');
    if (!content.trim() || !settings.enableTTS || !isValidApiKey(settings.elevenlabsApiKey)) return;
    
    try {
      cancelScheduledClearHighlighting();
      isPlaying = true;
      highlightedWordIndex = -1;
      
      const textToSpeak = content;
      
      // Prefer low-latency streaming playback with timing
      // Parse text into words for highlighting
      currentWords = parseTextIntoWords(textToSpeak);

      // Set playing state
      isPlaying = true;

      // Wait for canvas to render, then setup highlighting
      await tick();
      if (highlightCanvas && textareaElement) {
        setupCanvasHighlighting();
      }

      // Try the SIMPLE approach first (non-streaming, from working example)
      await simpleTextToSpeechWithTiming(
        textToSpeak,
        settings.elevenlabsApiKey,
        (/** @type {number} */ wordIndex, /** @type {number} */ lineIndex) => {
          highlightedWordIndex = wordIndex;
        },
        {
          pauseDuration: settings.ttsPauseDuration || 1.0
        }
      );

      // Audio finished playing (handled internally by streaming function)
      isPlaying = false;
      console.log('TTS completed');
      
    } catch (err) {
      console.error('TTS Error:', err);
      isPlaying = false;
      
      // Show specific error message
      let errorMessage = 'Text-to-speech failed. ';
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage += 'Please check your API key in Settings.';
      } else if (error.message.includes('429')) {
        errorMessage += 'API rate limit exceeded. Please try again later.';
      } else if (error.message.includes('quota')) {
        errorMessage += 'API quota exceeded. Please check your ElevenLabs account.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage += 'Network error. Please check your connection.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      dispatch('toast', {
        message: errorMessage,
        type: 'error'
      });
    }
  }
  
  // Stop text-to-speech
  function stopTTS() {
    // For Web Audio API implementation, we can't directly stop playback
    // The streaming function handles cleanup internally
    // Just reset UI state
    console.log('TTS stop');
    isPlaying = false;
    currentAudio = null;
  }
  
  function scheduleClearHighlighting(delay = 3000) {
    cancelScheduledClearHighlighting();
    clearHighlightTimeoutId = setTimeout(() => {
      highlightedWordIndex = -1;
      if (highlightCanvas) {
        const ctx = highlightCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        }
      }
      clearHighlightTimeoutId = null;
    }, delay);
  }
  
  function cancelScheduledClearHighlighting() {
    if (clearHighlightTimeoutId) {
      clearTimeout(clearHighlightTimeoutId);
      clearHighlightTimeoutId = null;
    }
  }

  /**
   * Parse text into words for highlighting (similar to ElevenLabs approach)
   */
  /**
   * @param {string} text
   * @returns {Array<{word: string, index: number, isHighlighted: boolean, isNonWord?: boolean, isSpace?: boolean}>}
   */
  function parseTextIntoWords(text) {
    const words = [];
    let currentWord = '';
    let wordIndex = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char.trim() === '' || ['.', ',', '?', '!', ';', ':', '\n'].includes(char)) {
        // End of a word
        if (currentWord !== '') {
          words.push({
            word: currentWord,
            index: wordIndex,
            isHighlighted: false
          });
          wordIndex++;
          currentWord = '';
        }
        
        // Add non-word characters as separate items
        if (char !== ' ') {
          words.push({
            word: char,
            index: -1, // Non-word items don't get highlighted
            isHighlighted: false,
            isNonWord: true
          });
        } else {
          words.push({
            word: ' ',
            index: -1,
            isHighlighted: false,
            isSpace: true
          });
        }
      } else {
        currentWord += char;
      }
    }
    
    // Add the last word if any
    if (currentWord !== '') {
      words.push({
        word: currentWord,
        index: wordIndex,
        isHighlighted: false
      });
    }
    
    return words;
  }

  // Reactive statement to update highlighting
  $: if (currentWords.length > 0 && highlightedWordIndex >= 0) {
    currentWords = currentWords.map(item => ({
      ...item,
      isHighlighted: item.index === highlightedWordIndex
    }));
    
    // Draw highlights on canvas
    if (highlightCanvas) {
      drawCanvasHighlights();
    }

    // Reset a 1s clear timer on each index update; if updates stop, clear
    scheduleClearHighlighting(1000);
  }

  /**
   * Setup canvas-based highlighting with pixel-perfect measurements
   */
  function setupCanvasHighlighting() {
    if (!highlightCanvas || !textareaElement) return;
    
    // Get textarea dimensions and styles
    const rect = textareaElement.getBoundingClientRect();
    const styles = window.getComputedStyle(textareaElement);
    
    // Setup canvas to match textarea exactly
    highlightCanvas.width = rect.width;
    highlightCanvas.height = rect.height;
    highlightCanvas.style.width = rect.width + 'px';
    highlightCanvas.style.height = rect.height + 'px';
    
    const ctx = highlightCanvas.getContext('2d');
    if (!ctx) return;
    
    // Copy font properties to canvas context
    ctx.font = `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    ctx.textBaseline = 'top';
    
    // Calculate word positions using canvas measurements
    calculateWordPositions(ctx, styles);
    
    // Canvas highlighting initialized
  }

  /**
   * Calculate exact pixel positions for each word using canvas measurements
   */
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {CSSStyleDeclaration} styles
   */
  function calculateWordPositions(ctx, styles) {
    const padding = {
      left: parseFloat(styles.paddingLeft),
      top: parseFloat(styles.paddingTop)
    };
    const lineHeight = parseFloat(styles.lineHeight);
    
    let x = padding.left;
    let y = padding.top;
    let lineIndex = 0;
    
    // Add position data to each word
    currentWords = currentWords.map(wordItem => {
      if (wordItem.isSpace) {
        const spaceWidth = ctx.measureText(' ').width;
        x += spaceWidth;
        return { ...wordItem, x, y, width: spaceWidth, height: lineHeight };
      } else if (wordItem.word === '\n') {
        // New line
        x = padding.left;
        y += lineHeight;
        lineIndex++;
        return { ...wordItem, x, y, width: 0, height: lineHeight };
      } else {
        // Regular word or punctuation
        const metrics = ctx.measureText(wordItem.word);
        const wordWidth = metrics.width;
        const wordX = x;
        
        x += wordWidth;
        
        return { 
          ...wordItem, 
          x: wordX, 
          y, 
          width: wordWidth, 
          height: lineHeight,
          lineIndex 
        };
      }
    });
    
    // Word positions calculated
  }

  /**
   * Draw highlights on canvas using calculated positions
   */
  function drawCanvasHighlights() {
    if (!highlightCanvas) return;
    
    const ctx = highlightCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    
    // Draw highlights for highlighted words
    currentWords.forEach(wordItem => {
      if (
        wordItem.isHighlighted &&
        wordItem.x !== undefined &&
        wordItem.y !== undefined &&
        wordItem.width !== undefined &&
        wordItem.height !== undefined
      ) {
        const padding = 3;
        const borderRadius = 4;
        const x = wordItem.x - padding;
        const y = wordItem.y + 1;
        const width = wordItem.width + (padding * 2);
        const height = wordItem.height - 2;
        
        // Create rounded rectangle path
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, borderRadius);
        
        // Fill with green gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)'); // green-500 with transparency
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.35)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add subtle green border
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Add inner glow effect
        ctx.beginPath();
        ctx.roundRect(x + 0.5, y + 0.5, width - 1, height - 1, borderRadius - 0.5);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Drew green highlight
      }
    });
  }



  // Simple highlighting - just update reactive variable
  /** @param {number} wordIndex @param {string} text */
  function updateHighlighting(wordIndex, text) {
    // Highlighting is now handled by Svelte reactivity
  }
  
  // Dispatch cursor position for scrolling indicators
  function dispatchCursorPosition() {
    if (!textareaElement) return;
    
    const cursorPos = textareaElement.selectionStart;
    const beforeCursor = content.substring(0, cursorPos);
    const lineBreaks = (beforeCursor.match(/\n/g) || []).length;
    const currentLine = Math.min(lineBreaks, maxLines - 1);
    
    dispatch('cursorMove', { cursorLine: currentLine });
  }
  
  // Reactive syllable counting (predictive, real-time)
  $: {
    if (content !== undefined && step === 'content') {
      updateSyllableCounts(content).catch(error => {
        console.error('Syllable counting error:', error);
        // Dispatch error to parent component
        dispatch('toast', {
          message: 'Syllable counting failed. Please refresh the page.',
          type: 'error'
        });
        // Also throw the error to trigger global error handler
        throw error;
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
      validation = overall; // Store for submit button state
      dispatch('validation', overall);
      
      // Update debounced validation for UI elements
      updateDebouncedValidation(overall);
    } catch (error) {
      console.error('Syllable counting error:', error);
      syllableCounts = new Array(maxLines).fill(0);
      const errorValidation = { isValid: false, isComplete: false, feedback: '' };
      dispatch('validation', errorValidation);
      updateDebouncedValidation(errorValidation);
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
      const validationResult = await validateHaiku(text, expectedSyllables, currentPoemType.name);
      validation = validationResult; // Store for submit button state
      dispatch('validation', validationResult);
      
      // Update debounced validation for UI elements
      updateDebouncedValidation(validationResult);
      
      // Store the text for this validation to avoid duplicate validations
      lastWordSubmissionValidation = text;
      
    } catch (error) {
      console.error('Validation error:', error);
      const errorValidation = { isValid: false, isComplete: false, feedback: 'Validation error' };
      validation = errorValidation;
      dispatch('validation', errorValidation);
      updateDebouncedValidation(errorValidation);
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
      // Allow navigation and deletion keys during blocking
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
    
    // Allow special keys (including navigation)
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown',
      'Backspace', 'Delete', 'Tab', 'Escape'
    ];
    
    if (allowedKeys.includes(event.key)) {
      // Dispatch cursor position for navigation keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        setTimeout(() => dispatchCursorPosition(), 0);
      }
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
    
    // Handle ENTER - submit if haiku is complete, otherwise strict line limit enforcement
    if (event.key === 'Enter') {
      // If haiku is complete, submit it
      if (validation.isValid && validation.isComplete) {
        event.preventDefault();
        handleHaikuSubmit();
        return;
      }
      
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
  
  // Update content and trigger validation
  /** @param {string} newContent */
  export function updateContent(newContent) {
    content = newContent;
    isExpanded = true;
    step = 'content';
    
    // The reactive statement will automatically handle syllable counting and validation
    // when content changes, so no need to manually trigger it
  }
  
  // Note: Syllable counter initialization is handled by the parent component
  
  // Cleanup
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    unsubscribeSettings();
    cancelScheduledClearHighlighting();
  });
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
  
  <!-- TTS Speaker Icon (top-right when content exists and TTS is enabled) -->
  {#if step === 'content' && content.trim() && settings.enableTTS}
    <button 
      class="tts-button"
      class:playing={isPlaying}
      class:has-api-key={isValidApiKey(settings.elevenlabsApiKey)}
      on:click={handleTTSToggle}
      aria-label={isPlaying ? 'Stop speech' : isValidApiKey(settings.elevenlabsApiKey) ? 'Speak haiku aloud' : 'Add ElevenLabs API key in Settings to enable speech'}
      title={isPlaying ? 'Stop speech' : isValidApiKey(settings.elevenlabsApiKey) ? 'Speak haiku aloud' : 'Add ElevenLabs API key in Settings to enable speech'}
    >
      {#if isPlaying}
        <VolumeX class="w-4 h-4" />
      {:else}
        <Volume2 class="w-4 h-4" />
      {/if}
    </button>
  {/if}
  
  <!-- Unified text input -->
  <div class="input-wrapper" class:content-mode={step === 'content'}>
    {#if step === 'title'}
      <input
        bind:value={title}
        on:keydown={handleKeydown}
        placeholder={`Give your ${currentPoemType.name.toLowerCase()} a title`}
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
      <div class="textarea-container">
        <!-- Debug info removed - highlighting working perfectly! -->

        <!-- Canvas-based highlighting overlay -->
        {#if currentWords.length > 0}
          <canvas 
            bind:this={highlightCanvas}
            class="highlight-canvas"
            style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 5;"
          ></canvas>
        {:else if highlightedWordIndex >= 0}
          <div class="simple-highlight">
            Word {highlightedWordIndex} is being spoken
          </div>
        {/if}
        
        <textarea
          bind:this={textareaElement}
          bind:value={content}
          on:input={autoResize}
          on:focus={() => autoResize()}
          on:keydown={handleKeydown}
          on:paste={handlePaste}
          on:click={dispatchCursorPosition}
          on:keyup={dispatchCursorPosition}
          placeholder="Write your {currentPoemType.name.toLowerCase()} here..."
          class="content-textarea {isInputBlocked ? 'opacity-50 pointer-events-none' : ''}"
          class:has-highlight={highlightedWordIndex >= 0}
          rows={expectedLines}
          autocomplete="off"
          spellcheck="false"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        ></textarea>
      </div>
      
      <!-- Submit button for completed haiku -->
      {#if debouncedValidation.isValid && debouncedValidation.isComplete}
        <button 
          class="haiku-submit-button"
          on:click={handleHaikuSubmit}
          aria-label="Submit {currentPoemType.name.toLowerCase()}"
          title="Submit your {currentPoemType.name.toLowerCase()}"
        >
          <span class="submit-text">submit</span>
          <span class="submit-tick">✓</span>
        </button>
      {/if}
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
  
  /* Haiku submit button - appears at bottom right corner when valid */
  .haiku-submit-button {
    position: absolute;
    bottom: 8px;
    right: 8px;
    height: 32px;
    padding: 0 12px;
    background: #10b981; /* Green-500 */
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: submitButtonAppear 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .haiku-submit-button:hover {
    background: #059669; /* Green-600 */
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }
  
  .haiku-submit-button:active {
    transform: scale(0.98);
  }
  
  .submit-text {
    font-size: 14px;
    font-weight: 500;
  }
  
  .submit-tick {
    font-size: 12px;
    font-weight: bold;
  }
  
  @keyframes submitButtonAppear {
    0% {
      opacity: 0;
      transform: scale(0.5) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
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
  
  /* TTS Button */
  .tts-button {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #9ca3af);
    transition: all 0.3s ease;
    z-index: 10;
    opacity: 0.6;
  }
  
  .tts-button:hover {
    background: var(--bg-secondary, #f3f4f6);
    border: 1px solid var(--border-color, #e5e7eb);
    color: var(--text-primary, #1f2937);
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .tts-button:not(.has-api-key):hover {
    background: transparent;
    border: none;
    color: var(--text-secondary, #9ca3af);
    transform: none;
    box-shadow: none;
    opacity: 0.4;
    cursor: help;
  }
  
  .tts-button.playing {
    background: #ef4444; /* Red-500 */
    color: white;
    border: 1px solid #ef4444;
    opacity: 1;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }
  
  .tts-button.playing:hover {
    background: #dc2626; /* Red-600 */
    border-color: #dc2626;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }
  

  
  /* Textarea Container for Character Highlighting */
  .textarea-container {
    position: relative;
    width: 100%;
    height: 100%;
    /* Shared typography metrics for textarea and overlay to ensure perfect alignment */
    --content-font-size: 18px;
    --content-line-height: 1.8;
    --content-padding-block: 8px;
    --content-padding-inline: 16px;
  }

  .simple-highlight {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(59, 130, 246, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10;
    pointer-events: none;
    animation: pulse 1s infinite;
  }

  .highlight-text-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: var(--content-padding-block) var(--content-padding-inline);
    
    /* Match textarea font properties EXACTLY */
    font-family: var(--font-mono);
    font-size: var(--content-font-size);
    font-weight: inherit;
    font-style: inherit;
    font-variant: inherit;
    line-height: var(--content-line-height);
    letter-spacing: inherit;
    word-spacing: inherit;
    text-rendering: inherit;
    
    /* Match textarea text behavior */
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: inherit;
    text-align: inherit;
    
    /* Overlay properties */
    pointer-events: none;
    z-index: 5;
    color: transparent;
    background: transparent;
    border: 1px solid transparent;
    box-sizing: border-box;
    overflow: hidden;
    
    /* Force same rendering as textarea */
    -webkit-font-smoothing: inherit;
    -moz-osx-font-smoothing: inherit;
    text-size-adjust: inherit;
  }

  .highlight-text-overlay .word {
    color: transparent;
    background: transparent;
    transition: all 0.2s ease;
  }

  .highlight-text-overlay .word.highlighted {
    background: rgba(255, 235, 59, 0.4); /* Subtle yellow highlight */
    color: transparent; /* Keep text transparent, just show highlight */
    border-radius: 2px;
    padding: 0px 1px;
    box-shadow: 0 0 4px rgba(255, 235, 59, 0.3);
    animation: highlightPulse 0.3s ease-in-out;
  }

  .highlight-text-overlay .space {
    color: transparent;
  }

  .highlight-text-overlay .punctuation {
    color: transparent;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  @keyframes highlightPulse {
    0% { 
      background: rgba(255, 235, 59, 0.2);
      box-shadow: 0 0 2px rgba(255, 235, 59, 0.2);
    }
    50% { 
      background: rgba(255, 235, 59, 0.6);
      box-shadow: 0 0 6px rgba(255, 235, 59, 0.4);
    }
    100% { 
      background: rgba(255, 235, 59, 0.4);
      box-shadow: 0 0 4px rgba(255, 235, 59, 0.3);
    }
  }

  .content-textarea {
    position: relative;
    z-index: 2;
    width: 100% !important;
    height: 100% !important;
    padding: var(--content-padding-block, 8px) var(--content-padding-inline, 16px) !important;
    margin: 0 !important;
    border: none !important;
    outline: none !important;
    background: transparent;
    resize: none;
    font-family: inherit;
    font-size: var(--content-font-size, 18px);
    line-height: var(--content-line-height, 1.8);
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
    
    .tts-button {
      background: transparent;
      border: none;
      color: var(--text-secondary, #6b7280);
    }
    
    .tts-button:hover {
      background: var(--bg-secondary, #374151);
      border: 1px solid var(--border-color, #4b5563);
      color: var(--text-primary, #f9fafb);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .tts-button:not(.has-api-key):hover {
      background: transparent;
      border: none;
      color: var(--text-secondary, #6b7280);
      box-shadow: none;
      transform: none;
      opacity: 0.4;
    }
  }
</style>
