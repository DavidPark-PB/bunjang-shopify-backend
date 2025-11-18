const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Verify Shopify HMAC signature for App Proxy requests
 * Shopify signs all App Proxy requests with HMAC
 */
const verifyShopifyHMAC = (req, res, next) => {
  // In development, skip HMAC verification if configured
  if (config.server.env === 'development' && process.env.SKIP_HMAC_VERIFICATION === 'true') {
    logger.warn('Skipping HMAC verification in development mode');
    return next();
  }

  const { signature, ...params } = req.query;

  if (!signature) {
    logger.warn('No HMAC signature found in request');
    return res.status(401).json({
      success: false,
      error: 'Missing HMAC signature',
    });
  }

  try {
    // Build query string for HMAC verification
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    // Generate HMAC
    const hash = crypto
      .createHmac('sha256', config.shopify.apiSecret)
      .update(sortedParams)
      .digest('hex');

    // Compare signatures
    if (hash !== signature) {
      logger.warn('Invalid HMAC signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid HMAC signature',
      });
    }

    logger.debug('HMAC signature verified successfully');
    next();
  } catch (error) {
    logger.error('HMAC verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'HMAC verification failed',
    });
  }
};

/**
 * Extract shop domain from request
 */
const extractShopDomain = (req, res, next) => {
  const shop = req.query.shop || req.headers['x-shopify-shop-domain'];

  if (!shop) {
    logger.warn('No shop domain found in request');
  } else {
    req.shopDomain = shop;
    logger.debug(`Shop domain extracted: ${shop}`);
  }

  next();
};

module.exports = {
  verifyShopifyHMAC,
  extractShopDomain,
};
