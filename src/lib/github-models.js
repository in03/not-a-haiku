/**
 * GitHub Models API integration for haiku analysis
 * Uses GitHub's AI models to analyze haiku submissions
 */

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

/**
 * Get the saved GitHub PAT from localStorage
 * @returns {string|null} The PAT or null if not found
 */
export function getGitHubPAT() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('github_pat');
}

/**
 * Check if GitHub PAT is available
 * @returns {boolean} True if PAT is available
 */
export function hasGitHubPAT() {
  return !!getGitHubPAT();
}

/**
 * Available models for different use cases
 * Using economical but capable models as requested
 */
export const MODELS = {
  // Good balance of capability and cost for text analysis
  GPT_4O_MINI: 'gpt-4o-mini',
  // Very economical option
  GPT_35_TURBO: 'gpt-3.5-turbo'
};

/**
 * Create an optimized prompt for haiku analysis
 * @param {string} haikuContent - The haiku text
 * @param {string} haikuTitle - The haiku title  
 * @param {string} poemType - Type of poem (haiku, tanka, etc.)
 * @returns {string} The optimized prompt
 */
function createAnalysisPrompt(haikuContent, haikuTitle, poemType = 'haiku') {
  return `Given the following ${poemType} titled "${haikuTitle}":

${haikuContent}

Interpret this ${poemType} as representing a to-do list task. Analyze it thoughtfully and provide:

1. **Rating**: Rate the ${poemType} out of 5 stars based on the subtlety and cleverness of how it relates to a task or expresses the user's creativity
2. **Comment**: A brief, insightful comment (15-25 words) about either the ${poemType}'s artistic quality, the task it represents, or both
3. **Tags**: Up to 5 relevant task category tags, prioritized by relevance. Examples: laundry, chores, groceries, self-care, homework, study, career, resume, car-service, finance, taxes, shopping, cooking, exercise, meditation, reading, writing, travel, relationships, hobbies, creative, nonsense, trolling

Consider:
- If the ${poemType} is abstract or artistic, focus on the underlying theme or emotion
- If it's clearly about a specific task, be direct
- If it's silly or nonsensical, use tags like "nonsense" or "trolling"
- Rate higher for creative interpretations and clever wordplay
- Rate lower for very literal or simple task descriptions

Respond ONLY with valid JSON in this exact format:
{
  "rating": 4,
  "comment": "Beautifully captures the meditative nature of morning routines",
  "tags": ["self-care", "meditation", "routine", "morning", "mindfulness"]
}`;
}

/**
 * Analyze a haiku using GitHub Models
 * @param {string} haikuContent - The haiku text
 * @param {string} haikuTitle - The haiku title
 * @param {string} model - The model to use (defaults to GPT-4o-mini)
 * @returns {Promise<Object>} Analysis result with rating, comment, and tags
 */
export async function analyzeHaiku(haikuContent, haikuTitle, model = MODELS.GPT_4O_MINI) {
  const pat = getGitHubPAT();
  if (!pat) {
    throw new Error('GitHub PAT not configured. Please set up your token in Settings.');
  }

  const prompt = createAnalysisPrompt(haikuContent, haikuTitle);

  try {
    const response = await fetch(`${GITHUB_MODELS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pat}`,
        'User-Agent': 'Haiku-Studio/1.0'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`GitHub Models API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No analysis content received from GitHub Models');
    }

    // Parse the JSON response
    const analysis = JSON.parse(content);
    
    // Validate the response format
    if (typeof analysis.rating !== 'number' || 
        typeof analysis.comment !== 'string' || 
        !Array.isArray(analysis.tags)) {
      throw new Error('Invalid analysis format received');
    }

    // Ensure rating is between 1-5
    analysis.rating = Math.max(1, Math.min(5, Math.round(analysis.rating)));
    
    // Limit tags to 5 and ensure they're strings
    analysis.tags = analysis.tags
      .filter(tag => typeof tag === 'string')
      .slice(0, 5);

    return {
      success: true,
      analysis,
      model: model
    };

  } catch (error) {
    console.error('Haiku analysis error:', error);
    
    // Return a graceful fallback for network/API errors
    return {
      success: false,
      error: error.message,
      fallback: {
        rating: 3,
        comment: "Unable to analyze - but every haiku has beauty!",
        tags: ["creative", "poetry"]
      }
    };
  }
}

/**
 * Test the GitHub Models connection
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection() {
  const pat = getGitHubPAT();
  if (!pat) {
    return { success: false, error: 'No GitHub PAT configured' };
  }

  try {
    const response = await fetch(`${GITHUB_MODELS_BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'User-Agent': 'Haiku-Studio/1.0'
      }
    });

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: `API responded with status ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}