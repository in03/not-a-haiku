/**
 * Hybrid syllable counting using CMU dictionary + ML fallback
 * Similar to the Phoenix implementation but client-side
 */

import cmuDict from './data/cmu-syllables.json';

/**
 * Simple ML-based syllable counting for partial words or unknown words
 * This is a simplified heuristic that approximates your ONNX model
 */
function mlSyllableCount(word) {
  if (!word || word.length === 0) return 0;
  
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanWord.length === 0) return 0;
  
  // Basic vowel counting with adjustments (approximates ML model)
  let syllables = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < cleanWord.length; i++) {
    const char = cleanWord[i];
    const isVowel = 'aeiouy'.includes(char);
    
    if (isVowel) {
      // Count vowel clusters as single syllables
      if (!previousWasVowel) {
        syllables++;
      }
    }
    
    previousWasVowel = isVowel;
  }
  
  // Handle common patterns
  if (cleanWord.endsWith('e') && syllables > 1) {
    syllables--; // Silent e
  }
  
  if (cleanWord.endsWith('le') && syllables > 1) {
    syllables++; // -le adds syllable
  }
  
  // Minimum 1 syllable
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
function countWordSyllables(word, isComplete) {
  const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
  
  if (cleanWord.length === 0) return 0;
  
  if (isComplete) {
    // Complete word: Use dictionary first, ML fallback
    const dictResult = cmuDict[cleanWord];
    if (dictResult !== undefined) {
      return dictResult;
    }
    // Unknown complete word: use ML fallback
    return mlSyllableCount(cleanWord);
  } else {
    // Partial word: Always use ML for real-time feedback
    return mlSyllableCount(cleanWord);
  }
}

/**
 * Count total syllables in text using hybrid approach
 */
export function countSyllables(text) {
  const words = extractWordsWithBoundaries(text);
  
  if (words.length === 0) return 0;
  
  let totalSyllables = 0;
  const wordBreakdown = [];
  
  for (const { word, isComplete } of words) {
    const syllables = countWordSyllables(word, isComplete);
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
export function countHaikuSyllables(content) {
  if (!content || content.trim().length === 0) {
    return [0, 0, 0];
  }
  
  const lines = content.split(/\r?\n/);
  const syllableCounts = [];
  
  for (let i = 0; i < 3; i++) {
    const line = lines[i] || '';
    const result = countSyllables(line.trim());
    syllableCounts.push(typeof result === 'object' ? result.total : result);
  }
  
  return syllableCounts;
}

/**
 * Validate haiku structure and provide feedback
 */
export function validateHaiku(content) {
  const syllableCounts = countHaikuSyllables(content);
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