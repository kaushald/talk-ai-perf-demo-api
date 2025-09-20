/**
 * Models Index - Refactored
 * Central export point for all models
 */

const sequelize = require('./config/database');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const setupAssociations = require('./associations');

// Initialize global memory leak array for demo
if (process.env.ENABLE_MEMORY_LEAK === 'true' && !global.orderHistory) {
  global.orderHistory = [];
  console.log('⚠️  Memory leak enabled for demo - orderHistory array will grow unbounded');
}

// Setup model associations
setupAssociations();

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Order,
  OrderItem
};