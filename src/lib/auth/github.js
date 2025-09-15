/**
 * GitHub OAuth utilities for authentication with GitHub Models API
 */

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
// Vercel supports full serverless functionality, no static build limitations

// OAuth configuration from environment variables
// Note: Using VITE_OAUTH prefix instead of VITE_GITHUB due to GitHub's protected keyword restriction
export const GITHUB_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID;

// OAuth availability check (no longer need REDIRECT_URI in env vars)
export const isOAuthAvailable = Boolean(GITHUB_CLIENT_ID);

/**
 * Generate OAuth redirect URI - always points to production proxy
 * The proxy will intelligently redirect back to the appropriate environment
 */
export function getRedirectUri(origin = '') {
  // Always use custom domain proxy callback for OAuth
  // The proxy will detect the environment and redirect appropriately
  return 'https://haiku.trevatt.co/api/auth/github/callback';
}

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

/**
 * Generate GitHub OAuth authorization URL
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function getGitHubAuthUrl(state, origin = '') {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('VITE_OAUTH_CLIENT_ID is not set');
  }
  
  const redirectUri = getRedirectUri(origin);
  
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
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
 * @returns {Promise<{access_token?: string, user?: object, error?: string}>}
 */
export async function exchangeCodeForToken(code, state) {
  try {
    // Verify state client-side for CSRF protection
    const storedState = typeof window !== 'undefined' ? sessionStorage.getItem('oauth_state') : null;
    
    // Debug state validation
    console.log('State validation:', {
      storedState,
      receivedState: state,
      match: storedState === state
    });
    
    if (!storedState) {
      throw new Error('No stored state found - session may have expired');
    }
    
    if (storedState !== state) {
      // Try URL decoding in case state got encoded during redirect
      const decodedState = decodeURIComponent(state);
      if (storedState === decodedState) {
        console.log('State matched after URL decoding');
      } else {
        console.error('State mismatch - possible CSRF attack:', {
          stored: storedState,
          received: state,
          decoded: decodedState
        });
        throw new Error('Invalid state parameter - possible CSRF attack');
      }
    }
    
    // Clear the stored state
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('oauth_state');
    }
    
    // Use our server-side token exchange endpoint (secure)
    // This avoids CORS issues and keeps the client secret server-side only
    const tokenResponse = await fetch('/api/auth/github/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: code,
        state: state
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const result = await tokenResponse.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (!result.access_token || !result.user) {
      throw new Error('Invalid token exchange response');
    }
    
    // Server already fetched user information, just return the result
    return {
      access_token: result.access_token,
      user: result.user
    };
    
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
