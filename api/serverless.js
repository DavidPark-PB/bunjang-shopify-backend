// Vercel Serverless Entry Point with dependency injection
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const NodeCache = require('node-cache');

// ===== CONFIG =====
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
    productsTTL: 300,
    productDetailTTL: 600,
    categoriesTTL: 3600,
  },
};

// ===== LOGGER =====
const logger = {
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  debug: (...args) => console.log('[DEBUG]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// ===== CACHE SERVICE =====
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

// ===== AUTH SERVICE =====
class BunjangAuthService {
  constructor() {
    this.accessKey = config.bunjang.accessKey;
    this.secretKey = config.bunjang.secretKey;
  }

  generateToken(method = 'GET') {
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      accessKey: this.accessKey,
      nonce: uuidv4(),
    };

    const secretKeyBuffer = Buffer.from(this.secretKey, 'base64');
    const token = jwt.sign(payload, secretKeyBuffer, {
      algorithm: 'HS256',
      expiresIn: '5s',
    });

    return token;
  }

  getAuthHeader(method = 'GET') {
    const token = this.generateToken(method);
    return `Bearer ${token}`;
  }
}

const authService = new BunjangAuthService();

// ===== BUNJANG SERVICE =====
const bunjangClient = axios.create({
  baseURL: config.bunjang.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

bunjangClient.interceptors.request.use((requestConfig) => {
  const method = requestConfig.method?.toUpperCase() || 'GET';
  requestConfig.headers['Authorization'] = authService.getAuthHeader(method);
  return requestConfig;
});

async function getProducts(params = {}) {
  const cacheKey = `products:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await bunjangClient.get('/api/v1/products', { params });
  cache.set(cacheKey, response.data, config.cache.productsTTL);

  return response.data;
}

function transformToShopifyFormat(bunjangProduct) {
  const images = [];
  if (bunjangProduct.imageUrlTemplate && bunjangProduct.imageCount) {
    for (let i = 1; i <= bunjangProduct.imageCount; i++) {
      images.push(bunjangProduct.imageUrlTemplate.replace('{cnt}', i));
    }
  }

  return {
    id: bunjangProduct.pid,
    title: bunjangProduct.name,
    description: bunjangProduct.description || '',
    price: bunjangProduct.price,
    compareAtPrice: bunjangProduct.originalPrice || null,
    images: images,
    url: bunjangProduct.productUrl,
    vendor: bunjangProduct.account?.name || 'Unknown',
    tags: bunjangProduct.tags || [],
    saleStatus: bunjangProduct.status,
    shippingFee: bunjangProduct.shippingFee || 0,
    quantity: bunjangProduct.quantity || 1,
    condition: bunjangProduct.productCondition,
    location: bunjangProduct.location,
    createdAt: bunjangProduct.updateTime,
    views: bunjangProduct.viewCount || 0,
    likes: bunjangProduct.favoriteCount || 0,
  };
}

// ===== EXPRESS APP =====
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: () => true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bunjang Shopify Backend is running',
    timestamp: new Date().toISOString(),
    environment: config.server.env,
  });
});

// Products endpoint
app.get('/shopify-proxy/products', async (req, res) => {
  try {
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

    const parsedMinPrice = minPrice && minPrice !== 'undefined' && !isNaN(minPrice) ? parseInt(minPrice) : null;
    const parsedMaxPrice = maxPrice && maxPrice !== 'undefined' && !isNaN(maxPrice) ? parseInt(maxPrice) : null;

    const params = {
      size: Math.min(parseInt(size), 100),
      ...(q && { q }),
      ...(cursor && { cursor }),
      ...(sort && { sort }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(parsedMinPrice && { minPrice: parsedMinPrice }),
      ...(parsedMaxPrice && { maxPrice: parsedMaxPrice }),
      ...(freeShipping && { freeShipping: freeShipping === 'true' }),
    };

    const data = await getProducts(params);

    let products = [];
    if (data.data && Array.isArray(data.data)) {
      products = data.data.map((product) => transformToShopifyFormat(product));
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
    logger.error('Error fetching products:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products from Bunjang',
      message: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
  });
});

module.exports = app;
