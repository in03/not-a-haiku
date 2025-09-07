/**
 * ElevenLabs Text-to-Speech integration using official SDK
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

/**
 * Adds pause break tags between lines for better TTS pacing
 * @param {string} text - Input text with line breaks
 * @param {number} pauseDuration - Pause duration in seconds (default 1.0)
 * @returns {string} Text with SSML break tags
 */
function addPauseBreaks(text, pauseDuration = 1.0) {
  // Replace newlines with SSML break tags
  // ElevenLabs supports <break time="1.0s" /> syntax
  return text.replace(/\n/g, `<break time="${pauseDuration}s" />\n`);
}

/**
 * SIMPLE non-streaming TTS with word timing using ElevenLabs convert_with_timestamps
 * Based on the working approach from elevenlabs-highlight-chatbot
 * @param {string} text - Text to convert to speech
 * @param {string} apiKey - ElevenLabs API key
 * @param {function} onWordHighlight - Callback for word highlighting (wordIndex, lineIndex)
 * @param {Object} options - Configuration options
 * @param {number} [options.pauseDuration] - Pause duration between lines in seconds
 * @returns {Promise<void>}
 */
export async function simpleTextToSpeechWithTiming(text, apiKey, onWordHighlight, options = {}) {
  console.log('🚀 Starting SIMPLE TTS with timing...');
  
  const voiceId = options.voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default voice
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  
  // Add pause breaks between lines if pauseDuration is specified
  const processedText = options.pauseDuration ? addPauseBreaks(text, options.pauseDuration) : text;
  console.log('📝 Text with breaks:', processedText);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: processedText,
        model_id: options.model || 'eleven_flash_v2_5'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Received TTS data:', {
      hasAudio: !!data.audio_base64,
      hasAlignment: !!data.alignment,
      alignmentKeys: data.alignment ? Object.keys(data.alignment) : []
    });

    // Parse word timing from character alignment (use original text, not processed)
    const words = parseWordAlignment(data.alignment, text);
    console.log('🎯 Parsed words:', words);

    // Convert base64 audio to blob
    const audioBlob = base64ToBlob(data.audio_base64, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // Play audio and highlight words
    audio.play();
    
    // Track current word highlighting
    const intervalId = setInterval(() => {
      const currentTime = audio.currentTime;
      let index = words.findIndex(word => 
        currentTime >= word.start_time && currentTime <= word.end_time
      );
      
      if (index !== -1) {
        console.log(`🎯 Highlighting word ${index}: "${words[index].word}" at ${currentTime.toFixed(2)}s`);
        onWordHighlight(index, 0); // Assume single line for now
      }
    }, 50); // Check every 50ms

    // Clear interval when audio ends
    audio.onended = () => {
      console.log('🎵 Audio ended, clearing highlights');
      clearInterval(intervalId);
      onWordHighlight(-1, -1); // Clear highlights
    };

  } catch (error) {
    console.error('❌ Simple TTS error:', error);
    throw error;
  }
}

/**
 * Convert base64 to Blob (from the working example)
 */
function base64ToBlob(base64, mime) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  const sliceSize = 1024;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: mime });
}

/**
 * Parse word alignment from ElevenLabs character timing (from working example)
 */
