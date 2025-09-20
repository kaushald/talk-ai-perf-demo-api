const express = require('express');
const router = express.Router();
const { register } = require('prom-client');

// GET /api/metrics - Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

module.exports = router;