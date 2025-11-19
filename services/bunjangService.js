const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');
const cacheService = require('./cacheService');
const bunjangAuth = require('./bunjangAuthService');

class BunjangService {
  constructor() {
    this.client = axios.create({
      baseURL: config.bunjang.apiUrl,
      timeout: 10000, // 10 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for JWT token generation and logging
    this.client.interceptors.request.use(
      (reqConfig) => {
        // Generate fresh JWT token for each request (valid for 5 seconds)
        const method = reqConfig.method ? reqConfig.method.toUpperCase() : 'GET';
        reqConfig.headers['Authorization'] = bunjangAuth.getAuthHeader(method);

        logger.debug(`Bunjang API Request: ${method} ${reqConfig.url}`);
        return reqConfig;
      },
      (error) => {
        logger.error('Bunjang API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Bunjang API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        // Log detailed error information
        const errorInfo = {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        };

        // Log response data if available (API error message)
        if (error.response?.data) {
          errorInfo.responseData = error.response.data;
        }

        // Log request headers for debugging (without sensitive info)
        if (error.config?.headers) {
          errorInfo.authHeader = error.config.headers.Authorization ? 'Present' : 'Missing';
        }

        logger.error('Bunjang API Response Error:', errorInfo);
        return Promise.reject(error);
      }
    );

    logger.info('Bunjang service initialized');
  }

  /**
   * Get products list with optional filters
   * Based on: https://api.bgzt.guide/api-10622550
   *
   * @param {object} params - Query parameters
   * @param {string} params.q - Search keyword (optional)
   * @param {number} params.size - Max items (1-100, default: 100)
   * @param {string} params.sort - Sort: score, latest, price_asc, price_desc
   * @param {string} params.cursor - Next page cursor
   * @param {string} params.categoryId - Category ID(s), comma-separated
   * @param {number} params.brandId - Brand ID(s), comma-separated
   * @param {number} params.uid - Store ID(s), comma-separated
   * @param {number} params.minPrice - Min price filter
   * @param {number} params.maxPrice - Max price filter
   * @param {boolean} params.freeShipping - Free shipping filter
   * @param {boolean} params.canInstantTrade - Instant trade available
   * @returns {Promise<object>} Products data with pagination
   */
  async getProducts(params = {}) {
    const cacheKey = `products:${JSON.stringify(params)}`;

    // Try to get from cache first
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Correct endpoint: /api/v1/products (GET)
      const response = await this.client.get('/api/v1/products', { params });
      const data = response.data;

      // Cache the result
      cacheService.set(cacheKey, data, config.cache.productsTTL);

      return data;
    } catch (error) {
      logger.error('Failed to fetch products:', error.message);

      // Return cached data if available, even if expired
      const expiredCache = cacheService.get(cacheKey);
      if (expiredCache) {
        logger.warn('Returning expired cache due to API error');
        return expiredCache;
      }

      throw error;
    }
  }

  /**
   * Get on-sale products
   * @returns {Promise<object>} On-sale products data
   */
  async getOnSaleProducts() {
    const cacheKey = 'products:on-sale';

    const cached = cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get('/api/v1/products/on-sale');
      const data = response.data;

      cacheService.set(cacheKey, data, config.cache.productsTTL);

      return data;
    } catch (error) {
      logger.error('Failed to fetch on-sale products:', error.message);
      throw error;
    }
  }

  /**
   * Get single product by ID (pid)
   * Based on: https://api.bgzt.guide/api-10622538
   * @param {string} productId - Product ID (pid)
   * @returns {Promise<object>} Product data
   */
  async getProduct(productId) {
    const cacheKey = `product:${productId}`;

    const cached = cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Correct endpoint: /api/v1/products/{pid}
      const response = await this.client.get(`/api/v1/products/${productId}`);
      const data = response.data;

      cacheService.set(cacheKey, data, config.cache.productDetailTTL);

      return data;
    } catch (error) {
      logger.error(`Failed to fetch product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get product categories
   * @returns {Promise<object>} Categories data
   */
  async getCategories() {
    const cacheKey = 'categories';

    const cached = cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get('/api/v1/categories');
      const data = response.data;

      cacheService.set(cacheKey, data, config.cache.categoriesTTL);

      return data;
    } catch (error) {
      logger.error('Failed to fetch categories:', error.message);
      throw error;
    }
  }

  /**
   * Get brands list
   * @returns {Promise<object>} Brands data
   */
  async getBrands() {
    const cacheKey = 'brands';

    const cached = cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get('/api/v1/brands');
      const data = response.data;

      cacheService.set(cacheKey, data, config.cache.categoriesTTL);

      return data;
    } catch (error) {
      logger.error('Failed to fetch brands:', error.message);
      throw error;
    }
  }

  /**
   * Get point balance
   * @returns {Promise<object>} Point balance data
   */
  async getPointBalance() {
    try {
      const response = await this.client.get('/api/v1/points/balance');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch point balance:', error.message);
      throw error;
    }
  }

  /**
   * Convert KRW to USD with 10% markup
   * @param {number} krwPrice - Price in Korean Won
   * @returns {number} Price in USD with markup
   */
  convertPriceToUSD(krwPrice) {
    const USD_EXCHANGE_RATE = 1350; // 1 USD = 1350 KRW (approximate)
    const MARKUP_PERCENT = 0.10; // 10% markup

    // Convert to USD
    const usdPrice = krwPrice / USD_EXCHANGE_RATE;

    // Add 10% markup
    const priceWithMarkup = usdPrice * (1 + MARKUP_PERCENT);

    // Round to 2 decimal places
    return Math.round(priceWithMarkup * 100) / 100;
  }

  /**
   * Transform Bunjang product to Shopify-compatible format
   * Based on actual Bunjang API response structure
   * @param {object} bunjangProduct - Bunjang product object
   * @returns {object} Shopify-compatible product object
   */
  transformToShopifyFormat(bunjangProduct) {
    // Generate images array from imageUrlTemplate
    const images = [];
    if (bunjangProduct.imageUrlTemplate && bunjangProduct.imageCount) {
      for (let i = 1; i <= bunjangProduct.imageCount; i++) {
        images.push(bunjangProduct.imageUrlTemplate.replace('{cnt}', i));
      }
    }

    // Convert prices to USD with markup
    const priceUSD = this.convertPriceToUSD(bunjangProduct.price);
    const shippingFeeUSD = this.convertPriceToUSD(bunjangProduct.shippingFee || 0);

    return {
      id: bunjangProduct.pid,
      title: bunjangProduct.name,
      description: bunjangProduct.description || '',
      price: priceUSD,
      priceKRW: bunjangProduct.price,
      shippingFee: shippingFeeUSD,
      shippingFeeKRW: bunjangProduct.shippingFee,
      currency: 'USD',
      images: images,
      imageUrlTemplate: bunjangProduct.imageUrlTemplate,
      imageCount: bunjangProduct.imageCount,
      category: bunjangProduct.categoryId,
      categoryId: bunjangProduct.categoryId,
      brand: bunjangProduct.brandId,
      brandId: bunjangProduct.brandId,
      condition: bunjangProduct.condition, // NEW, LIKE_NEW, USED, HEAVILY_USED
      saleStatus: bunjangProduct.saleStatus, // SELLING, SOLD, etc.
      quantity: bunjangProduct.quantity,
      keywords: bunjangProduct.keywords,
      options: bunjangProduct.options || [],
      url: `https://m.bunjang.co.kr/products/${bunjangProduct.pid}`,
      seller: {
        uid: bunjangProduct.uid
      },
      createdAt: bunjangProduct.createdAt,
      updatedAt: bunjangProduct.updatedAt,
    };
  }
}

module.exports = new BunjangService();
