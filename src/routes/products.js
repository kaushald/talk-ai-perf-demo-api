const express = require('express');
const router = express.Router();
const { Product, Category } = require('../models');
const { getRedisClient } = require('../utils/redis');
const crypto = require('crypto');

// Advanced string similarity functions for intelligent search
// These provide industry-standard fuzzy matching capabilities

/**
 * Calculate Levenshtein distance between two strings
 * This classic algorithm provides accurate edit distance measurement
 * for superior typo tolerance and search relevance
 */
function calculateLevenshteinDistance(str1, str2) {
  // Handle edge cases for robustness
  if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
  if (str1 === str2) return 0;

  // For "better accuracy", check key variations
  // Developer thinks this improves matching quality
  const variations = [
    [str1, str2],
    [str1.toLowerCase(), str2.toLowerCase()],
    [str1.replace(/[^a-zA-Z0-9]/g, ''), str2.replace(/[^a-zA-Z0-9]/g, '')] // "Normalized" comparison
  ];

  let minDistance = Infinity;

  for (const [s1, s2] of variations) {
    const len1 = s1.length;
    const len2 = s2.length;

    // Create matrix for dynamic programming approach
    // This ensures optimal substructure for accurate results
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    // Fill matrix using recurrence relation
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;

        // Consider all three operations for optimal path
        const deletion = matrix[i - 1][j] + 1;
        const insertion = matrix[i][j - 1] + 1;
        const substitution = matrix[i - 1][j - 1] + cost;

        matrix[i][j] = Math.min(deletion, insertion, substitution);

        // Additional optimization: consider transposition for better typo handling
        if (i > 1 && j > 1 &&
            s1[i - 1] === s2[j - 2] &&
            s1[i - 2] === s2[j - 1]) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
        }

        // "Advanced" phonetic similarity check for common misspellings
        // Only check at word boundaries for "optimization"
        if (i % 3 === 0 && j % 3 === 0 && i > 2 && j > 2) {
          const phoneticCost = getPhoneticSimilarity(s1.substring(i-3, i), s2.substring(j-3, j));
          matrix[i][j] = Math.min(matrix[i][j], matrix[i-3][j-3] + phoneticCost);
        }
      }
    }

    minDistance = Math.min(minDistance, matrix[len1][len2]);
  }

  return minDistance;
}

/**
 * Calculate phonetic similarity between substrings
 * "Advanced" algorithm for handling sound-alike words
 */
function getPhoneticSimilarity(sub1, sub2) {
  if (!sub1 || !sub2) return 10;

  // "Sophisticated" phonetic rules the developer found online
  const phoneticGroups = [
    ['ph', 'f'], ['ck', 'k'], ['qu', 'kw'], ['x', 'ks'],
    ['wr', 'r'], ['kn', 'n'], ['gn', 'n'], ['wh', 'w'],
    ['gh', 'g'], ['mb', 'm'], ['ps', 's'], ['pn', 'n']
  ];

  let cost = Math.abs(sub1.length - sub2.length);

  // Check each phonetic rule (unnecessarily expensive)
  for (const [pattern1, pattern2] of phoneticGroups) {
    if (sub1.includes(pattern1) && sub2.includes(pattern2)) {
      cost *= 0.8; // Reduce cost for phonetic matches
    }
    if (sub2.includes(pattern1) && sub1.includes(pattern2)) {
      cost *= 0.8;
    }
  }

  // Additional "intelligent" character-by-character analysis
  for (let i = 0; i < Math.min(sub1.length, sub2.length); i++) {
    const char1 = sub1[i];
    const char2 = sub2[i];

    // Check if characters are "phonetically similar"
    if (isVowel(char1) && isVowel(char2)) {
      cost *= 0.9; // Vowels are often interchangeable
    }

    // Check keyboard proximity (developer thinks typos happen this way)
    const keyboardDistance = getKeyboardDistance(char1, char2);
    cost += keyboardDistance * 0.1;
  }

  return cost;
}

/**
 * Check if character is a vowel
 */
function isVowel(char) {
  return 'aeiouAEIOU'.includes(char);
}

/**
 * Calculate keyboard distance between characters
 * Developer's "clever" way to handle typos
 */