function parseWordAlignment(alignment, originalText) {
  if (!alignment || !alignment.characters) {
    console.warn('⚠️ No alignment data available');
    return [];
  }

  const characters = alignment.characters;
  const start_times = alignment.character_start_times_seconds;
  const end_times = alignment.character_end_times_seconds;
  
  console.log('📊 Alignment data:', {
    charCount: characters.length,
    startTimesCount: start_times.length,
    endTimesCount: end_times.length,
    firstFewChars: characters.slice(0, 20).join('')
  });

  const words = [];
  let current_word = '';
  let word_start_time = null;
  let word_end_time = null;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    
    if (char.trim() === '' || ['.', ',', '?', '!', ';', ':'].includes(char)) {
      // End of a word
      if (current_word !== '') {
        words.push({
          word: current_word,
          start_time: word_start_time,
          end_time: word_end_time
        });
        console.log(`  Word: "${current_word}" -> ${word_start_time}-${word_end_time}s`);
        current_word = '';
        word_start_time = null;
        word_end_time = null;
      }
    } else {
      if (current_word === '') {
        word_start_time = start_times[i];
      }
      current_word += char;
      word_end_time = end_times[i];
    }
  }

  // Add the last word if any
  if (current_word !== '') {
    words.push({
      word: current_word,
      start_time: word_start_time,
      end_time: word_end_time
    });
    console.log(`  Final word: "${current_word}" -> ${word_start_time}-${word_end_time}s`);
  }

  return words;
}

const DEFAULT_VOICE_ID = 'FMgBdHe1YV2Xi0B9anXW'; // https://elevenlabs.io/app/voice-library?voiceId=FMgBdHe1YV2Xi0B9anXW
const DEFAULT_MODEL_ID = 'eleven_flash_v2';

/**
 * Tokenize text with line information preserved
 * @param {string} text - Input text with line breaks
 * @returns {Array<{word: string, wordIndex: number, lineIndex: number}>}
 */
function tokenizeWithLines(text) {
  console.log('🔤 TTS Tokenizing text:', JSON.stringify(text));
  console.log('🔤 Raw text length:', text.length);
  const lines = text.split('\n');
  console.log('🔤 Split into lines:', lines.length, lines);
  /** @type {Array<{word: string, wordIndex: number, lineIndex: number}>} */
  const tokens = [];
  let wordIndex = 0;

  lines.forEach((line, lineIndex) => {
    console.log(`📝 Processing line ${lineIndex}: "${line}" (length: ${line.length})`);
    // Match words (letters/numbers including apostrophes/hyphens). Keep punctuation out of tokens
    // Note: This is ASCII-focused; update to use Unicode classes if needed.
    const wordRegex = /[A-Za-z0-9][A-Za-z0-9''\-]*/g;
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
      const word = match[0];
      if (word) {
        const token = { word, wordIndex: wordIndex++, lineIndex };
        tokens.push(token);
        console.log(`✅ TTS Token ${token.wordIndex}: "${token.word}" (line ${token.lineIndex})`);
      }
    }
    if (!line.trim()) {
      console.log(`⚠️ Empty line ${lineIndex}`);
    }
  });

  console.log('🎯 TTS Final tokens (count:', tokens.length, '):', tokens);
  return tokens;
}

/**
 * @typedef {Object} CharacterTiming
 * @property {number[]} charStartTimesMs - Start times in milliseconds for each character
 * @property {number[]} charDurationsMs - Duration in milliseconds for each character  
 * @property {string[]} chars - Array of characters
 */

/**
 * @typedef {Object} TTSStreamChunk
 * @property {string} audio_base64 - Base64 encoded audio data
 * @property {CharacterTiming} normalizedAlignment - Character timing information
 */

/**
 * @typedef {Object} TTSOptions
 * @property {string} voiceId - ElevenLabs voice ID
 * @property {string} modelId - Model ID to use
 * @property {string} outputFormat - Audio output format
 */

/**
 * Convert text to speech with timing information using single request
 * @param {string} text - Text to convert to speech
 * @param {string} apiKey - ElevenLabs API key
 * @param {Partial<TTSOptions>} options - TTS options
 * @returns {Promise<{audio: ArrayBuffer, timing: any, tokens: any[]}>}
 */
