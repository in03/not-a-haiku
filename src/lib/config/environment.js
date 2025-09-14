/**
 * Environment configuration utilities
 * Centralizes environment detection and configuration
 */

// Environment detection using Vite's built-in environment variables
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const mode = import.meta.env.MODE; // 'development', 'production', etc.

// Environment-specific logging
export function envLog(message, type = 'info') {
  if (isDevelopment) {
    const prefix = `[${mode.toUpperCase()}]`;
    switch (type) {
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'error':
        console.error(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }
}

// Environment configuration validation
export function validateEnvironmentConfig() {
  const config = {
    environment: mode,
    oauthClientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
    oauthRedirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
    hasClientSecret: Boolean(import.meta.env.VITE_OAUTH_CLIENT_SECRET || 'server-side-only'),
  };

  envLog('Environment configuration loaded:', 'info');
  envLog(config, 'info');

  // Validation warnings
  if (!config.oauthClientId) {
    envLog('❌ Missing VITE_OAUTH_CLIENT_ID - OAuth will not work', 'error');
    envLog(isDevelopment 
      ? '💡 Create a development OAuth app and add client ID to .env.local' 
      : '💡 Set production OAuth app client ID in deployment environment variables', 'warn');
  }

  if (!config.oauthRedirectUri) {
    envLog('❌ Missing VITE_OAUTH_REDIRECT_URI - OAuth will not work', 'error');
    envLog(isDevelopment 
      ? '💡 Set to your Tailscale tunnel URL (e.g., https://your-machine.tailscale-domain.ts.net/auth/callback)' 
      : '💡 Set to your production domain callback URL', 'warn');
  }

  return config;
}

// OAuth environment-specific configuration
export const oauthEnvironmentConfig = {
  development: {
    scopes: 'read:user gist',
    allowSignup: 'true',
    name: 'Development OAuth App'
  },
  production: {
    scopes: 'read:user gist',
    allowSignup: 'true', 
    name: 'Production OAuth App'
  }
};

export const currentOAuthConfig = isDevelopment 
  ? oauthEnvironmentConfig.development 
  : oauthEnvironmentConfig.production;
