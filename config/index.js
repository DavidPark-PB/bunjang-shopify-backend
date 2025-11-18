require('dotenv').config();

module.exports = {
  // Shopify Configuration
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    shopName: process.env.SHOPIFY_SHOP_NAME,
  },

  // Bunjang API Configuration
  bunjang: {
    apiUrl: process.env.BUNJANG_API_URL || 'https://openapi.bunjang.co.kr',
    accessKey: process.env.BUNJANG_ACCESS_KEY,
    secretKey: process.env.BUNJANG_SECRET_KEY,
    // Legacy support (if you have a pre-generated token)
    apiToken: process.env.BUNJANG_API_TOKEN,
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // Cache Configuration (TTL in seconds)
  cache: {
    productsTTL: parseInt(process.env.CACHE_PRODUCTS_TTL) || 300, // 5 minutes
    productDetailTTL: parseInt(process.env.CACHE_PRODUCT_DETAIL_TTL) || 600, // 10 minutes
    categoriesTTL: parseInt(process.env.CACHE_CATEGORIES_TTL) || 3600, // 1 hour
  },
};
