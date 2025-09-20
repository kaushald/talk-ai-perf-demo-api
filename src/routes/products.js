const express = require('express');
const router = express.Router();
const { Product, Category } = require('../models');
const { getRedisClient } = require('../utils/redis');
const crypto = require('crypto');

// GET /api/products - List all products with N+1 query problem
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    // Fetch products (deliberately without including Category for N+1 demo)
    const products = await Product.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      // N+1 Problem: Not including Category here
      include: process.env.ENABLE_N_PLUS_ONE === 'true' ? [] : [Category]
    });

    // N+1 Problem: Fetch category for each product separately
    if (process.env.ENABLE_N_PLUS_ONE === 'true') {
      for (const product of products) {
        product.dataValues.category = await Category.findByPk(product.categoryId);
      }
    }

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        offset
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/search - Inefficient search with O(n²) complexity
router.get('/search', async (req, res, next) => {
  try {
    const { query = '', minPrice, maxPrice } = req.query;
    
    // Fetch all products (inefficient for large datasets)
    const allProducts = await Product.findAll({
      include: [Category]
    });

    let results = [];

    if (process.env.ENABLE_SLOW_SEARCH === 'true') {
      // Deliberately inefficient O(n²) fuzzy search
      for (const product of allProducts) {
        let score = 0;
        
        // Inefficient character-by-character comparison
        for (let i = 0; i < query.length; i++) {
          for (let j = 0; j < product.name.length; j++) {
            if (query[i].toLowerCase() === product.name[j].toLowerCase()) {
              score++;
            }
          }
        }

        // Also search in description (even more inefficient)
        if (product.description) {
          for (let i = 0; i < query.length; i++) {
            for (let j = 0; j < product.description.length; j++) {
              if (query[i].toLowerCase() === product.description[j].toLowerCase()) {
                score += 0.5;
              }
            }
          }
        }

        if (score > query.length * 0.5) {
          product.dataValues.searchScore = score;
          results.push(product);
        }
      }

      // Inefficient bubble sort
      for (let i = 0; i < results.length; i++) {
        for (let j = 0; j < results.length - 1; j++) {
          if (results[j].dataValues.searchScore < results[j + 1].dataValues.searchScore) {
            let temp = results[j];
            results[j] = results[j + 1];
            results[j + 1] = temp;
          }
        }
      }
    } else {
      // Efficient search using database
      results = allProducts.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Apply price filters
    if (minPrice) {
      results = results.filter(p => parseFloat(p.price) >= parseFloat(minPrice));
    }
    if (maxPrice) {
      results = results.filter(p => parseFloat(p.price) <= parseFloat(maxPrice));
    }

    res.json({
      results: results.slice(0, 50), // Limit results
      count: results.length,
      query,
      executionTime: process.hrtime()[1] / 1000000 // milliseconds
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get product details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Try to get from cache first
    const redis = await getRedisClient();
    const cached = await redis.get(`product:${id}`);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const product = await Product.findByPk(id, {
      include: [Category]
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Cache for 5 minutes
    await redis.setEx(`product:${id}`, 300, JSON.stringify(product));

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create product with synchronous blocking operation
router.post('/', async (req, res, next) => {
  try {
    const { name, description, price, stock, categoryId, imageUrl } = req.body;

    // Generate SKU
    const sku = `SKU-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Synchronous blocking operation for image processing (demo purpose)
    if (process.env.ENABLE_SYNC_BLOCKING === 'true' && imageUrl) {
      // Simulate image processing with CPU-intensive operation
      console.log('Processing image...');
      const start = Date.now();
      
      // Deliberately block the event loop for 2 seconds
      while (Date.now() - start < 2000) {
        // Simulate heavy computation
        crypto.pbkdf2Sync('image', 'salt', 100, 64, 'sha512');
      }
      
      console.log('Image processing completed');
    }

    const product = await Product.create({
      name,
      description,
      price,
      stock: stock || 0,
      sku,
      categoryId,
      imageUrl,
      specifications: req.body.specifications || {},
      tags: req.body.tags || []
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.update(req.body);

    // Clear cache
    const redis = await getRedisClient();
    await redis.del(`product:${id}`);

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await product.destroy();

    // Clear cache
    const redis = await getRedisClient();
    await redis.del(`product:${id}`);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;