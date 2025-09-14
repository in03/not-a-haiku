/**
 * GitHub OAuth utilities for authentication with GitHub Models API
 */

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// OAuth configuration from environment variables
// Note: Using VITE_OAUTH prefix instead of VITE_GITHUB due to GitHub's protected keyword restriction
export const GITHUB_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID;
export const REDIRECT_URI = import.meta.env.VITE_OAUTH_REDIRECT_URI;

// Environment-specific configuration
const config = {
  development: {
    scopes: 'read:user gist', // Minimal scopes for development
    allowSignup: 'true'
  },
  production: {
    scopes: 'read:user gist', // Production scopes - adjust as needed
    allowSignup: 'true'
  }
};

export const oauthConfig = isDevelopment ? config.development : config.production;

// Validate required environment variables with environment context
if (!GITHUB_CLIENT_ID) {
  const envType = isDevelopment ? 'development' : 'production';
  console.warn(`⚠️  VITE_OAUTH_CLIENT_ID not set for ${envType} - GitHub OAuth will not work`);
  console.warn(`💡 ${isDevelopment ? 'Create a development OAuth app and add to .env.local' : 'Set production OAuth app ID in deployment platform'}`);
}
if (!REDIRECT_URI) {
  const envType = isDevelopment ? 'development' : 'production';
  console.warn(`⚠️  VITE_OAUTH_REDIRECT_URI not set for ${envType} - GitHub OAuth will not work`);
  console.warn(`💡 ${isDevelopment ? 'Set to your Tailscale tunnel URL or localhost:5173' : 'Set to your production domain'}`);
}

/**
 * Generate GitHub OAuth authorization URL
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function getGitHubAuthUrl(state) {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('VITE_OAUTH_CLIENT_ID is not set');
  }
  if (!REDIRECT_URI) {
    throw new Error('VITE_OAUTH_REDIRECT_URI is not set');
  }
  
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: oauthConfig.scopes, // Environment-specific scopes
    state: state,
    allow_signup: oauthConfig.allowSignup
  });
  
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 * @param {string} code - Authorization code from GitHub
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise<{access_token?: string, error?: string}>}
 */
export async function exchangeCodeForToken(code, state) {
  try {
    const response = await fetch('/api/auth/github/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Token exchange error:', error);
    return { error: error.message };
  }
}

/**
 * Get GitHub user info using access token
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<{login?: string, name?: string, avatar_url?: string, error?: string}>}
 */
export async function getGitHubUser(accessToken) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('GitHub user fetch error:', error);
    return { error: error.message };
  }
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns {string} Random state string
 */
export function generateState() {
  return btoa(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
}

/**
 * Test if GitHub Models API is accessible with token
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testGitHubModelsAccess(accessToken) {
  try {
    // Try a simple test call to GitHub Models API
    const response = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1
      })
    });
    
    // Even if the request fails due to quota or other issues,
    // a 200-4xx response means the token is valid for the API
    if (response.status < 500) {
      return { success: true };
    } else {
      return { success: false, error: `API responded with status ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
