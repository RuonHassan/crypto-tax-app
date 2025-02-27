/**
 * Service for handling caching operations using localStorage
 */
export default class CacheService {
  constructor(cacheKeyPrefix = 'solana_tx_') {
    this.CACHE_KEY_PREFIX = cacheKeyPrefix;
  }
  
  /**
   * Retrieve data from cache
   * @param {string} key - The cache key
   * @returns {any|null} - The cached data or null if not found
   */
  getFromCache(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Save data to cache
   * @param {string} key - The cache key
   * @param {any} data - The data to cache
   * @returns {boolean} - Success status
   */
  saveToCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving to cache:', error);
      return false;
    }
  }

  /**
   * Clear a specific cache entry
   * @param {string} key - The cache key to clear
   * @returns {boolean} - Success status
   */
  clearCache(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error clearing cache for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear cache for a specific wallet
   * @param {string} walletAddress - The wallet address
   * @returns {boolean} - Success status
   */
  clearTransactionCache(walletAddress) {
    try {
      localStorage.removeItem(`${this.CACHE_KEY_PREFIX}${walletAddress}`);
      return true;
    } catch (error) {
      console.error(`Error clearing cache for wallet ${walletAddress}:`, error);
      return false;
    }
  }

  /**
   * Clear all transaction cache entries
   * @returns {number} - Number of cache entries cleared
   */
  clearAllTransactionCache() {
    let count = 0;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.CACHE_KEY_PREFIX)) {
          keys.push(key);
        }
      }
      
      keys.forEach(key => {
        localStorage.removeItem(key);
        count++;
      });
      
      return count;
    } catch (error) {
      console.error('Error clearing all transaction cache:', error);
      return count;
    }
  }
} 