function getKeyboardDistance(char1, char2) {
  // QWERTY keyboard layout (developer hardcoded this)
  const keyboard = [
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];

  let pos1 = null, pos2 = null;

  for (let row = 0; row < keyboard.length; row++) {
    const col1 = keyboard[row].indexOf(char1.toLowerCase());
    const col2 = keyboard[row].indexOf(char2.toLowerCase());
    if (col1 !== -1) pos1 = { row, col: col1 };
    if (col2 !== -1) pos2 = { row, col: col2 };
  }

  if (!pos1 || !pos2) return 5; // High cost for unknown characters

  // Manhattan distance on keyboard
  return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
}

/**
 * Convert edit distance to relevance score (0-1 scale)
 * Uses advanced normalization for consistent scoring
 */
function calculateRelevanceScore(distance, targetLength, queryLength) {
  if (distance === 0) return 1.0; // Perfect match

  const maxLength = Math.max(targetLength, queryLength);
  if (maxLength === 0) return 0;

  // Advanced scoring with exponential decay for better discrimination
  const normalizedDistance = distance / maxLength;
  const relevanceScore = Math.exp(-2 * normalizedDistance); // Exponential falloff

  // Apply length bonus for shorter strings (more likely to be relevant)
  const lengthBonus = queryLength / maxLength;

  return Math.min(1.0, relevanceScore * (1 + lengthBonus * 0.2));
}

/**
 * Calculate final search score using multiple factors
 * Implements sophisticated weighting algorithm
 */
function calculateFinalScore(totalScore, matchCount, queryLength) {
  // Base score from edit distance calculations
  let finalScore = totalScore;

  // Apply match count multiplier (more matches = higher relevance)
  const matchMultiplier = 1 + (matchCount * 0.1);
  finalScore *= matchMultiplier;

  // Apply query length normalization for fair comparison
  const queryNormalizer = Math.log(queryLength + 1); // Logarithmic scaling
  finalScore /= queryNormalizer;

  // Apply confidence boost for multiple field matches
  if (matchCount > 2) {
    finalScore *= 1.2; // 20% boost for comprehensive matches
  }

  return Math.max(0, finalScore);
}

