// Vercel-specific configuration
// This replaces config and logger modules for serverless environment

// Export config
const config = {
  bunjang: {
    apiUrl: process.env.BUNJANG_API_URL || 'https://openapi.bunjang.co.kr',
    accessKey: process.env.BUNJANG_ACCESS_KEY,
    secretKey: process.env.BUNJANG_SECRET_KEY,
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'production',
  },
  cache: {
    productsTTL: parseInt(process.env.CACHE_PRODUCTS_TTL) || 300,
    productDetailTTL: parseInt(process.env.CACHE_PRODUCT_DETAIL_TTL) || 600,
    categoriesTTL: parseInt(process.env.CACHE_CATEGORIES_TTL) || 3600,
  },
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    shopName: process.env.SHOPIFY_SHOP_NAME,
  },
};

// Export logger
const logger = {
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  debug: (...args) => {
    if (config.server.env === 'development') {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// Override require paths for serverless
if (typeof global !== 'undefined') {
  global.vercelConfig = config;
  global.vercelLogger = logger;
}

module.exports = { config, logger };
