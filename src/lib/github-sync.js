import { authStore } from './stores/auth.js';
import { haikuDB } from './stores/haiku-db.js';
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
   * Get sync status information
   * @returns {Promise<Object>}
   */
  async getSyncStatus() {
    try {
      const localHaikus = await haikuDB.getAll();
      const syncedCount = localHaikus.filter(h => h.syncedAt).length;
      const existingGist = await this.findHaikuGist();

      return {
        totalLocal: localHaikus.length,
        synced: syncedCount,
        unsynced: localHaikus.length - syncedCount,
        hasRemoteGist: !!existingGist,
        gistId: existingGist?.id || null,
        lastSyncTime: this.lastSyncTime
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        totalLocal: 0,
        synced: 0,
        unsynced: 0,
        hasRemoteGist: false,
        gistId: null,
        lastSyncTime: null
      };
    }
  }
}

// Create singleton instance
export const gitHubSync = new GitHubSyncManager();
