/**
 * Product Model
 */

const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sku: {
    type: DataTypes.STRING,
    unique: true
  },
  imageUrl: {
    type: DataTypes.STRING
  },
  categoryId: {
    type: DataTypes.UUID,
    references: {
      model: 'Categories',
      key: 'id'
    }
  },
  specifications: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  // Missing indexes for demo when ENABLE_MISSING_INDEXES is true
  indexes: process.env.ENABLE_MISSING_INDEXES !== 'true' ? [
    { fields: ['categoryId'] },
    { fields: ['sku'] },
    { fields: ['name'] }
  ] : []
});

module.exports = Product;