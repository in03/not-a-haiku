import { redirect } from '@sveltejs/kit';
import { getGitHubAuthUrl, generateState } from '$lib/auth/github.js';

/**
 * Initiate GitHub OAuth flow
 * GET /api/auth/github
 */
export async function GET({ cookies }) {
  // Generate and store CSRF state parameter
  const state = generateState();
  
  // Store state in HTTP-only cookie for security
  cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: false, // Set to false for localhost development
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/'
  });
  
  // Redirect to GitHub OAuth
  const authUrl = getGitHubAuthUrl(state);
  throw redirect(302, authUrl);
}
