/**
 * ONNX-based syllable counter using dictionary lookup with ML fallback
 * Similar to the Elixir implementation but for JavaScript/SvelteKit
 */

import * as ort from 'onnxruntime-web';
import cmuDict from './data/cmu-syllables.json';
import modelMetadata from '../ml/model_metadata.json';

// Model session cache
let modelSession = null;
let isModelLoaded = false;

/**
 * Initialize ONNX model session
 */
async function initializeModel() {
  if (isModelLoaded) return;
  
  try {
    // Load the ONNX model from static directory
    const modelPath = '/syllable_model.onnx';
    modelSession = await ort.InferenceSession.create(modelPath);
    isModelLoaded = true;
    console.log('ONNX syllable model loaded successfully');
    
    // Debug: log model input/output info
    console.log('Model inputs:', modelSession.inputNames);
    console.log('Model outputs:', modelSession.outputNames);
    console.log('Model input metadata:', modelSession.inputNames.map(name => ({
      name,
      shape: modelSession.inputNames.includes(name) ? modelSession.inputNames : 'unknown'
    })));
  } catch (error) {
    console.error('Failed to load ONNX model:', error);
    throw new Error('ML model initialization failed');
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
    
    // Preprocess input
    const inputTensor = preprocessWord(word);
    const inputShape = [1, modelMetadata.character_encoding.max_word_length, modelMetadata.character_encoding.alphabet_size];
    
    // Create input tensor
    const input = new ort.Tensor('float32', inputTensor, inputShape);
    
    // Get the correct input name from the model
    const inputName = modelSession.inputNames[0];
    console.log('Using input name:', inputName);
    
    // Run inference
    const feeds = { [inputName]: input };
    const results = await modelSession.run(feeds);
    
    // Debug: log the results structure
    console.log('ONNX results:', results);
    console.log('ONNX results keys:', Object.keys(results));
    
    // Get output - use the correct output name from the model
    const outputName = modelSession.outputNames[0];
    console.log('Using output name:', outputName);
    let output = results[outputName];
    
    if (!output) {
      console.error('No output found in ONNX results:', results);
      throw new Error('ONNX model output not found');
    }
    
    console.log('ONNX output:', output);
    console.log('ONNX output data:', output.data);
    
    const syllableCount = Math.round(output.data[0]);
    
    // Ensure minimum 1 syllable
    return Math.max(1, syllableCount);
    
  } catch (error) {
    console.error('ML inference failed:', error);
    // Fallback to basic vowel counting if ML fails
    return basicVowelCount(word);
  }
}

/**
 * Basic vowel counting as ultimate fallback
 */
function basicVowelCount(word) {
  if (!word || word.length === 0) return 0;
  
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanWord.length === 0) return 0;
  
  let syllables = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < cleanWord.length; i++) {
    const char = cleanWord[i];
    const isVowel = 'aeiouy'.includes(char);
    
    if (isVowel && !previousWasVowel) {
      syllables++;
    }
    
    previousWasVowel = isVowel;
  }
  
  return Math.max(1, syllables);
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
  
  if (isComplete) {
    // Complete word: Use dictionary first, ML fallback
    const dictResult = cmuDict[cleanWord];
    if (dictResult !== undefined) {
      return dictResult;
    }
    // Unknown complete word: use ML fallback
    return await mlSyllableCount(cleanWord);
  } else {
    // Partial word: Always use ML for real-time feedback
    return await mlSyllableCount(cleanWord);
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
 * Count syllables for haiku lines (returns array of counts)
 */
export async function countHaikuSyllables(content) {
  if (!content || content.trim().length === 0) {
    return [0, 0, 0];
  }
  
  const lines = content.split(/\r?\n/);
  const syllableCounts = [];
  
  for (let i = 0; i < 3; i++) {
    const line = lines[i] || '';
    const result = await countSyllables(line.trim());
    syllableCounts.push(result.total);
  }
  
  return syllableCounts;
}

/**
 * Validate haiku structure and provide feedback
 */
export async function validateHaiku(content) {
  const syllableCounts = await countHaikuSyllables(content);
  const expectedSyllables = [5, 7, 5];
  const lines = content.split(/\r?\n/).slice(0, 3);
  
  // Check if valid haiku
  const isValid = syllableCounts.every((count, index) => count === expectedSyllables[index]);
  const isComplete = lines.every(line => line.trim().length > 0) && isValid;
  
  // Generate feedback
  let feedback = '';
  if (isComplete) {
    feedback = "Perfect haiku! You're a natural poet.";
  } else if (isValid && lines.some(line => line.trim().length === 0)) {
    feedback = "Great syllable structure! Finish all three lines.";
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
    feedback = issues.length > 0 ? issues[0] : "Keep writing your haiku...";
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