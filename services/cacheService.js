const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const config = require('../config');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.productsTTL,
      checkperiod: 120, // Check for expired keys every 120 seconds
      useClones: false, // Don't clone objects for better performance
    });

    logger.info('Cache service initialized');
  }

  /**
   * Get a value from cache
   * @param {string} key
   * @returns {*} cached value or undefined
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        logger.debug(`Cache HIT for key: ${key}`);
        return value;
      }
      logger.debug(`Cache MISS for key: ${key}`);
      return undefined;
    } catch (error) {
      logger.error('Cache get error:', error);
      return undefined;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key
   * @param {*} value
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} success
   */
  set(key, value, ttl) {
    try {
      const success = this.cache.set(key, value, ttl);
      if (success) {
        logger.debug(`Cache SET for key: ${key}, TTL: ${ttl || 'default'}`);
      }
      return success;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   * @param {string} key
   * @returns {number} number of deleted entries
   */
  del(key) {
    try {
      const deleted = this.cache.del(key);
      logger.debug(`Cache DEL for key: ${key}`);
      return deleted;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} cache stats
   */
  getStats() {
    return this.cache.getStats();
  }
}

module.exports = new CacheService();
