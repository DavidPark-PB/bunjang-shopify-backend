const express = require('express');
const router = express.Router();
const bunjangService = require('../services/bunjangService');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyShopifyHMAC, extractShopDomain } = require('../middleware/shopifyAuth');
const logger = require('../utils/logger');

// Apply middleware to all proxy routes
router.use(extractShopDomain);
// Note: Uncomment the line below to enable HMAC verification in production
// router.use(verifyShopifyHMAC);

/**
 * GET /shopify-proxy/products
 * Get list of products from Bunjang
 * Query params:
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 12)
 *   - category: filter by category
 *   - search: search query
 *   - sortBy: sort field (price, createdAt, etc.)
 *   - sortOrder: asc or desc
 */
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    logger.info('Fetching products from Bunjang', { query: req.query });

    const {
      size = 12,
      q,
      cursor,
      sort = 'latest',
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      freeShipping,
    } = req.query;

    // Parse and validate numeric values
    const parsedMinPrice = minPrice && minPrice !== 'undefined' && !isNaN(minPrice) ? parseInt(minPrice) : null;
    const parsedMaxPrice = maxPrice && maxPrice !== 'undefined' && !isNaN(maxPrice) ? parseInt(maxPrice) : null;

    // Build params for Bunjang API (based on actual API spec)
    const params = {
      size: Math.min(parseInt(size), 100), // Max 100
      ...(q && { q }),
      ...(cursor && { cursor }),
      ...(sort && { sort }), // score, latest, price_asc, price_desc
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(parsedMinPrice && { minPrice: parsedMinPrice }),
      ...(parsedMaxPrice && { maxPrice: parsedMaxPrice }),
      ...(freeShipping && { freeShipping: freeShipping === 'true' }),
    };

    try {
      const data = await bunjangService.getProducts(params);

      // Transform products to Shopify-compatible format
      let products = [];
      if (data.data && Array.isArray(data.data)) {
        products = data.data.map((product) =>
          bunjangService.transformToShopifyFormat(product)
        );
      }

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            cursor: data.nextCursor,
            hasNext: data.hasNext,
            size: parseInt(size),
            count: products.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products from Bunjang',
        message: error.message,
      });
    }
  })
);

/**
 * GET /shopify-proxy/products/on-sale
 * Get on-sale products from Bunjang
 */
router.get(
  '/products/on-sale',
  asyncHandler(async (req, res) => {
    logger.info('Fetching on-sale products from Bunjang');

    try {
      const data = await bunjangService.getOnSaleProducts();

      let products = [];
      if (data.data && Array.isArray(data.data)) {
        products = data.data.map((product) =>
          bunjangService.transformToShopifyFormat(product)
        );
      }

      res.json({
        success: true,
        data: { products },
      });
    } catch (error) {
      logger.error('Error fetching on-sale products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch on-sale products',
        message: error.message,
      });
    }
  })
);

/**
 * GET /shopify-proxy/products/:id
 * Get single product by ID
 */
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    logger.info(`Fetching product ${id} from Bunjang`);

    try {
      const data = await bunjangService.getProduct(id);

      const product = bunjangService.transformToShopifyFormat(data.data || data);

      res.json({
        success: true,
        data: { product },
      });
    } catch (error) {
      logger.error(`Error fetching product ${id}:`, error);

      if (error.response && error.response.status === 404) {
        res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch product',
          message: error.message,
        });
      }
    }
  })
);

/**
 * GET /shopify-proxy/categories
 * Get product categories
 */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    logger.info('Fetching categories from Bunjang');

    try {
      const data = await bunjangService.getCategories();

      res.json({
        success: true,
        data: data.data || data,
      });
    } catch (error) {
      logger.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories',
        message: error.message,
      });
    }
  })
);

/**
 * GET /shopify-proxy/brands
 * Get brands list
 */
router.get(
  '/brands',
  asyncHandler(async (req, res) => {
    logger.info('Fetching brands from Bunjang');

    try {
      const data = await bunjangService.getBrands();

      res.json({
        success: true,
        data: data.data || data,
      });
    } catch (error) {
      logger.error('Error fetching brands:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch brands',
        message: error.message,
      });
    }
  })
);

/**
 * GET /shopify-proxy/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bunjang Shopify Proxy is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
