import { authStore } from './stores/auth.js';
import { haikuDB } from './stores/haiku-db.js';
import { settingsStore } from './stores/settings.js';
import { get } from 'svelte/store';

/**
 * GitHub Gist syncing functionality for haikus
 */

const GIST_FILENAME = 'haikus.json';
const GIST_DESCRIPTION = 'Haiku Collection - Synced from Not a Haiku app';

/**
 * Sync manager for GitHub gists
 */
class GitHubSyncManager {
  constructor() {
    this.isSeeding = false;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.isSyncing = false;
    this.remoteLastModified = null;
    this.localLastModified = null;
    this.hasUnsyncedRemote = false;
    this.syncStatus = 'idle'; // 'idle' | 'syncing' | 'error' | 'success'
    this.lastSyncError = null;
  }

  /**
   * Get authenticated GitHub token
   * @returns {string|null}
   */
  getAuthToken() {
    const auth = get(authStore);
    return auth.isAuthenticated ? auth.accessToken : null;
  }

  /**
   * Make authenticated GitHub API request
   * @param {string} url
   * @param {RequestInit} options
   * @returns {Promise<Response>}
   */
  async makeGitHubRequest(url, options = {}) {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    return response;
  }

  /**
   * Find existing haiku gist
   * @returns {Promise<Object|null>}
   */
  async findHaikuGist() {
    try {
      const response = await this.makeGitHubRequest('https://api.github.com/gists');
      const gists = await response.json();

      // Look for a gist with our filename and description
      return gists.find(gist => 
        gist.description === GIST_DESCRIPTION &&
        gist.files[GIST_FILENAME]
      ) || null;
    } catch (error) {
      console.error('Failed to find haiku gist:', error);
      return null;
    }
  }

