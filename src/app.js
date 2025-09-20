const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const winston = require('winston');
const { register, collectDefaultMetrics } = require('prom-client');
require('dotenv').config();

const { sequelize } = require('./models');
const { initRedis } = require('./utils/redis');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const metricsRoutes = require('./routes/metrics');

// Initialize Express app
const app = express();
const server = createServer(app);

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Collect default metrics for Prometheus
collectDefaultMetrics({ prefix: 'demo_app_' });

// Global array for demonstrating memory leak
global.orderHistory = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger(logger));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Add redirect for /api/search to /api/products/search
app.get('/api/search', (req, res) => {
  const queryString = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
  res.redirect('/api/products/search' + queryString);
});

// Memory leak demonstration endpoint
app.get('/api/memory-leak', (req, res) => {
  res.json({
    orderHistorySize: global.orderHistory.length,
    estimatedMemoryMB: (global.orderHistory.length * 0.01).toFixed(2),
    message: 'Memory leak demonstration - check orderHistorySize',
    note: 'Create orders to increase memory usage'
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    orderHistorySize: global.orderHistory.length // Shows memory leak growth
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'E-commerce Demo API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      health: '/health',
      metrics: '/metrics'
    },
    performanceIssues: {
      nPlusOne: process.env.ENABLE_N_PLUS_ONE === 'true',
      memoryLeak: process.env.ENABLE_MEMORY_LEAK === 'true',
      slowSearch: process.env.ENABLE_SLOW_SEARCH === 'true',
      syncBlocking: process.env.ENABLE_SYNC_BLOCKING === 'true',
      connectionExhaustion: process.env.ENABLE_CONNECTION_EXHAUSTION === 'true'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Database connection established');

    // Sync database models
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }

    // Initialize Redis
    await initRedis();
    logger.info('Redis connection established');

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Metrics available at http://localhost:${PORT}/metrics`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  server.close(() => {
    logger.info('HTTP server closed');
  });
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;