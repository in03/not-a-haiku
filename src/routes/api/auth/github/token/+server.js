import { json } from '@sveltejs/kit';
import { GITHUB_CLIENT_ID } from '$lib/auth/github.js';
import { GITHUB_CLIENT_SECRET } from '$env/static/private';

// GitHub OAuth client secret from environment variables
// const GITHUB_CLIENT_SECRET = import.meta.env.GITHUB_CLIENT_SECRET; // This doesn't work in SvelteKit server routes

// Validate required environment variables
if (!GITHUB_CLIENT_SECRET) {
  console.error('❌ GITHUB_CLIENT_SECRET not set - OAuth token exchange will fail');
} else {
  console.log('✅ GITHUB_CLIENT_SECRET is set');
}
if (!GITHUB_CLIENT_ID) {
  console.error('❌ GITHUB_CLIENT_ID not set - OAuth will fail');
} else {
  console.log('✅ GITHUB_CLIENT_ID is set:', GITHUB_CLIENT_ID);
}

/**
 * Exchange OAuth code for access token
 * POST /api/auth/github/token
 */
export async function POST({ request, cookies }) {
  try {
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
      client_secret: GITHUB_CLIENT_SECRET,
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
