/**
 * Database Configuration
 * Sequelize setup with deliberate performance issues for demo
 */

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Initialize Sequelize with configuration
const sequelize = new Sequelize(process.env.DATABASE_URL || {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'perftest',
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'pass',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    // Deliberately low for demo when ENABLE_CONNECTION_EXHAUSTION is true
    max: process.env.ENABLE_CONNECTION_EXHAUSTION === 'true' ? 2 : 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;