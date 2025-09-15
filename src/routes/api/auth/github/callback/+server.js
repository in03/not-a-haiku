/**
 * GitHub OAuth Proxy Callback Endpoint
 * 
 * This endpoint receives the GitHub OAuth callback and intelligently
 * redirects to the appropriate environment's auth completion page.
 * 
 * Single GitHub OAuth app callback URL: https://not-a-haiku.vercel.app/api/auth/github/callback
 * This proxy then redirects to the right environment based on request headers.
 */

import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
  // Get OAuth parameters from GitHub
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  console.log('OAuth proxy - received parameters:', {
    code: code ? '[PRESENT]' : 'MISSING',
    state: state ? state : 'MISSING',
    error: error || 'NONE'
  });
  
  // Preserve all query parameters for the redirect
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (state) params.set('state', state);
  if (error) params.set('error', error);
  
  // Add any other parameters GitHub might send
  for (const [key, value] of url.searchParams) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }
  
  // Detect environment based on request headers
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  
  console.log('OAuth proxy redirect - Headers:', {
    referer,
    origin,
    forwardedHost,
    userAgent: request.headers.get('user-agent')
  });
  
  let targetOrigin;
  
  // Determine target environment
  if (referer?.includes('localhost:5173')) {
    // Local development
    targetOrigin = 'http://localhost:5173';
    console.log('Redirecting to development environment');
  } else if (referer?.includes('localhost:')) {
    // Other local development ports
    const refererUrl = new URL(referer);
    targetOrigin = refererUrl.origin;
    console.log('Redirecting to local development on port:', refererUrl.port);
  } else if (referer?.includes('not-a-haiku-git-')) {
    // Preview deployment (branch deployments)
    const refererUrl = new URL(referer);
    targetOrigin = refererUrl.origin;
    console.log('Redirecting to preview deployment:', targetOrigin);
  } else if (forwardedHost?.includes('not-a-haiku-git-')) {
    // Preview deployment detected via forwarded host
    targetOrigin = `https://${forwardedHost}`;
    console.log('Redirecting to preview deployment via forwarded host:', targetOrigin);
  } else {
    // Default to production (custom domain)
    targetOrigin = 'https://haiku.trevatt.co';
    console.log('Redirecting to production environment (custom domain)');
  }
  
  // Build redirect URL to the auth completion page
  const redirectUrl = `${targetOrigin}/auth/callback?${params.toString()}`;
  
  console.log('OAuth proxy redirecting to:', redirectUrl);
  
  // Redirect to the appropriate environment's auth completion page
  throw redirect(302, redirectUrl);
}
