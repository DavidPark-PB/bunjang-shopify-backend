const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Bunjang API JWT Token Generator
 * Based on: https://api.bgzt.guide/doc-662202
 */
class BunjangAuthService {
  constructor() {
    this.accessKey = config.bunjang.accessKey;
    this.secretKey = config.bunjang.secretKey;

    logger.info('Bunjang Auth service initialized');
  }

  /**
   * Generate JWT token for Bunjang API authentication
   * Token is valid for 5 seconds as per API spec
   *
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @returns {string} JWT token
   */
  generateToken(method = 'GET') {
    const payload = {
      iat: Math.floor(Date.now() / 1000), // Current timestamp in seconds
      accessKey: this.accessKey,
      nonce: uuidv4(), // Always include nonce for all methods
    };

    try {
      // Decode base64 secret key
      const secretKeyBuffer = Buffer.from(this.secretKey, 'base64');

      const token = jwt.sign(payload, secretKeyBuffer, {
        algorithm: 'HS256',
        // Token expires in 5 seconds
        expiresIn: '5s',
      });

      logger.debug(`JWT Token generated for ${method} method`);
      return token;
    } catch (error) {
      logger.error('Failed to generate JWT token:', error);
      throw new Error('JWT token generation failed');
    }
  }

  /**
   * Get Authorization header value
   *
   * @param {string} method - HTTP method
   * @returns {string} Bearer token string
   */
  getAuthHeader(method = 'GET') {
    const token = this.generateToken(method);
    return `Bearer ${token}`;
  }

  /**
   * Verify if token generation is working
   *
   * @returns {boolean} true if token can be generated
   */
  verifySetup() {
    if (!this.accessKey || !this.secretKey) {
      logger.error('Bunjang accessKey or secretKey not configured');
      return false;
    }

    try {
      const token = this.generateToken('GET');
      logger.info('Bunjang Auth setup verified successfully');
      return true;
    } catch (error) {
      logger.error('Bunjang Auth setup verification failed:', error);
      return false;
    }
  }
}

module.exports = new BunjangAuthService();
