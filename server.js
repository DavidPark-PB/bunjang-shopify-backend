/**
 * Bunjang Shopify App Proxy Server
 *
 * Features:
 * - Shopify App Proxy (/proxy/*)
 * - Real-time KRW to USD conversion with 10% markup
 * - Shopify Webhook (orders/paid) for auto-purchase
 * - Bunjang API integration with JWT authentication
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/json' })); // For webhook HMAC verification

// ===== ENVIRONMENT VARIABLES =====
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;

const BUNJANG_API_URL = process.env.BUNJANG_API_URL || 'https://openapi.bunjang.co.kr';
const BUNJANG_ACCESS_KEY = process.env.BUNJANG_ACCESS_KEY;
const BUNJANG_SECRET_KEY = process.env.BUNJANG_SECRET_KEY;

const EXCHANGE_RATE_API_URL = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/KRW';

// ===== EXCHANGE RATE CACHE =====
let exchangeRateCache = {
  rate: 0.00074, // Fallback: 1 KRW = 0.00074 USD (approx 1 USD = 1350 KRW)
  timestamp: 0,
  ttl: 3600000, // 1 hour
};

/**
 * Fetch real-time exchange rate (KRW to USD)
 */
async function getExchangeRate() {
  const now = Date.now();

  // Return cached rate if still valid
  if (exchangeRateCache.rate && (now - exchangeRateCache.timestamp < exchangeRateCache.ttl)) {
    return exchangeRateCache.rate;
  }

  try {
    console.log('[Exchange Rate] Fetching latest rate from API...');
    const response = await axios.get(EXCHANGE_RATE_API_URL, { timeout: 5000 });

    // API response format: { "rates": { "USD": 0.00074 } }
    const usdRate = response.data.rates?.USD || response.data.conversion_rates?.USD;

    if (usdRate) {
      exchangeRateCache = {
        rate: usdRate,
        timestamp: now,
        ttl: 3600000,
      };
      console.log(`[Exchange Rate] Updated: 1 KRW = ${usdRate} USD`);
      return usdRate;
    }
  } catch (error) {
    console.error('[Exchange Rate] Failed to fetch, using fallback rate:', error.message);
  }

  // Return fallback rate
  return exchangeRateCache.rate;
}

/**
 * Convert KRW to USD with 10% markup
 * @param {number} krwPrice - Price in Korean Won
 * @param {number} exchangeRate - Current KRW to USD rate
 * @returns {number} - Price in USD with 10% markup, rounded to 2 decimals
 */
function convertPriceToUSD(krwPrice, exchangeRate) {
  const usdPrice = krwPrice * exchangeRate;
  const priceWithMarkup = usdPrice * 1.10; // Add 10% markup
  return Math.round(priceWithMarkup * 100) / 100;
}

// ===== BUNJANG JWT AUTHENTICATION =====
/**
 * Generate JWT token for Bunjang API authentication
 */
function generateBunjangToken() {
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    accessKey: BUNJANG_ACCESS_KEY,
    nonce: crypto.randomUUID(),
  };

  const secretKeyBuffer = Buffer.from(BUNJANG_SECRET_KEY, 'base64');

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secretKeyBuffer)
    .update(`${header}.${payloadEncoded}`)
    .digest('base64url');

  return `${header}.${payloadEncoded}.${signature}`;
}

/**
 * Call Bunjang API with authentication
 */