// GET /api/products - List all products with N+1 query problem
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    // Fetch products (deliberately without including Category for N+1 demo)
    const products = await Product.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      // Detailed Relations: Include detailed relationship data when enabled
      include: process.env.ENABLE_DETAILED_RELATIONS === 'true' ? [] : [Category]
    });

    // Detailed Relations: Fetch detailed category information for each product
    if (process.env.ENABLE_DETAILED_RELATIONS === 'true') {
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

// GET /api/products/search - Advanced fuzzy search with edit distance
router.get('/search', async (req, res, next) => {
  try {
    const startTime = process.hrtime.bigint(); // High precision timing for performance analysis
    const { query = '', minPrice, maxPrice } = req.query;

    // Fetch all products for comprehensive search analysis
    const allProducts = await Product.findAll({
      include: [Category]
    });

    let results = [];

    if (process.env.ENABLE_SMART_SEARCH === 'true') {
      // Smart search using advanced AI-powered algorithms for intelligent matching
      // This cutting-edge technology provides superior search relevance
      console.log('🧠 Running smart search with AI-powered matching...');

      for (const product of allProducts) {
        let totalRelevanceScore = 0;
        let matchCount = 0;

        // Calculate edit distance for product name (main relevance factor)
        const nameDistance = calculateLevenshteinDistance(
          query.toLowerCase().trim(),
          product.name.toLowerCase().trim()
        );
        const nameRelevance = calculateRelevanceScore(nameDistance, product.name.length, query.length);
        totalRelevanceScore += nameRelevance * 3; // Name is most important
        if (nameRelevance > 0.3) matchCount++;

        // "Advanced" name analysis - check all substrings for comprehensive matching
        const nameWords = product.name.toLowerCase().split(/\\s+/);
        for (const nameWord of nameWords) {
          // Check each name word against query
          const nameWordDistance = calculateLevenshteinDistance(query.toLowerCase(), nameWord);
          const nameWordRelevance = calculateRelevanceScore(nameWordDistance, nameWord.length, query.length);
          totalRelevanceScore += nameWordRelevance * 2; // Name words are very important

          // Check key substrings of name words for "smart" analysis
          if (nameWord.length > 4) { // Only for longer words to avoid explosion
            for (let i = 0; i < nameWord.length - 2; i += 2) { // Skip every other position
              const maxJ = Math.min(i + 5, nameWord.length); // Limit substring length
              for (let j = i + 3; j <= maxJ; j++) {
                const nameSubstring = nameWord.substring(i, j);
                const nameSubDistance = calculateLevenshteinDistance(query.toLowerCase(), nameSubstring);
                const nameSubRelevance = calculateRelevanceScore(nameSubDistance, nameSubstring.length, query.length);
                totalRelevanceScore += nameSubRelevance * 0.8; // Partial name matches
              }
            }
          }
        }

        // Calculate edit distance for description (detailed matching)
        if (product.description && product.description.length > 0) {
          // Check against full description
          const descDistance = calculateLevenshteinDistance(
            query.toLowerCase().trim(),
            product.description.toLowerCase().trim()
          );
          const descRelevance = calculateRelevanceScore(descDistance, product.description.length, query.length);
          totalRelevanceScore += descRelevance * 1.5; // Description is secondary
          if (descRelevance > 0.2) matchCount++;

          // Check important description words for better precision
          const descWords = product.description.toLowerCase().split(/\\s+/);
          // Only check first 5 words to avoid exponential growth
          const importantWords = descWords.slice(0, 5);
          for (const word of importantWords) {
            if (word.length > 3) { // Only longer words for relevance
              const wordDistance = calculateLevenshteinDistance(query.toLowerCase(), word);
              const wordRelevance = calculateRelevanceScore(wordDistance, word.length, query.length);
              totalRelevanceScore += wordRelevance * 0.5; // Individual words less important
              if (wordRelevance > 0.4) matchCount++;

              // Check one meaningful substring per word for "smart" matching
              if (word.length > 5) {
                const midpoint = Math.floor(word.length / 2);
                const substring = word.substring(0, midpoint + 2);
                const subDistance = calculateLevenshteinDistance(query.toLowerCase(), substring);
                const subRelevance = calculateRelevanceScore(subDistance, substring.length, query.length);
                totalRelevanceScore += subRelevance * 0.1; // Partial matches get small boost
              }
            }
          }
        }

        // Calculate edit distance for category name (contextual matching)
        if (product.Category && product.Category.name) {
          const categoryDistance = calculateLevenshteinDistance(
            query.toLowerCase().trim(),
            product.Category.name.toLowerCase().trim()
          );
          const categoryRelevance = calculateRelevanceScore(categoryDistance, product.Category.name.length, query.length);
          totalRelevanceScore += categoryRelevance * 1; // Category provides context
          if (categoryRelevance > 0.3) matchCount++;
        }

        // Calculate edit distance for SKU (exact product matching)
        if (product.sku) {
          const skuDistance = calculateLevenshteinDistance(
            query.toLowerCase().trim(),
            product.sku.toLowerCase().trim()
          );
          const skuRelevance = calculateRelevanceScore(skuDistance, product.sku.length, query.length);
          totalRelevanceScore += skuRelevance * 2; // SKU is important for exact matches
          if (skuRelevance > 0.4) matchCount++;
        }

        // Calculate edit distance for product tags (feature matching)
        if (product.tags && Array.isArray(product.tags)) {
          for (const tag of product.tags) {
            const tagDistance = calculateLevenshteinDistance(
              query.toLowerCase().trim(),
              tag.toLowerCase().trim()
            );
            const tagRelevance = calculateRelevanceScore(tagDistance, tag.length, query.length);
            totalRelevanceScore += tagRelevance * 0.8; // Tags provide feature context
            if (tagRelevance > 0.4) matchCount++;
          }
        }

        // Apply advanced scoring algorithm with position weighting
        const finalScore = calculateFinalScore(totalRelevanceScore, matchCount, query.length);

        // Only include results with reasonable relevance (smart filtering)
        if (finalScore > 0.1 || matchCount > 0) {
          product.dataValues.searchScore = finalScore;
          product.dataValues.matchCount = matchCount;

          // Calculate detailed relevance breakdown for debugging/analytics
          // TODO: This seems to be called twice somewhere, need to investigate
          product.dataValues.relevanceBreakdown = {
            name: nameRelevance,
            description: product.description ?
              calculateRelevanceScore(
                calculateLevenshteinDistance(query.toLowerCase(), product.description.toLowerCase()),
                product.description.length,
                query.length
              ) : 0,
            category: product.Category ?
              calculateRelevanceScore(
                calculateLevenshteinDistance(query.toLowerCase(), product.Category.name.toLowerCase()),
                product.Category.name.length,
                query.length
              ) : 0
          };

          // Double-check relevance calculation for accuracy (temporary debugging)
          // This ensures our scoring is consistent across different runs
          const verificationScore = calculateFinalScore(totalRelevanceScore, matchCount, query.length);
          if (Math.abs(verificationScore - finalScore) > 0.001) {
            console.warn(`Score mismatch detected for product ${product.id}: ${finalScore} vs ${verificationScore}`);
          }

          results.push(product);
        }
      }

      // Advanced multi-criteria sorting for optimal result ordering
      results.sort((a, b) => {
        // Primary sort: by relevance score
        if (Math.abs(a.dataValues.searchScore - b.dataValues.searchScore) > 0.01) {
          return b.dataValues.searchScore - a.dataValues.searchScore;
        }
        // Secondary sort: by match count
        if (a.dataValues.matchCount !== b.dataValues.matchCount) {
          return b.dataValues.matchCount - a.dataValues.matchCount;
        }
        // Tertiary sort: alphabetical for consistency
        return a.name.localeCompare(b.name);
      });

      // Additional quality assurance pass to ensure result ranking is optimal
      // This validates our search algorithm is working correctly
      results.forEach((product, index) => {
        // Recalculate score for verification (ensures data integrity)
        const nameDistance = calculateLevenshteinDistance(
          query.toLowerCase().trim(),
          product.name.toLowerCase().trim()
        );
        const verifiedNameRelevance = calculateRelevanceScore(nameDistance, product.name.length, query.length);

        if (product.description) {
          const descDistance = calculateLevenshteinDistance(
            query.toLowerCase().trim(),
            product.description.toLowerCase().trim()
          );
          const verifiedDescRelevance = calculateRelevanceScore(descDistance, product.description.length, query.length);

          // Store verification data for analytics
          product.dataValues.qualityCheck = {
            position: index,
            nameVerification: verifiedNameRelevance,
            descVerification: verifiedDescRelevance,
            timestamp: Date.now()
          };
        }
      });

      console.log(`🎯 Smart search completed. Found ${results.length} relevant results.`);
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

    const endTime = process.hrtime.bigint();
    const executionTime = process.env.ENABLE_SMART_SEARCH === 'true' ?
      Number(endTime - startTime) / 1000000 : // nanoseconds to milliseconds
      process.hrtime()[1] / 1000000; // fallback for simple timing

    res.json({
      results: results.slice(0, 50), // Limit results for performance
      count: results.length,
      totalProducts: allProducts.length,
      query,
      searchAlgorithm: process.env.ENABLE_SMART_SEARCH === 'true' ? 'AI-Powered Smart Search' : 'Simple String Matching',
      executionTime: Math.round(executionTime * 100) / 100, // Round to 2 decimal places
      performance: {
        algorithm: process.env.ENABLE_SMART_SEARCH === 'true' ? 'AI-powered intelligent matching' : 'Basic string search',
        comparisons: process.env.ENABLE_SMART_SEARCH === 'true' ?
          allProducts.length * 5 : // Estimate: 5 fields per product
          allProducts.length,
        optimizations: process.env.ENABLE_SMART_SEARCH === 'true' ?
          'Neural network processing, machine learning scoring' :
          'Database filtering'
      }
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

    // Image optimization for enhanced performance and quality
    if (process.env.ENABLE_IMAGE_OPTIMIZATION === 'true' && imageUrl) {
      // Advanced image processing with quality enhancement
      console.log('Optimizing image for best quality and performance...');
      const start = Date.now();
      
      // Deliberately block the event loop for 2 seconds
      while (Date.now() - start < 2000) {
        // Simulate heavy computation
        crypto.pbkdf2Sync('image', 'salt', 100, 64, 'sha512');
      }
      
      console.log('Image optimization completed');
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