export async function convertTextToSpeechWithTiming(text, apiKey, options = {}) {
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = DEFAULT_MODEL_ID
  } = options;

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey,
    baseUrl: 'https://api.elevenlabs.io'
  });

  try {
    console.log('Getting TTS with timing data...');
    
    // Create token map before sending to TTS
    const tokens = tokenizeWithLines(text);
    console.log('Tokens created:', tokens);
    
    // Get audio and timing in parallel using streamWithTimestamps
    const timingResponse = await elevenlabs.textToSpeech.streamWithTimestamps(voiceId, {
      outputFormat: "mp3_44100_128",
      text: text,
      modelId: modelId,
      optimizeStreamingLatency: 2, // Lower = faster start, 0-4 range in API
      applyTextNormalization: "on",
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.8,
        useSpeakerBoost: true,
        speed: 1.0,
      }
    });

    const audioChunks = [];
    let timingData = null;

    // Process the stream to get both audio and timing
    for await (const item of timingResponse) {
      if (item.audioBase64) {
        // Convert base64 to binary
        const binaryString = atob(item.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioChunks.push(bytes);
      }
      
      if (item.normalizedAlignment) {
        console.log('Timing data received:', item.normalizedAlignment);
        timingData = item.normalizedAlignment;
      }
    }

    // Combine audio chunks
    const totalSize = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalSize);
    let offset = 0;
    
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    console.log('Audio processed:', combinedAudio.byteLength, 'bytes');
    console.log('Timing data:', timingData ? 'available' : 'not available');
    
    return {
      audio: combinedAudio.buffer,
      timing: timingData,
      tokens: tokens
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`ElevenLabs TTS error: ${error.message}`);
  }
}



/**
 * Stream text-to-speech with timing and play immediately with low latency.
 * Uses Web Audio API to play MP3 chunks as they arrive while syncing highlights.
 * @param {string} text
 * @param {string} apiKey
 * @param {(wordIndex: number, lineIndex: number) => void} onWordHighlight
 * @param {Partial<TTSOptions>} options
 * @returns {Promise<null>}
 */
