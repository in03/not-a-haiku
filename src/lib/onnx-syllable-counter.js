/**
 * ONNX-based syllable counter using dictionary lookup with ML fallback
 * Similar to the Elixir implementation but for JavaScript/SvelteKit
 * 
 * Verbose logging shows:
 * - Dict lookup vs ML inference timing
 * - Character encoding for ML model input
 * - Raw ML output values before rounding
 * - Overall haiku validation timing
 */

import * as ort from 'onnxruntime-web';
import cmuDict from './data/cmu-syllables.json';
import modelMetadata from '../ml/model_metadata.json';
import { base } from '$app/paths';

// Model session cache
let modelSession = null;
let isModelLoaded = false;
let isModelLoading = false;

// Verbose logging that respects Chrome dev tools log level
function verboseLog(...args) {
  // Use console.debug which respects Chrome's "Verbose" log level setting
  console.debug('[VERBOSE]', ...args);
}

/**
 * Initialize ONNX model session
 */
async function initializeModel() {
  if (isModelLoaded) return;
  if (isModelLoading) {
    // Wait for the current loading to complete
    while (isModelLoading && !isModelLoaded) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  
  isModelLoading = true;
  
  try {
    // Load the ONNX model from static directory
    // Handle base path for GitHub Pages deployment
    const modelPath = `${base}/syllable_model.onnx`;
    console.log('Loading ONNX model from:', modelPath);
    
    modelSession = await ort.InferenceSession.create(modelPath);
    isModelLoaded = true;
    console.log('ONNX syllable model loaded successfully');

  } catch (error) {
    console.error('Failed to load ONNX model:', error);
    console.error('Model path attempted:', `${base}/syllable_model.onnx`);
    console.error('Base path:', base);
    throw new Error('ML model initialization failed');
  } finally {
    isModelLoading = false;
  }
}

/**
 * Preprocess word for ONNX model input
 */
function preprocessWord(word) {
  const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
  const maxLength = modelMetadata.character_encoding.max_word_length;
  const alphabet = modelMetadata.character_encoding.alphabet;
  const alphabetSize = modelMetadata.character_encoding.alphabet_size;
  
  // Create one-hot encoded tensor
  const tensor = new Float32Array(maxLength * alphabetSize);
  
  // Fill with zeros initially
  for (let i = 0; i < maxLength * alphabetSize; i++) {
    tensor[i] = 0;
  }
  
  // Encode each character
  for (let i = 0; i < Math.min(cleanWord.length, maxLength); i++) {
    const char = cleanWord[i];
    const charIndex = alphabet.indexOf(char);
    
    if (charIndex !== -1) {
      const tensorIndex = i * alphabetSize + charIndex;
      tensor[tensorIndex] = 1;
    }
  }
  
  return tensor;
}

/**
 * Run ML inference for syllable counting
 */
async function mlSyllableCount(word) {
  if (!word || word.length === 0) return 0;
  
  try {
    // Ensure model is loaded
    if (!isModelLoaded) {
      await initializeModel();
    }
    
    const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
    verboseLog(`ML encoding: "${cleanWord}" -> [${cleanWord.split('').join(', ')}]`);
    
    // Preprocess input
    const inputTensor = preprocessWord(word);
    const inputShape = [1, modelMetadata.character_encoding.max_word_length, modelMetadata.character_encoding.alphabet_size];
    
    // Create input tensor
    const input = new ort.Tensor('float32', inputTensor, inputShape);
    
    // Get the correct input name from the model
    const inputName = modelSession.inputNames[0];

    
    // Run inference
    const feeds = { [inputName]: input };
    const results = await modelSession.run(feeds);
    

    
    // Get output - use the correct output name from the model
    const outputName = modelSession.outputNames[0];

    let output = results[outputName];
    
    if (!output) {
      console.error('No output found in ONNX results:', results);
      throw new Error('ONNX model output not found');
    }
    
    const rawOutput = output.data[0];
    const syllableCount = Math.round(rawOutput);
    verboseLog(`ML raw output: ${rawOutput.toFixed(4)} -> ${syllableCount} syllables`);
    
    // Ensure minimum 1 syllable
    return Math.max(1, syllableCount);
    
  } catch (error) {
    console.error('ML inference failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`ML syllable counting failed for word "${word}": ${errorMessage}`);
  }
}


/**
 * Extract words with completion status from text
 */
function extractWordsWithBoundaries(text) {
  if (!text || text.trim().length === 0) return [];
  
  // Clean and split text
  const cleanedText = text.toLowerCase().replace(/[^a-z\s'-]/g, ' ');
  const words = cleanedText.split(/\s+/).filter(word => word.trim().length > 0);
  
  if (words.length === 0) return [];
  
  // Determine if text ends with complete word (space/punctuation after)
  const textEndsComplete = /[\s\p{P}]$/.test(text);
  
  if (textEndsComplete) {
    // All words are complete
    return words.map(word => ({ word, isComplete: true }));
  } else {
    // Last word is partial, rest are complete
    const completeWords = words.slice(0, -1).map(word => ({ word, isComplete: true }));
    const partialWord = { word: words[words.length - 1], isComplete: false };
    return [...completeWords, partialWord];
  }
}

/**
 * Count syllables for a single word using hybrid approach
 */
async function countWordSyllables(word, isComplete) {
  const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
  
  if (cleanWord.length === 0) return 0;
  
  const startTime = performance.now();
  
  if (isComplete) {
    // Special rule: Single letters are treated as words (1 syllable) when complete
    // This addresses the acronym vs word ambiguity mentioned in syllable-quirks.md
    if (cleanWord.length === 1) {
      verboseLog(`Single letter rule: "${cleanWord}" = 1 syllable (complete word)`);
      return 1;
    }
    
    // Complete word: Use dictionary first, ML fallback
    const dictResult = cmuDict[cleanWord];
    if (dictResult !== undefined) {
      const dictTime = performance.now() - startTime;
      verboseLog(`Dict lookup: "${cleanWord}" = ${dictResult} syllables (${dictTime.toFixed(2)}ms)`);
      return dictResult;
    }
    // Unknown complete word: use ML fallback
    const mlResult = await mlSyllableCount(cleanWord);
    const mlTime = performance.now() - startTime;
    verboseLog(`ML inference: "${cleanWord}" = ${mlResult} syllables (${mlTime.toFixed(2)}ms)`);
    return mlResult;
  } else {
    // Partial word: Always use ML for real-time feedback
    const mlResult = await mlSyllableCount(cleanWord);
    const mlTime = performance.now() - startTime;
    verboseLog(`ML inference (partial): "${cleanWord}" = ${mlResult} syllables (${mlTime.toFixed(2)}ms)`);
    return mlResult;
  }
}

/**
 * Count total syllables in text using hybrid approach
 */
export async function countSyllables(text) {
  const words = extractWordsWithBoundaries(text);
  
  if (words.length === 0) return { total: 0, words: [] };
  
  let totalSyllables = 0;
  const wordBreakdown = [];
  
  for (const { word, isComplete } of words) {
    const syllables = await countWordSyllables(word, isComplete);
    totalSyllables += syllables;
    wordBreakdown.push({ word, syllables, isComplete });
  }
  
  return {
    total: totalSyllables,
    words: wordBreakdown
  };
}

/**
 * Count syllables for poem lines (returns array of counts)
 */
export async function countHaikuSyllables(content, expectedSyllables = [5, 7, 5]) {
  if (!content || content.trim().length === 0) {
    return new Array(expectedSyllables.length).fill(0);
  }
  
  const startTime = performance.now();
  const lines = content.split(/\r?\n/);
  const syllableCounts = [];
  
  for (let i = 0; i < expectedSyllables.length; i++) {
    const line = lines[i] || '';
    const result = await countSyllables(line.trim());
    syllableCounts.push(result.total);
  }
  
  const totalTime = performance.now() - startTime;
  verboseLog(`Poem validation: [${syllableCounts.join(', ')}] vs [${expectedSyllables.join(', ')}] (${totalTime.toFixed(2)}ms total)`);
  
  return syllableCounts;
}

/**
 * Validate poem structure and provide feedback
 */
export async function validateHaiku(content, expectedSyllables = [5, 7, 5], poemType = 'haiku') {
  const syllableCounts = await countHaikuSyllables(content, expectedSyllables);
  const lines = content.split(/\r?\n/).slice(0, expectedSyllables.length);
  
  // Require all required lines to exist and be non-empty
  const hasAllRequiredLines =
    lines.length === expectedSyllables.length && lines.every((line) => line.trim().length > 0);

  // Structure match across all expected lines
  const structureMatches = syllableCounts.every((count, index) => count === expectedSyllables[index]);

  // A poem is considered valid only when complete (prevents partial poems from being "valid")
  const isComplete = hasAllRequiredLines && structureMatches;
  const isValid = isComplete;
  
  // Generate feedback
  let feedback = '';
  if (isComplete) {
    feedback = `Perfect ${poemType}! You're a natural poet.`;
  } else if (!hasAllRequiredLines) {
    // Encourage finishing all lines when partial structure looks ok so far
    const presentLines = lines.filter((l) => l.trim().length > 0).length;
    if (presentLines > 0) {
      feedback = `Great start! Finish all ${expectedSyllables.length} lines.`;
    } else {
      feedback = `Write your ${poemType}...`;
    }
  } else {
    const issues = [];
    syllableCounts.forEach((count, index) => {
      const expected = expectedSyllables[index];
      if (count !== expected) {
        const lineNum = index + 1;
        if (count > expected) {
          issues.push(`Line ${lineNum} has too many syllables (${count}/${expected})`);
        } else if (count < expected && lines[index]?.trim()) {
          issues.push(`Line ${lineNum} needs more syllables (${count}/${expected})`);
        }
      }
    });
    feedback = issues.length > 0 ? issues[0] : `Keep writing your ${poemType}...`;
  }
  
  return {
    isValid,
    isComplete,
    syllableCounts,
    feedback
  };
}

/**
 * Initialize the model on module load
 */
export async function initializeSyllableCounter() {
  try {
    await initializeModel();
    return true;
  } catch (error) {
    console.error('Failed to initialize syllable counter:', error);
    return false;
  }
} 