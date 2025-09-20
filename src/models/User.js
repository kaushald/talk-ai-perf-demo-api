/**
 * User Model
 */

const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  phoneNumber: {
    type: DataTypes.STRING
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  // Missing indexes for demo when ENABLE_MISSING_INDEXES is true
  indexes: process.env.ENABLE_MISSING_INDEXES !== 'true' ? [
    { fields: ['email'] },
    { fields: ['username'] }
  ] : []
});

module.exports = User;