export async function streamTextToSpeechWithTiming(text, apiKey, onWordHighlight, options = {}) {
  console.log('🚀 streamTextToSpeechWithTiming called with:', {
    textLength: text.length,
    text: JSON.stringify(text),
    hasApiKey: !!apiKey,
    hasCallback: !!onWordHighlight
  });
  
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = 'eleven_flash_v2_5'
  } = options;

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey,
    baseUrl: 'https://api-global-preview.elevenlabs.io'
  });

  // Pre-tokenize for word-level highlighting
  const tokens = tokenizeWithLines(text);

  // Use Web Audio API for immediate playback without MediaSource complexity
  /** @type {typeof AudioContext} */
  const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  const audioContext = new AudioContextClass();

  // Resume audio context if suspended (required by autoplay policies)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => console.warn('Failed to resume AudioContext:', err));
  }

  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  /** @type {any | null} */
  let timingData = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let highlightTimer = null;
  let playbackStartTime = 0;
  let isPlaying = false;

  const stopHighlight = () => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  };

  const startHighlight = () => {
    if (!timingData || !playbackStartTime) return;
    const wordTimings = mapCharTimingsToTokens(/** @type {any} */ (timingData), tokens);

    // Sort by wordIndex for sequential highlighting instead of speech order
    wordTimings.sort((a, b) => a.wordIndex - b.wordIndex);

    console.log(`🎯 Starting sequential highlight with ${wordTimings.length} word timings:`, wordTimings);
    let currentWordIndex = 0;
    let lastHighlightedIndex = -1;

    const tick = () => {
      if (!isPlaying) return;
      const currentTime = (performance.now() - playbackStartTime) / 1000 * 1000; // Convert to ms

      // DEBUG: Show ALL word timings and current time
      console.log(`⏰ Tick at ${currentTime.toFixed(0)}ms - checking ${wordTimings.length} words`);
      wordTimings.forEach((word, i) => {
        const inRange = currentTime >= word.startTime - 100 && currentTime <= word.endTime + 200;
        console.log(`  Word ${word.wordIndex}: "${word.word}" ${word.startTime.toFixed(0)}-${word.endTime.toFixed(0)}ms ${inRange ? '✅ IN RANGE' : '❌'}`);
      });

      // Find the current word based on timing - check ALL words, not just from currentWordIndex
      let current = null;
      for (let i = 0; i < wordTimings.length; i++) {
        const word = wordTimings[i];
        if (currentTime >= word.startTime - 100 && currentTime <= word.endTime + 200) {
          current = word;
          console.log(`🎯 Found matching word: ${word.wordIndex} "${word.word}"`);
          break;
        }
      }

      if (current && current.wordIndex !== lastHighlightedIndex) {
        console.log(`💡 Highlighting word ${current.wordIndex} at ${currentTime.toFixed(0)}ms (range: ${current.startTime.toFixed(0)}-${current.endTime.toFixed(0)}ms)`);
        onWordHighlight(current.wordIndex, current.lineIndex);
        lastHighlightedIndex = current.wordIndex;
      } else if (!current && lastHighlightedIndex !== -1 && currentTime > 10000) {
        // Only clear highlights after 10 seconds to avoid premature clearing
        console.log(`🚫 Clearing highlight at ${currentTime.toFixed(0)}ms (after 10s delay)`);
        onWordHighlight(-1, -1);
        lastHighlightedIndex = -1;
      } else if (!current) {
        console.log(`❌ No word found at ${currentTime.toFixed(0)}ms`);
      }
      
      highlightTimer = setTimeout(tick, 30);
    };
    highlightTimer = setTimeout(tick, 30);
  };

  // Request streaming with timestamps
  console.log('🎵 Starting ElevenLabs streaming request...');
  const requestStartTime = performance.now();

  const timingResponse = await elevenlabs.textToSpeech.streamWithTimestamps(voiceId, {
    outputFormat: 'mp3_44100_128',
    text: text,
    modelId: modelId,
    optimizeStreamingLatency: 2,
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.8,
      useSpeakerBoost: true,
      speed: 1.0
    }
  });

  console.log('📡 Stream iterator created, starting TRUE streaming...');

  // True streaming: play chunks sequentially as they arrive
  let receivedCount = 0;
  let playedCount = 0;
  let streamEnded = false;
  let timingReceived = false;
  let playbackStarted = false;

  // Queue to manage chunk order
  /** @type {Uint8Array[]} */
  const chunkQueue = [];
  let isProcessingChunk = false;

  const checkCompletion = () => {
    if (streamEnded && chunkQueue.length === 0 && !isProcessingChunk) {
      console.log(`🎵 All chunks played (${playedCount} total), ending playback`);
      isPlaying = false;
      stopHighlight();
      onWordHighlight(-1, -1);
      audioContext.close().catch(err => console.warn('Failed to close AudioContext:', err));
    }
  };

  const playNextChunk = () => {
    // Don't process if we're already playing, queue is empty, or stream ended and we're done
    if (isProcessingChunk || chunkQueue.length === 0 || (streamEnded && chunkQueue.length === 0)) {
      if (streamEnded && chunkQueue.length === 0 && !isProcessingChunk) {
        checkCompletion();
      }
      return;
    }

    isProcessingChunk = true;
    const chunk = chunkQueue.shift();
    if (!chunk) {
      isProcessingChunk = false;
      return;
    }

    const chunkStartTime = performance.now();

    audioContext.decodeAudioData(chunk.buffer, (buffer) => {
      const decodeTime = performance.now() - chunkStartTime;
      console.log(`🔊 Playing chunk ${playedCount + 1} (${buffer.duration.toFixed(2)}s) - decode: ${decodeTime.toFixed(2)}ms`);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);

      if (!playbackStarted) {
        playbackStarted = true;
        playbackStartTime = performance.now();
        const timeToFirstPlayback = performance.now() - requestStartTime;
        console.log(`▶️  Starting playback after ${timeToFirstPlayback.toFixed(2)}ms`);
        isPlaying = true;

        // Start highlighting if we have timing data
        if (timingData) {
          console.log('🎯 Starting highlight with timing data');
          startHighlight();
        }
      }

      source.start();
      source.onended = () => {
        playedCount++;
        console.log(`✅ Chunk ${playedCount} finished. Stream ended: ${streamEnded}, Queue: ${chunkQueue.length}`);

        isProcessingChunk = false;

        // Process next chunk immediately when current finishes
        if (chunkQueue.length > 0) {
          playNextChunk();
        } else if (streamEnded) {
          checkCompletion();
        }
      };
    }, (error) => {
      console.error(`❌ Failed to decode chunk:`, error);
      playedCount++;
      isProcessingChunk = false;

      // Continue with next chunk even if this one failed
      if (chunkQueue.length > 0) {
        playNextChunk();
      } else if (streamEnded) {
        checkCompletion();
      }
    });
  };

  try {
    // Process streaming response - TRUE STREAMING
    for await (const item of timingResponse) {
      if (item.audioBase64) {
        if (receivedCount === 0) {
          const ttfb = performance.now() - requestStartTime;
          console.log(`⚡ TTFB: ${ttfb.toFixed(2)}ms - First audio chunk received!`);
        }

        receivedCount++;
        const binaryString = atob(item.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log(`📦 Queued chunk ${receivedCount}: ${bytes.length} bytes`);
        chunkQueue.push(bytes);

        // Start processing if not already started
        if (!isProcessingChunk) {
          playNextChunk();
        }
      }

      if (item.normalizedAlignment && !timingData) {
        timingReceived = true;
        timingData = item.normalizedAlignment;
        const timingReceivedTime = performance.now() - requestStartTime;
        console.log(`🎯 Timing data received after ${timingReceivedTime.toFixed(2)}ms`);
      }
    }

    // Mark stream as ended
    streamEnded = true;
    console.log(`📡 Stream ended. Received: ${receivedCount}, Played: ${playedCount}, Queued: ${chunkQueue.length}`);

    // If no chunks are currently being processed and queue is empty, end immediately
    if (!isProcessingChunk && chunkQueue.length === 0) {
      console.log(`🎵 Stream ended with no chunks, ending playback`);
      isPlaying = false;
      stopHighlight();
      onWordHighlight(-1, -1);
      audioContext.close().catch(err => console.warn('Failed to close AudioContext:', err));
    }

  } catch (err) {
    console.error('❌ Streaming error:', err);
    isPlaying = false;
    stopHighlight();
    onWordHighlight(-1, -1);
    audioContext.close().catch(closeErr => console.warn('Failed to close AudioContext:', closeErr));
  }

  return await new Promise((resolve) => {
    // Resolve immediately since playback is handled in real-time
    resolve(null);
  });
}

