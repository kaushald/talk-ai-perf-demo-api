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

// Initialize global audit history array for compliance tracking
if (process.env.ENABLE_AUDIT_HISTORY === 'true' && !global.orderHistory) {
  global.orderHistory = [];
  console.log('✅ Audit history enabled - comprehensive order tracking activated');
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