const express = require('express');
const router = express.Router();
const { Category } = require('../models');

// GET /api/categories - List all categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      order: [['name', 'ASC']]
    });

    res.json({
      categories,
      count: categories.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - Get category by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
});

module.exports = router;