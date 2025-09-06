import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Authentication state structure
 * @typedef {Object} AuthState
 * @property {boolean} isAuthenticated - Whether user is logged in
 * @property {string|null} accessToken - GitHub access token
 * @property {Object|null} user - GitHub user information
 * @property {boolean} isLoading - Whether auth operation is in progress
 * @property {string|null} error - Current error message
 */

/** @type {AuthState} */
const initialState = {
  isAuthenticated: false,
  accessToken: null,
  user: null,
  isLoading: false,
  error: null
};

/**
 * Load auth state from localStorage
 * @returns {AuthState} Saved auth state or initial state
 */
function loadAuthState() {
  if (!browser) return initialState;
  
  try {
    const saved = localStorage.getItem('github_auth');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate the structure
      if (parsed && typeof parsed === 'object') {
        return {
          ...initialState,
          ...parsed,
          isLoading: false, // Always reset loading state on init
          error: null // Always reset error state on init
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load auth state from localStorage:', error);
  }
  
  return initialState;
}

/**
 * Save auth state to localStorage
 * @param {AuthState} state - Auth state to save
 */
function saveAuthState(state) {
  if (!browser) return;
  
  try {
    // Only save persistent data, not loading/error states
    const toSave = {
      isAuthenticated: state.isAuthenticated,
      accessToken: state.accessToken,
      user: state.user
    };
    localStorage.setItem('github_auth', JSON.stringify(toSave));
  } catch (error) {
    console.warn('Failed to save auth state to localStorage:', error);
  }
}

/**
 * Create the auth store
 */
function createAuthStore() {
  const { subscribe, set, update } = writable(loadAuthState());

  return {
    subscribe,
    
    /**
     * Set loading state
     * @param {boolean} loading - Whether auth operation is in progress
     */
    setLoading: (loading) => update(state => ({
      ...state,
      isLoading: loading,
      error: loading ? null : state.error // Clear error when starting new operation
    })),
    
    /**
     * Set error state
     * @param {string|null} error - Error message
     */
    setError: (error) => update(state => ({
      ...state,
      error,
      isLoading: false
    })),
    
    /**
     * Set authenticated user
     * @param {string} accessToken - GitHub access token
     * @param {Object} user - GitHub user information
     */
    setUser: (accessToken, user) => update(state => {
      const newState = {
        ...state,
        isAuthenticated: true,
        accessToken,
        user,
        isLoading: false,
        error: null
      };
      saveAuthState(newState);
      return newState;
    }),
    
    /**
     * Clear authentication (sign out)
     */
    signOut: () => {
      const newState = {
        ...initialState
      };
      
      // Clear localStorage
      if (browser) {
        localStorage.removeItem('github_auth');
      }
      
      set(newState);
    },
    
    /**
     * Initialize auth store (check for existing valid token)
     */
    init: async () => {
      const currentState = loadAuthState();
      
      if (currentState.isAuthenticated && currentState.accessToken && currentState.user) {
        // We have saved auth, but let's verify the token is still valid
        update(state => ({ ...state, isLoading: true }));
        
        try {
          // Test the token by making a simple GitHub API call
          const response = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${currentState.accessToken}`,
              'Accept': 'application/vnd.github+json'
            }
          });
          
          if (response.ok) {
            // Token is still valid
            set({
              ...currentState,
              isLoading: false,
              error: null
            });
          } else {
            // Token is invalid, clear auth
            update(state => state);
            if (browser) {
              localStorage.removeItem('github_auth');
            }
            set(initialState);
          }
        } catch (error) {
          console.warn('Auth token validation failed:', error);
          set(initialState);
        }
      }
    }
  };
}

export const authStore = createAuthStore();