  /**
   * Create a new haiku gist
   * @param {Array} haikus - Array of haiku objects
   * @returns {Promise<Object>}
   */
  async createHaikuGist(haikus) {
    const gistData = {
      description: GIST_DESCRIPTION,
      public: false, // Private gist
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({
            version: 1,
            syncedAt: Date.now(),
            haikus: haikus
          }, null, 2)
        }
      }
    };

    const response = await this.makeGitHubRequest('https://api.github.com/gists', {
      method: 'POST',
      body: JSON.stringify(gistData)
    });

    return await response.json();
  }

  /**
   * Update an existing haiku gist
   * @param {string} gistId - Gist ID
   * @param {Array} haikus - Array of haiku objects
   * @returns {Promise<Object>}
   */
  async updateHaikuGist(gistId, haikus) {
    const gistData = {
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify({
            version: 1,
            syncedAt: Date.now(),
            haikus: haikus
          }, null, 2)
        }
      }
    };

    const response = await this.makeGitHubRequest(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify(gistData)
    });

    return await response.json();
  }

  /**
   * Get haikus from a gist
   * @param {string} gistId - Gist ID
   * @returns {Promise<Object>}
   */
  async getHaikuGist(gistId) {
    const response = await this.makeGitHubRequest(`https://api.github.com/gists/${gistId}`);
    return await response.json();
  }

  /**
   * Push local haikus to GitHub
   * @returns {Promise<{success: boolean, message: string, gistId?: string}>}
   */
  async pushToGitHub() {
    try {
      if (!this.getAuthToken()) {
        return { success: false, message: 'Not authenticated with GitHub' };
      }

      // Get all local haikus
      const localHaikus = await haikuDB.getAll();
      
      // Find existing gist
      let existingGist = await this.findHaikuGist();
      let gist;

      if (existingGist) {
        // Update existing gist
        gist = await this.updateHaikuGist(existingGist.id, localHaikus);
      } else {
        // Create new gist
        gist = await this.createHaikuGist(localHaikus);
      }

      // Update sync timestamps for all haikus
      const now = Date.now();
      await Promise.all(
        localHaikus.map(haiku => 
          haikuDB.update(haiku.id, { 
            syncedAt: now,
            gistId: gist.id 
          })
        )
      );

      this.lastSyncTime = now;

      return {
        success: true,
        message: `Successfully synced ${localHaikus.length} haikus to GitHub`,
        gistId: gist.id
      };
    } catch (error) {
      console.error('Failed to push to GitHub:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  /**
   * Pull haikus from GitHub and merge with local
   * @returns {Promise<{success: boolean, message: string, imported?: number, updated?: number}>}
   */
  async pullFromGitHub() {
    try {
      if (!this.getAuthToken()) {
        return { success: false, message: 'Not authenticated with GitHub' };
      }

      // Find existing gist
      const existingGist = await this.findHaikuGist();
      if (!existingGist) {
        return { 
          success: true, 
          message: 'No haiku gist found on GitHub'
        };
      }

      // Get gist content
      const gist = await this.getHaikuGist(existingGist.id);
      const fileContent = gist.files[GIST_FILENAME]?.content;
      
      if (!fileContent) {
        return { 
          success: false, 
          message: 'Gist file content not found'
        };
      }

      const gistData = JSON.parse(fileContent);
      const remoteHaikus = gistData.haikus || [];

      // Get all local haikus
      const localHaikus = await haikuDB.getAll();
      const localHaikuMap = new Map(localHaikus.map(h => [h.id, h]));

      let imported = 0;
      let updated = 0;

      // Process remote haikus
      for (const remoteHaiku of remoteHaikus) {
        const localHaiku = localHaikuMap.get(remoteHaiku.id);

        if (!localHaiku) {
          // Import new haiku
          await haikuDB.create({
            ...remoteHaiku,
            syncedAt: gistData.syncedAt,
            gistId: existingGist.id
          });
          imported++;
        } else if (remoteHaiku.updatedAt > localHaiku.updatedAt) {
          // Update existing haiku if remote is newer
          await haikuDB.update(remoteHaiku.id, {
            ...remoteHaiku,
            syncedAt: gistData.syncedAt,
            gistId: existingGist.id
          });
          updated++;
        }
      }

      this.lastSyncTime = Date.now();

      return {
        success: true,
        message: `Sync complete: ${imported} imported, ${updated} updated`,
        imported,
        updated
      };
    } catch (error) {
      console.error('Failed to pull from GitHub:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  /**
   * Full bidirectional sync
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sync() {
    try {
      if (!this.getAuthToken()) {
        return { success: false, message: 'Not authenticated with GitHub' };
      }

      // First pull remote changes
      const pullResult = await this.pullFromGitHub();
      if (!pullResult.success) {
        return pullResult;
      }

      // Then push any local changes
      const pushResult = await this.pushToGitHub();
      if (!pushResult.success) {
        return pushResult;
      }

      return {
        success: true,
        message: 'Sync completed successfully'
      };
    } catch (error) {
      console.error('Failed to sync:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  /**
   * Check for unsynced remote changes
   * @returns {Promise<{hasUnsyncedRemote: boolean, remoteLastModified: number|null, localLastModified: number|null}>}
   */
  async checkForUnsyncedRemote() {
    try {
      if (!this.getAuthToken()) {
        return { hasUnsyncedRemote: false, remoteLastModified: null, localLastModified: null };
      }

      const existingGist = await this.findHaikuGist();
      if (!existingGist) {
        this.hasUnsyncedRemote = false;
        return { hasUnsyncedRemote: false, remoteLastModified: null, localLastModified: null };
      }

      // Get remote gist info
      const gist = await this.getHaikuGist(existingGist.id);
      const remoteLastModified = new Date(gist.updated_at).getTime();
      this.remoteLastModified = remoteLastModified;

      // Get local last modified time
      const localHaikus = await haikuDB.getAll();
      const localLastModified = localHaikus.length > 0 
        ? Math.max(...localHaikus.map(h => h.updatedAt))
        : 0;
      this.localLastModified = localLastModified;

      // Check if remote is newer than our last sync
      const hasUnsyncedRemote = this.lastSyncTime 
        ? remoteLastModified > this.lastSyncTime
        : localHaikus.length > 0; // If we've never synced but have local data

      this.hasUnsyncedRemote = hasUnsyncedRemote;

      return {
        hasUnsyncedRemote,
        remoteLastModified,
        localLastModified
      };
    } catch (error) {
      console.error('Failed to check for unsynced remote:', error);
      return { hasUnsyncedRemote: false, remoteLastModified: null, localLastModified: null };
    }
  }

  /**
   * Start periodic sync if enabled
   */
  startPeriodicSync() {
    this.stopPeriodicSync(); // Clear any existing interval

    const settings = get(settingsStore);
    if (!settings.enableSync || !settings.autoSync || !this.getAuthToken()) {
      return;
    }

    const intervalMs = settings.syncInterval * 60 * 1000; // Convert minutes to milliseconds
    
    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing) {
        await this.sync();
      }
    }, intervalMs);

    console.log(`Periodic sync started: every ${settings.syncInterval} minutes`);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Periodic sync stopped');
    }
  }

  /**
   * Initialize sync system
   */
  async initialize() {
    const settings = get(settingsStore);
    
    if (!settings.enableSync || !this.getAuthToken()) {
      return;
    }

    // Check for unsynced remote changes
    await this.checkForUnsyncedRemote();

    // Sync on startup if enabled
    if (settings.syncOnStartup) {
      await this.sync();
    }

    // Start periodic sync if enabled
    this.startPeriodicSync();
  }

  /**
   * Enhanced sync with status tracking
   * @returns {Promise<{success: boolean, message: string, hasUnsyncedRemote?: boolean}>}
   */
  async sync() {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    this.syncStatus = 'syncing';
    this.lastSyncError = null;

    try {
      if (!this.getAuthToken()) {
        throw new Error('Not authenticated with GitHub');
      }

      // Check for unsynced remote changes first
      const remoteCheck = await this.checkForUnsyncedRemote();

      // First pull remote changes
      const pullResult = await this.pullFromGitHub();
      if (!pullResult.success) {
        throw new Error(pullResult.message);
      }

      // Then push any local changes
      const pushResult = await this.pushToGitHub();
      if (!pushResult.success) {
        throw new Error(pushResult.message);
      }

      this.syncStatus = 'success';
      this.lastSyncTime = Date.now();
      this.hasUnsyncedRemote = false;

      return {
        success: true,
        message: 'Sync completed successfully',
        hasUnsyncedRemote: false
      };
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus = 'error';
      this.lastSyncError = error.message;
      
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        hasUnsyncedRemote: this.hasUnsyncedRemote
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get comprehensive sync status information
   * @returns {Promise<Object>}
   */
  async getSyncStatus() {
    try {
      const localHaikus = await haikuDB.getAll();
      const syncedCount = localHaikus.filter(h => h.syncedAt).length;
      const existingGist = await this.findHaikuGist();

      // Check for unsynced remote changes
      const remoteCheck = await this.checkForUnsyncedRemote();

      return {
        totalLocal: localHaikus.length,
        synced: syncedCount,
        unsynced: localHaikus.length - syncedCount,
        hasRemoteGist: !!existingGist,
        gistId: existingGist?.id || null,
        lastSyncTime: this.lastSyncTime,
        hasUnsyncedRemote: this.hasUnsyncedRemote,
        remoteLastModified: this.remoteLastModified,
        localLastModified: this.localLastModified,
        syncStatus: this.syncStatus,
        isSyncing: this.isSyncing,
        lastSyncError: this.lastSyncError,
        periodicSyncActive: !!this.syncInterval
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        totalLocal: 0,
        synced: 0,
        unsynced: 0,
        hasRemoteGist: false,
        gistId: null,
        lastSyncTime: null,
        hasUnsyncedRemote: false,
        remoteLastModified: null,
        localLastModified: null,
        syncStatus: 'error',
        isSyncing: false,
        lastSyncError: error.message,
        periodicSyncActive: false
      };
    }
  }
}

// Create singleton instance
export const gitHubSync = new GitHubSyncManager();
