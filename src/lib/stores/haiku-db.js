import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Haiku data structure
 * @typedef {Object} Haiku
 * @property {string} id - Unique identifier
 * @property {string} title - Haiku title
 * @property {string[]} lines - Array of haiku lines [line1, line2, line3]
 * @property {string} text - Full text (lines joined)
 * @property {string[]} tags - Array of tags for categorization
 * @property {string} status - Task status: 'todo' | 'in_progress' | 'done'
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {Object|null} analysis - AI analysis results
 * @property {number} analysis.rating - Star rating (1-5)
 * @property {string} analysis.commentary - AI commentary
 * @property {string[]} analysis.suggestedTags - AI suggested tags
 * @property {number|null} syncedAt - Last sync timestamp with GitHub
 * @property {string|null} gistId - GitHub gist ID for syncing
 */

const DB_NAME = 'HaikuDB';
const DB_VERSION = 1;
const STORE_NAME = 'haikus';

class HaikuDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (!browser) {
      throw new Error('IndexedDB is only available in browser environment');
    }

    if (this.isInitialized && this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create haikus object store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          store.createIndex('text', 'text', { unique: false });
        }
      };
    });
  }

  /**
   * Generate a unique ID for haiku
   * @returns {string}
   */
  generateId() {
    return `haiku_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new haiku
   * @param {Omit<Haiku, 'id' | 'createdAt' | 'updatedAt'>} haikuData
   * @returns {Promise<Haiku>}
   */
  async create(haikuData) {
    await this.init();
    
    const now = Date.now();
    const haiku = {
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      status: 'todo',
      tags: [],
      analysis: null,
      syncedAt: null,
      gistId: null,
      ...haikuData
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(haiku);

      request.onerror = () => {
        reject(new Error(`Failed to create haiku: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(haiku);
      };
    });
  }

  /**
   * Get a haiku by ID
   * @param {string} id
   * @returns {Promise<Haiku|null>}
   */
  async get(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => {
        reject(new Error(`Failed to get haiku: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  /**
   * Update a haiku
   * @param {string} id
   * @param {Partial<Haiku>} updates
   * @returns {Promise<Haiku>}
   */
  async update(id, updates) {
    await this.init();
    
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Haiku with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updated);

      request.onerror = () => {
        reject(new Error(`Failed to update haiku: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(updated);
      };
    });
  }

  /**
   * Delete a haiku
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        reject(new Error(`Failed to delete haiku: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get all haikus with optional filtering and sorting
   * @param {Object} options
   * @param {string} [options.status] - Filter by status
   * @param {string[]} [options.tags] - Filter by tags (AND operation)
   * @param {string} [options.sortBy] - Sort field: 'title' | 'createdAt' | 'updatedAt'
   * @param {string} [options.sortOrder] - Sort order: 'asc' | 'desc'
   * @param {string} [options.search] - Search text (title and content)
   * @returns {Promise<Haiku[]>}
   */
  async getAll(options = {}) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to get haikus: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        let haikus = request.result || [];

        // Apply filters
        if (options.status) {
          haikus = haikus.filter(h => h.status === options.status);
        }

        if (options.tags && options.tags.length > 0) {
          haikus = haikus.filter(h => 
            options.tags.every(tag => h.tags.includes(tag))
          );
        }

        if (options.search) {
          const searchLower = options.search.toLowerCase();
          haikus = haikus.filter(h => 
            h.title.toLowerCase().includes(searchLower) ||
            h.text.toLowerCase().includes(searchLower) ||
            (h.analysis?.commentary || '').toLowerCase().includes(searchLower)
          );
        }

        // Apply sorting
        if (options.sortBy) {
          haikus.sort((a, b) => {
            let aVal = a[options.sortBy];
            let bVal = b[options.sortBy];

            // Handle string sorting
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              aVal = aVal.toLowerCase();
              bVal = bVal.toLowerCase();
            }

            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;

            return options.sortOrder === 'desc' ? -comparison : comparison;
          });
        } else {
          // Default sort by most recent
          haikus.sort((a, b) => b.updatedAt - a.updatedAt);
        }

        resolve(haikus);
      };
    });
  }

  /**
   * Search haikus with full-text search
   * @param {string} query
   * @returns {Promise<Haiku[]>}
   */
  async search(query) {
    if (!query.trim()) {
      return this.getAll();
    }

    return this.getAll({ search: query });
  }

  /**
   * Get unique tags from all haikus
   * @returns {Promise<string[]>}
   */
  async getAllTags() {
    const haikus = await this.getAll();
    const tagSet = new Set();
    
    haikus.forEach(haiku => {
      haiku.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get haiku statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const haikus = await this.getAll();
    
    const stats = {
      total: haikus.length,
      byStatus: {
        todo: 0,
        in_progress: 0,
        done: 0
      },
      analyzed: 0,
      synced: 0
    };

    haikus.forEach(haiku => {
      stats.byStatus[haiku.status] = (stats.byStatus[haiku.status] || 0) + 1;
      if (haiku.analysis) stats.analyzed++;
      if (haiku.syncedAt) stats.synced++;
    });

    return stats;
  }

  /**
   * Clear all data (for testing or reset)
   * @returns {Promise<void>}
   */
  async clear() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}

// Create singleton instance
const haikuDB = new HaikuDatabase();

/**
 * Reactive store for haikus
 */
function createHaikuStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    
    /**
     * Load all haikus from database
     */
    async load(options = {}) {
      try {
        const haikus = await haikuDB.getAll(options);
        set(haikus);
        return haikus;
      } catch (error) {
        console.error('Failed to load haikus:', error);
        throw error;
      }
    },

    /**
     * Create a new haiku
     */
    async create(haikuData) {
      try {
        const haiku = await haikuDB.create(haikuData);
        update(haikus => [haiku, ...haikus]);
        return haiku;
      } catch (error) {
        console.error('Failed to create haiku:', error);
        throw error;
      }
    },

    /**
     * Update an existing haiku
     */
    async update(id, updates) {
      try {
        const updated = await haikuDB.update(id, updates);
        update(haikus => haikus.map(h => h.id === id ? updated : h));
        return updated;
      } catch (error) {
        console.error('Failed to update haiku:', error);
        throw error;
      }
    },

    /**
     * Delete a haiku
     */
    async delete(id) {
      try {
        await haikuDB.delete(id);
        update(haikus => haikus.filter(h => h.id !== id));
      } catch (error) {
        console.error('Failed to delete haiku:', error);
        throw error;
      }
    },

    /**
     * Search haikus
     */
    async search(query) {
      try {
        const results = await haikuDB.search(query);
        set(results);
        return results;
      } catch (error) {
        console.error('Failed to search haikus:', error);
        throw error;
      }
    },

    /**
     * Get statistics
     */
    async getStats() {
      try {
        return await haikuDB.getStats();
      } catch (error) {
        console.error('Failed to get stats:', error);
        throw error;
      }
    },

    /**
     * Get all unique tags
     */
    async getAllTags() {
      try {
        return await haikuDB.getAllTags();
      } catch (error) {
        console.error('Failed to get tags:', error);
        throw error;
      }
    },

    /**
     * Clear all haikus (for testing/reset)
     */
    async clear() {
      try {
        await haikuDB.clear();
        set([]);
      } catch (error) {
        console.error('Failed to clear haikus:', error);
        throw error;
      }
    }
  };
}

export const haikuStore = createHaikuStore();
export { haikuDB };
