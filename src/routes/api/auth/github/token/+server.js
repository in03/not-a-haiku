import { json } from '@sveltejs/kit';
import { GITHUB_CLIENT_ID } from '$lib/auth/github.js';
import { OAUTH_CLIENT_SECRET } from '$env/static/private';

// GitHub OAuth client secret from environment variables
// Note: Using OAUTH_CLIENT_SECRET instead of GITHUB_CLIENT_SECRET due to GitHub's protected keyword restriction
// const OAUTH_CLIENT_SECRET = import.meta.env.OAUTH_CLIENT_SECRET; // This doesn't work in SvelteKit server routes

// Environment detection (server-side)
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const environment = process.env.NODE_ENV || 'development';

// Validate required environment variables with environment context
if (!OAUTH_CLIENT_SECRET) {
  console.error(`❌ OAUTH_CLIENT_SECRET not set for ${environment} - OAuth token exchange will fail`);
  console.error(isDevelopment 
    ? '💡 Add OAUTH_CLIENT_SECRET to your .env.local file' 
    : '💡 Set OAUTH_CLIENT_SECRET in your deployment platform environment variables');
} else {
  console.log(`✅ OAUTH_CLIENT_SECRET is set for ${environment}`);
}

if (!GITHUB_CLIENT_ID) {
  console.error(`❌ VITE_OAUTH_CLIENT_ID not set for ${environment} - OAuth will fail`);
  console.error(isDevelopment 
    ? '💡 Add VITE_OAUTH_CLIENT_ID to your .env.local file' 
    : '💡 Set VITE_OAUTH_CLIENT_ID in your deployment platform environment variables');
} else {
  console.log(`✅ VITE_OAUTH_CLIENT_ID is set for ${environment}:`, GITHUB_CLIENT_ID);
}

/**
 * Exchange OAuth code for access token
 * POST /api/auth/github/token
 */
export async function POST({ request, cookies }) {
  try {
    // Check if required environment variables are available
    if (!OAUTH_CLIENT_SECRET) {
      console.error('❌ OAUTH_CLIENT_SECRET not set - OAuth token exchange will fail');
      return json({ error: 'OAuth configuration error' }, { status: 500 });
    }
    
    if (!GITHUB_CLIENT_ID) {
      console.error('❌ GITHUB_CLIENT_ID not set - OAuth will fail');
      return json({ error: 'OAuth configuration error' }, { status: 500 });
    }
    
    const { code, state } = await request.json();
    
    // Verify state parameter for CSRF protection
    const storedState = cookies.get('oauth_state');
    if (!storedState || storedState !== state) {
      return json({ error: 'Invalid state parameter' }, { status: 400 });
    }
    
    // Clear the state cookie
    cookies.delete('oauth_state', { path: '/' });
    
    // Exchange code for access token
    const tokenPayload = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      client_secret: OAUTH_CLIENT_SECRET,
      code: code
    };
    
    console.log('Token exchange payload:', {
      client_id: tokenPayload.client_id,
      client_secret: tokenPayload.client_secret ? '[REDACTED]' : 'MISSING',
      code: tokenPayload.code ? '[REDACTED]' : 'MISSING'
    });
    
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenPayload)
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('GitHub token exchange failed:', errorText);
      return json({ error: 'Token exchange failed' }, { status: 400 });
    }
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description);
      return json({ error: tokenData.error_description || 'OAuth error' }, { status: 400 });
    }
    
    if (!tokenData.access_token) {
      return json({ error: 'No access token received' }, { status: 400 });
    }
    
    // Get user information
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (!userResponse.ok) {
      console.error('Failed to fetch GitHub user:', userResponse.status);
      return json({ error: 'Failed to fetch user information' }, { status: 400 });
    }
    
    const userData = await userResponse.json();
    
    return json({
      access_token: tokenData.access_token,
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        id: userData.id
      }
    });
    
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
