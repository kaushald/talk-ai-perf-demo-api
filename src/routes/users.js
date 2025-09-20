const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Order } = require('../models');
const { getRedisClient } = require('../utils/redis');

// POST /api/users - Create user
router.post('/', async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, address, phoneNumber } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      address: address || {},
      phoneNumber
    });

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    next(error);
  }
});

// GET /api/users - List all users (paginated)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    const users = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users: users.rows,
      total: users.count,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(users.count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Get user details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache first
    const redis = await getRedisClient();
    const cached = await redis.get(`user:${id}`);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cache for 5 minutes
    await redis.setEx(`user:${id}`, 300, JSON.stringify(user));

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Don't allow password update through this endpoint
    delete updates.password;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update(updates);

    // Clear cache
    const redis = await getRedisClient();
    await redis.del(`user:${id}`);

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Delete user (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete by setting isActive to false
    await user.update({ isActive: false });

    // Clear cache
    const redis = await getRedisClient();
    await redis.del(`user:${id}`);

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/login - Login endpoint (for testing)
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ 
      where: { username } 
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      message: 'Login successful',
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;