async function callBunjangAPI(endpoint, params = {}) {
  const token = generateBunjangToken();

  try {
    const response = await axios.get(`${BUNJANG_API_URL}${endpoint}`, {
      params,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error('[Bunjang API Error]', error.response?.data || error.message);
    throw error;
  }
}

// ===== SHOPIFY APP PROXY ROUTES =====
/**
 * Main proxy route handler
 * Shopify URL: https://store.com/apps/bunjang/*
 * Forwarded to: https://render.com/proxy/*
 */
app.get('/proxy/*', async (req, res) => {
  try {
    console.log('[Proxy Request]', req.path, req.query);

    // Extract path after /proxy/
    const proxyPath = req.path.replace('/proxy/', '');

    // Get real-time exchange rate
    const exchangeRate = await getExchangeRate();
    console.log(`[Exchange Rate] Using rate: 1 KRW = ${exchangeRate} USD`);

    // Route based on path
    if (proxyPath === 'products' || proxyPath === 'search') {
      // Get products from Bunjang
      const bunjangData = await callBunjangAPI('/api/v1/products', req.query);

      // Transform products: convert KRW to USD with 10% markup
      const transformedProducts = (bunjangData.data || []).map(product => {
        const priceUSD = convertPriceToUSD(product.price, exchangeRate);
        const shippingFeeUSD = convertPriceToUSD(product.shippingFee || 0, exchangeRate);

        return {
          id: product.pid,
          title: product.name,
          description: product.description || '',
          price: priceUSD,
          priceKRW: product.price,
          shippingFee: shippingFeeUSD,
          shippingFeeKRW: product.shippingFee,
          currency: 'USD',
          images: generateImages(product.imageUrlTemplate, product.imageCount),
          url: `https://m.bunjang.co.kr/products/${product.pid}`,
          condition: product.condition,
          saleStatus: product.saleStatus,
          views: product.viewCount || 0,
          likes: product.favoriteCount || 0,
          seller: { uid: product.uid },
          createdAt: product.updateTime,
        };
      });

      res.json({
        success: true,
        data: {
          products: transformedProducts,
          pagination: {
            cursor: bunjangData.nextCursor,
            hasNext: bunjangData.hasNext,
            count: transformedProducts.length,
          },
        },
        exchangeRate: {
          rate: exchangeRate,
          base: 'KRW',
          target: 'USD',
          markup: '10%',
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    }
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data from Bunjang',
      message: error.message,
    });
  }
});

/**
 * Generate image URLs from template
 */
function generateImages(template, count) {
  if (!template || !count) return [];
  const images = [];
  for (let i = 1; i <= count; i++) {
    images.push(template.replace('{cnt}', i));
  }
  return images;
}

// ===== SHOPIFY WEBHOOK: orders/paid =====
/**
 * Verify Shopify Webhook HMAC
 */
function verifyShopifyWebhook(req) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const body = req.rawBody || JSON.stringify(req.body);

  const hash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return hash === hmacHeader;
}

/**
 * Webhook handler for Shopify orders/paid
 * When customer completes payment, automatically purchase from Bunjang
 */
app.post('/webhooks/shopify/orders-paid', async (req, res) => {
  try {
    console.log('[Webhook] Received orders/paid webhook');

    // Verify HMAC
    if (!verifyShopifyWebhook(req)) {
      console.error('[Webhook] HMAC verification failed');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const order = req.body;
    console.log(`[Webhook] Processing Shopify Order ${order.id}`);

    // Extract line items
    const lineItems = order.line_items || [];
    const purchaseResults = [];

    for (const item of lineItems) {
      try {
        // SKU should contain Bunjang item_id (e.g., "BUNJANG-370326148")
        const sku = item.sku;
        const bunjangItemId = sku?.replace('BUNJANG-', '');

        if (!bunjangItemId) {
          console.warn('[Webhook] No Bunjang item_id found for SKU:', sku);
          continue;
        }

        console.log(`[Webhook] Purchasing Bunjang item ${bunjangItemId}...`);

        // Call Bunjang purchase API (placeholder)
        // TODO: Implement actual Bunjang order API when available
        const bunjangOrder = await createBunjangOrder({
          item_id: bunjangItemId,
          quantity: item.quantity,
          buyer_note: order.note || '',
          address: {
            name: order.shipping_address?.name,
            address1: order.shipping_address?.address1,
            address2: order.shipping_address?.address2,
            city: order.shipping_address?.city,
            zip: order.shipping_address?.zip,
            country: order.shipping_address?.country_code,
          },
          payment_method: 'card',
        });

        purchaseResults.push({
          shopify_line_item_id: item.id,
          bunjang_order_id: bunjangOrder.order_id,
          status: 'success',
        });

        // Save Bunjang order_id to Shopify metafield
        await saveOrderMetafield(order.id, bunjangOrder.order_id);

      } catch (error) {
        console.error(`[Webhook] Failed to purchase item ${item.sku}:`, error.message);
        purchaseResults.push({
          shopify_line_item_id: item.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      shopify_order_id: order.id,
      purchases: purchaseResults,
    });

  } catch (error) {
    console.error('[Webhook Error]', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create Bunjang order (placeholder)
 * TODO: Replace with actual Bunjang order API
 */
async function createBunjangOrder(orderData) {
  console.log('[Bunjang Order] Creating order:', orderData);

  // Placeholder - replace with actual API call
  // const token = generateBunjangToken();
  // const response = await axios.post(
  //   `${BUNJANG_API_URL}/api/v1/orders`,
  //   orderData,
  //   {
  //     headers: {
  //       'Authorization': `Bearer ${token}`,
  //       'Content-Type': 'application/json',
  //     },
  //   }
  // );

  // For now, return mock order
  return {
    order_id: `BUNJANG-${Date.now()}`,
    status: 'pending',
  };
}

/**
 * Save Bunjang order_id to Shopify order metafield
 */
async function saveOrderMetafield(shopifyOrderId, bunjangOrderId) {
  try {
    console.log(`[Shopify Metafield] Saving Bunjang order ${bunjangOrderId} to Shopify order ${shopifyOrderId}`);

    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${shopifyOrderId}/metafields.json`;

    await axios.post(
      url,
      {
        metafield: {
          namespace: 'bunjang',
          key: 'order_id',
          value: bunjangOrderId,
          type: 'single_line_text_field',
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[Shopify Metafield] Saved successfully`);
  } catch (error) {
    console.error('[Shopify Metafield Error]', error.response?.data || error.message);
    throw error;
  }
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bunjang Shopify Proxy Server is running',
    timestamp: new Date().toISOString(),
    exchangeRate: {
      rate: exchangeRateCache.rate,
      lastUpdated: new Date(exchangeRateCache.timestamp).toISOString(),
    },
  });
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
  });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log(`🚀 Bunjang Shopify Proxy Server running on port ${PORT}`);
  console.log(`📍 Proxy endpoint: /proxy/*`);
  console.log(`📍 Webhook endpoint: /webhooks/shopify/orders-paid`);

  // Pre-fetch exchange rate on startup
  try {
    const rate = await getExchangeRate();
    console.log(`💱 Exchange rate loaded: 1 KRW = ${rate} USD`);
  } catch (error) {
    console.error('⚠️  Failed to fetch exchange rate on startup');
  }
});

module.exports = app;
