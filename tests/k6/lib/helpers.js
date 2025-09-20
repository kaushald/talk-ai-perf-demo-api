import http from 'k6/http';
import { check } from 'k6';

// Base configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test user credentials
export const TEST_USER = {
  username: 'testuser',
  password: 'password123'
};

/**
 * Get a random element from an array
 */
export function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Fetch test data (users, products, etc.)
 */
export function fetchTestData(endpoint, limit = 10) {
  const res = http.get(`${BASE_URL}/api/${endpoint}?limit=${limit}`);
  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body[endpoint] || body.results || [];
  }
  console.error(`Failed to fetch ${endpoint}: ${res.status}`);
  return [];
}

/**
 * Login and get auth token (if authentication is implemented)
 */
export function authenticate(username = TEST_USER.username, password = TEST_USER.password) {
  const payload = JSON.stringify({ username, password });
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const res = http.post(`${BASE_URL}/api/users/login`, payload, params);
  
  if (check(res, { 'login successful': (r) => r.status === 200 })) {
    const body = JSON.parse(res.body);
    return {
      success: true,
      user: body.user,
      token: body.token || null
    };
  }
  
  return { success: false, user: null, token: null };
}

/**
 * Create a realistic order payload
 */
export function generateOrderPayload(userId, products) {
  const items = [];
  const numItems = Math.floor(Math.random() * 3) + 1;
  
  for (let i = 0; i < numItems; i++) {
    const product = randomItem(products);
    if (product) {
      items.push({
        productId: product.id,
        quantity: Math.floor(Math.random() * 3) + 1
      });
    }
  }
  
  return {
    userId,
    items,
    shippingAddress: {
      street: `${Math.floor(Math.random() * 9999)} Test Street`,
      city: 'Test City',
      state: 'TS',
      zip: '12345',
      country: 'USA'
    },
    paymentMethod: randomItem(['credit_card', 'debit_card', 'paypal']),
    notes: `K6 test order - ${new Date().toISOString()}`
  };
}

/**
 * Generate search queries that will stress the system
 */
export function generateSearchQuery() {
  const queries = [
    'laptop',
    'phone',
    'tablet',
    'camera',
    'headphones',
    'monitor',
    'keyboard',
    'mouse',
    'speaker',
    'charger',
    'a', // Single character (worst case for inefficient search)
    'test',
    'product',
    'best',
    'new'
  ];
  
  return randomItem(queries);
}

/**
 * Check for performance issues in response
 */
export function detectPerformanceIssues(response, endpoint) {
  const issues = [];
  
  // Check for slow response
  if (response.timings.duration > 1000) {
    issues.push(`Slow response: ${response.timings.duration.toFixed(0)}ms`);
  }
  
  // Check for N+1 queries (multiple similar queries pattern)
  if (endpoint.includes('products') && response.timings.duration > 500) {
    issues.push('Possible N+1 query issue');
  }
  
  // Check for sync blocking (very long single request)
  if (response.timings.duration > 2000) {
    issues.push('Possible synchronous blocking operation');
  }
  
  // Check for connection issues
  if (response.timings.connecting > 100) {
    issues.push(`Slow connection: ${response.timings.connecting.toFixed(0)}ms`);
  }
  
  return issues;
}

/**
 * Log performance issue if detected
 */
export function logPerformanceIssues(response, endpoint) {
  const issues = detectPerformanceIssues(response, endpoint);
  if (issues.length > 0) {
    console.log(`⚠️  Performance issues at ${endpoint}:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
}

/**
 * Standard checks for API responses
 */
export const standardChecks = {
  'status is 200': (r) => r.status === 200,
  'response time < 500ms': (r) => r.timings.duration < 500,
  'has valid JSON': (r) => {
    try {
      JSON.parse(r.body);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Generate realistic user behavior patterns
 */
export function simulateUserJourney() {
  const journeys = [
    'browse_and_search',    // Browse products, search, view details
    'quick_purchase',        // Direct to product, add to cart, checkout
    'comparison_shopping',   // Compare multiple products
    'window_shopping',       // Just browsing, no purchase
    'repeat_customer'        // Login, view orders, make purchase
  ];
  
  return randomItem(journeys);
}

/**
 * Wait time based on user behavior
 */
export function thinkTime(behavior = 'normal') {
  const patterns = {
    'fast': Math.random() * 0.5 + 0.5,      // 0.5-1s
    'normal': Math.random() * 2 + 1,        // 1-3s
    'slow': Math.random() * 3 + 2,          // 2-5s
    'reading': Math.random() * 5 + 3,       // 3-8s
    'comparison': Math.random() * 7 + 3     // 3-10s
  };
  
  return patterns[behavior] || patterns['normal'];
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

/**
 * Calculate and return performance statistics
 */
export function calculateStats(metrics) {
  return {
    avgResponseTime: metrics.http_req_duration?.values.avg || 0,
    p95ResponseTime: metrics.http_req_duration?.values['p(95)'] || 0,
    p99ResponseTime: metrics.http_req_duration?.values['p(99)'] || 0,
    errorRate: metrics.http_req_failed?.values.rate || 0,
    throughput: metrics.http_reqs?.values.rate || 0,
    dataReceived: formatBytes(metrics.data_received?.values.count || 0),
    dataSent: formatBytes(metrics.data_sent?.values.count || 0)
  };
}