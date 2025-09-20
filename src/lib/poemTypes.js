/**
 * Poem type definitions
 * Central source of truth for all supported poem types
 */

export const poemTypes = {
  haiku: {
    name: 'Haiku',
    description: 'Traditional Japanese',
    syllables: [5, 7, 5]
  },
  tanka: {
    name: 'Tanka',
    description: 'Extended haiku',
    syllables: [5, 7, 5, 7, 7]
  },
  cinquain: {
    name: 'Cinquain',
    description: 'American - Adelaide Crapsey',
    syllables: [2, 4, 6, 8, 2]
  },
  nonet: {
    name: 'Nonet',
    description: 'Descending syllable count',
    syllables: [9, 8, 7, 6, 5, 4, 3, 2, 1]
  },
  shadorma: {
    name: 'Shadorma',
    description: 'Spanish origin',
    syllables: [3, 5, 3, 3, 7, 5]
  },
  etheree: {
    name: 'Etheree',
    description: 'Ascending syllable count',
    syllables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  etheree_desc: {
    name: 'Etheree',
    description: 'Descending syllable count',
    syllables: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  }
};

/**
 * Get poem type by key
 */
export function getPoemType(key) {
  return poemTypes[key];
}

/**
 * Detect poem type from content based on number of lines
 * @param {string} content - The poem content
 * @returns {string} The detected poem type key
 */
export function detectPoemType(content) {
  if (!content || !content.trim()) {
    return 'haiku'; // Default
  }
  
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const lineCount = lines.length;
  
  // Find poem types that match the line count
  const matchingTypes = Object.entries(poemTypes).filter(([, type]) => 
    type.syllables.length === lineCount
  );
  
  if (matchingTypes.length === 0) {
    return 'haiku'; // Default fallback
  }
  
  // If multiple matches, prefer based on order of preference
  const preferenceOrder = ['haiku', 'tanka', 'cinquain', 'shadorma', 'nonet', 'etheree', 'etheree_desc'];
  
  for (const preferred of preferenceOrder) {
    if (matchingTypes.some(([key]) => key === preferred)) {
      return preferred;
    }
  }
  
  // Return the first match if no preference found
  return matchingTypes[0][0];
}