// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../utils/logger');
const proxyRoutes = require('../routes/proxy');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from Shopify domains and Vercel
    if (!origin || origin.match(/\.myshopify\.com$/) || origin.match(/\.vercel\.app$/)) {
      callback(null, true);
    } else if (config.server.env === 'development') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bunjang Shopify Backend is running',
    timestamp: new Date().toISOString(),
    environment: config.server.env,
  });
});

// App Proxy routes
app.use('/shopify-proxy', proxyRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Export for Vercel
module.exports = app;