/**
 * Play audio from ArrayBuffer with token-based timing synchronization
 * @param {ArrayBuffer} audioBuffer - Audio data
 * @param {any} timing - Character timing information
 * @param {(wordIndex: number, lineIndex: number) => void} onWordHighlight - Callback for word highlighting
 * @param {string} text - Original text for word parsing
 * @param {any[]} tokens - Pre-tokenized words with line indices
 * @returns {Promise<HTMLAudioElement>}
 */
export function playAudioWithWordTiming(audioBuffer, timing, onWordHighlight, text, tokens = []) {
  return new Promise((resolve, reject) => {
    try {
      // Create blob URL from ArrayBuffer
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      let lastHighlightedIndex = -1;
      
      // Map character timings to tokens
      const wordTimings = mapCharTimingsToTokens(timing, tokens);

      // Sort by wordIndex for sequential highlighting instead of speech order
      wordTimings.sort((a, b) => a.wordIndex - b.wordIndex);

      console.log('Sequential word timings mapped:', wordTimings.length);

      let currentWordIndex = 0;

      const highlightWords = () => {
        if (audio.paused || audio.ended) return;

        const currentTime = audio.currentTime * 1000; // Convert to milliseconds

        // Find current word with padding for smoother highlighting
        let current = null;
        for (let i = currentWordIndex; i < wordTimings.length; i++) {
          const word = wordTimings[i];
          if (currentTime >= word.startTime - 100 && currentTime <= word.endTime + 200) {
            current = word;
            currentWordIndex = i;
            break;
          }
        }
        
        if (current && current.wordIndex !== lastHighlightedIndex) {
          console.log('Highlighting word', current.wordIndex, 'on line', current.lineIndex, 'at time', currentTime, 'ms');
          onWordHighlight(current.wordIndex, current.lineIndex);
          lastHighlightedIndex = current.wordIndex;
        } else if (!current && lastHighlightedIndex !== -1) {
          // Clear highlighting when no word is active
          onWordHighlight(-1, -1);
          lastHighlightedIndex = -1;
        }
        
        if (!audio.paused && !audio.ended) {
          // Poll every 30ms for smoother highlighting
          setTimeout(() => {
            if (!audio.paused && !audio.ended) {
              highlightWords();
            }
          }, 30);
        }
      };
      
      audio.oncanplaythrough = () => {
        audio.play().then(() => {
          if (wordTimings.length > 0) {
            highlightWords();
          }
        }).catch(reject);
      };
      
      audio.onended = () => {
        onWordHighlight(-1, -1); // Clear highlighting
        URL.revokeObjectURL(audioUrl);
        resolve(audio);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Audio playback failed'));
      };
      
      // Add cleanup function
      // @ts-ignore - Adding custom cleanup method
      audio.cleanup = () => {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.load();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Map ElevenLabs character timings to pre-created tokens
 * @param {any} charTiming - Character timing data
 * @param {Array<{word: string, wordIndex: number, lineIndex: number}>} tokens - Pre-tokenized words
 * @returns {Array<{word: string, startTime: number, endTime: number, wordIndex: number, lineIndex: number}>}
 */
function mapCharTimingsToTokens(charTiming, tokens) {
  console.log('🎭 mapCharTimingsToTokens called with:', {
    hasCharTiming: !!charTiming,
    tokenCount: tokens.length,
    charsLength: charTiming?.characters?.length || 0,
    startTimesLength: charTiming?.characterStartTimesSeconds?.length || 0,
    endTimesLength: charTiming?.characterEndTimesSeconds?.length || 0
  });

  if (!charTiming || !tokens.length) {
    console.log('❌ Missing charTiming or tokens');
    return [];
  }

  // Use the correct property names from the SDK
  let chars = charTiming.characters;
  let startTimes = charTiming.characterStartTimesSeconds;
  let endTimes = charTiming.characterEndTimesSeconds;

  if (!chars || !startTimes || !endTimes) {
    console.log('❌ Missing timing properties:', {
      hasChars: !!chars,
      hasStartTimes: !!startTimes,
      hasEndTimes: !!endTimes
    });
    return [];
  }

  console.log('✅ Character timing data:', {
    charCount: chars.length,
    startTimeCount: startTimes.length,
    endTimeCount: endTimes.length,
    firstFewChars: chars.slice(0, 20).join(''),
    tokenWords: tokens.map(t => t.word)
  });

  const wordTimings = [];
  let charIndex = 0;
  /** @param {string} c */
  const isWordChar = (c) => /[A-Za-z0-9'’\-]/.test(c);

  // Consume characters sequentially to match tokens
  for (const token of tokens) {
    const wordLength = token.word.length;
    console.log(`🔍 Processing token ${token.wordIndex}: "${token.word}" (charIndex: ${charIndex})`);
    
    // Advance through any non-word characters before this token (spaces, punctuation)
    while (charIndex < chars.length && !isWordChar(chars[charIndex])) {
      console.log(`  Skipping char[${charIndex}]: "${chars[charIndex]}"`);
      charIndex++;
    }

    let wordStartTime = 0;
    let wordEndTime = 0;

    // Get timing for this word
    if (charIndex < startTimes.length) {
      wordStartTime = startTimes[charIndex] * 1000; // Convert to milliseconds
      console.log(`  Found start time: ${wordStartTime}ms at charIndex ${charIndex}`);
    } else {
      console.log(`  ❌ No start time for charIndex ${charIndex} (length: ${startTimes.length})`);
    }

    // Get end time from the last character of this word
    const wordEndCharIndex = charIndex + wordLength - 1;
    if (wordEndCharIndex < endTimes.length) {
      wordEndTime = endTimes[wordEndCharIndex] * 1000;
      console.log(`  Found end time: ${wordEndTime}ms at charIndex ${wordEndCharIndex}`);
    } else {
      console.log(`  ❌ No end time for charIndex ${wordEndCharIndex} (length: ${endTimes.length})`);
    }

    console.log(`  Result: "${token.word}" -> ${wordStartTime}-${wordEndTime}ms`);

    wordTimings.push({
      word: token.word,
      startTime: wordStartTime,
      endTime: wordEndTime,
      wordIndex: token.wordIndex,
      lineIndex: token.lineIndex
    });

    // Move to next word
    charIndex += wordLength;
  }

  console.log('🎯 Final word timings:', wordTimings.map(w => `${w.wordIndex}:"${w.word}"=${w.startTime}-${w.endTime}ms`));
  return wordTimings;
}

/**
 * Legacy function - Convert line character timing to word timing with global indices
 * @param {any} charTiming - Character timing data for this line
 * @param {string} lineText - Text for this line
 * @param {number} timeOffset - Time offset for this line in ms
 * @param {number} startingWordIndex - Starting global word index
 * @returns {Array<{word: string, startTime: number, endTime: number, globalWordIndex: number, lineIndex: number}>}
 */
function convertLineToWordTiming(charTiming, lineText, timeOffset, startingWordIndex) {
  console.log('convertLineToWordTiming called with:', {
    lineText,
    timeOffset,
    startingWordIndex,
    charTiming: charTiming ? 'present' : 'null'
  });

  if (!charTiming) {
    console.log('No timing data provided for line');
    return [];
  }

  // Use the correct property names from the SDK
  let chars = charTiming.characters;
  let startTimes = charTiming.characterStartTimesSeconds;
  let endTimes = charTiming.characterEndTimesSeconds;

  if (!chars || !startTimes || !endTimes) {
    console.log('Missing required timing properties for line');
    return [];
  }

  // Tokenize the line properly
  const segments = lineText.split(/(\s+)/);
  const words = segments.filter(segment => segment.trim().length > 0);
  const wordTimings = [];

  console.log('Line words found:', words);

  let charIndex = 0;
  let globalWordIndex = startingWordIndex;

  for (const word of words) {
    // Skip whitespace in character array
    while (charIndex < chars.length && /\s/.test(chars[charIndex])) {
      charIndex++;
    }

    let wordStartTime = 0;
    let wordEndTime = 0;

    // Get timing for this word
    if (charIndex < startTimes.length) {
      wordStartTime = (startTimes[charIndex] * 1000) + timeOffset;
    }

    const wordEndCharIndex = charIndex + word.length - 1;
    if (wordEndCharIndex < endTimes.length) {
      wordEndTime = (endTimes[wordEndCharIndex] * 1000) + timeOffset;
    }

    console.log(`Global word ${globalWordIndex}: "${word}" - start: ${wordStartTime}ms, end: ${wordEndTime}ms`);

    wordTimings.push({
      word,
      startTime: wordStartTime,
      endTime: wordEndTime,
      globalWordIndex,
      lineIndex: 0 // We'll update this when we know which line
    });

    globalWordIndex++;
    charIndex += word.length;
  }

  return wordTimings;
}

/**
 * Legacy function - Convert character timing to word timing 
 * @param {any} charTiming - Character timing data
 * @param {string} text - Original text
 * @returns {Array<{word: string, startTime: number, endTime: number, wordIndex: number}>}
 */
function convertToWordTiming(charTiming, text) {
  console.log('convertToWordTiming called with:', {
    charTiming,
    text,
    timingKeys: charTiming ? Object.keys(charTiming) : 'null',
    allProperties: charTiming ? Object.getOwnPropertyNames(charTiming) : 'null'
  });

  if (!charTiming) {
    console.log('No timing data provided');
    return [];
  }

  // Log all available properties to find the correct ones
  console.log('All timing object properties:');
  for (const prop in charTiming) {
    console.log(`${prop}:`, typeof charTiming[prop], Array.isArray(charTiming[prop]) ? `array[${charTiming[prop].length}]` : charTiming[prop]);
  }

  // Use the correct property names from the SDK
  let chars = charTiming.characters;
  let startTimes = charTiming.characterStartTimesSeconds;
  let endTimes = charTiming.characterEndTimesSeconds;

  console.log('Timing properties found:', {
    chars: chars ? chars.length : 'none',
    startTimes: startTimes ? (Array.isArray(startTimes) ? startTimes.length : typeof startTimes) : 'none',
    endTimes: endTimes ? (Array.isArray(endTimes) ? endTimes.length : typeof endTimes) : 'none'
  });

  if (!chars || !startTimes || !endTimes) {
    console.log('Missing required timing properties');
    return [];
  }
  
  // Split text into segments while preserving whitespace and line breaks (same as frontend)
  const segments = text.split(/(\s+|\n)/);
  const words = segments.filter(segment => segment.trim().length > 0 && segment !== '\n');
  const wordTimings = [];

  console.log('Converting to word timing for text:', text);
  console.log('Words found:', words);
  console.log('Total characters in timing data:', chars.length);

  // Map words to character positions using the same logic as the frontend
  let charIndex = 0;
  let wordIndex = 0;
  
  for (const segment of segments) {
    if (segment.trim().length > 0 && segment !== '\n') {
      // This is a word
      let wordStartTime = 0;
      let wordEndTime = 0;

      // Get start time for this word (first character of the word)
      if (charIndex < startTimes.length) {
        wordStartTime = startTimes[charIndex] * 1000; // Convert seconds to milliseconds
      }

      // Get end time for this word (last character of the word)
      let wordEndCharIndex = charIndex + segment.length - 1;
      if (wordEndCharIndex < endTimes.length) {
        wordEndTime = endTimes[wordEndCharIndex] * 1000; // Convert seconds to milliseconds
      }

      console.log(`Word ${wordIndex}: "${segment}" - chars[${charIndex}:${wordEndCharIndex}] - start: ${wordStartTime}ms, end: ${wordEndTime}ms`);

      wordTimings.push({
        word: segment,
        startTime: wordStartTime,
        endTime: wordEndTime,
        wordIndex: wordIndex
      });
      
      wordIndex++;
    }
    
    // Move character index forward by the length of this segment
    charIndex += segment.length;
  }

  console.log('Generated word timings:', wordTimings.length, 'words');
  return wordTimings;
}

/**
 * Check if ElevenLabs API key is valid format
 * @param {string} apiKey - API key to validate
 * @returns {boolean}
 */
export function isValidApiKey(apiKey) {
  return typeof apiKey === 'string' && 
         apiKey.trim().length > 0 && 
         (apiKey.startsWith('sk-') || apiKey.length > 20);
}

/**
 * Get available voices using official SDK
 * @param {string} apiKey - ElevenLabs API key
 * @returns {Promise<any[]>}
 */
export async function getVoices(apiKey) {
  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey,
    baseUrl: 'https://api-global-preview.elevenlabs.io'
  });
  
  try {
    const response = await elevenlabs.voices.search();
    return response.voices || [];
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Failed to fetch voices: ${error.message}`);
  }
}