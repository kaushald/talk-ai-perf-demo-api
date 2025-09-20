import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],              // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Get products list (will trigger N+1 query problem)
  const productsRes = http.get(`${BASE_URL}/api/products?limit=50`);
  check(productsRes, {
    'products status is 200': (r) => r.status === 200,
    'products returned': (r) => JSON.parse(r.body).products.length > 0,
  }) || errorRate.add(1);
  
  sleep(1);

  // Test 2: Search products (will trigger inefficient search)
  const searchRes = http.get(`${BASE_URL}/api/products/search?query=laptop`);
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search has results': (r) => JSON.parse(r.body).results !== undefined,
  }) || errorRate.add(1);
  
  sleep(1);

  // Test 3: Get specific product
  const products = JSON.parse(productsRes.body).products;
  if (products && products.length > 0) {
    const productId = products[0].id;
    const productRes = http.get(`${BASE_URL}/api/products/${productId}`);
    check(productRes, {
      'product detail status is 200': (r) => r.status === 200,
      'product has name': (r) => JSON.parse(r.body).name !== undefined,
    }) || errorRate.add(1);
  }
  
  sleep(2);

  // Test 4: Get users list
  const usersRes = http.get(`${BASE_URL}/api/users?limit=10`);
  check(usersRes, {
    'users status is 200': (r) => r.status === 200,
    'users returned': (r) => JSON.parse(r.body).users.length > 0,
  }) || errorRate.add(1);
  
  sleep(1);

  // Test 5: Get orders (will show memory leak growth)
  const ordersRes = http.get(`${BASE_URL}/api/orders?limit=10`);
  check(ordersRes, {
    'orders status is 200': (r) => r.status === 200,
    'memory leak info present': (r) => JSON.parse(r.body).memoryLeakInfo !== undefined,
  }) || errorRate.add(1);
  
  // Log memory leak growth
  const memoryInfo = JSON.parse(ordersRes.body).memoryLeakInfo;
  if (memoryInfo) {
    console.log(`Memory leak - Order history size: ${memoryInfo.orderHistorySize}`);
  }
  
  sleep(1);

  // Test 6: Create product (triggers sync blocking with image processing)
  const productPayload = JSON.stringify({
    name: `Test Product ${Date.now()}`,
    description: 'Performance test product',
    price: 99.99,
    stock: 100,
    categoryId: products && products.length > 0 ? products[0].categoryId : null,
    imageUrl: 'https://example.com/image.jpg'  // This triggers sync blocking
  });
  
  const productCreateRes = http.post(`${BASE_URL}/api/products`, productPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(productCreateRes, {
    'product creation status is 201': (r) => r.status === 201,
    'product creation took > 2s (sync blocking)': (r) => r.timings.duration > 2000,
  }) || errorRate.add(1);
  
  if (productCreateRes.timings.duration > 2000) {
    console.log(`Sync blocking detected: Product creation took ${productCreateRes.timings.duration.toFixed(0)}ms`);
  }
  
  sleep(2);
}

export function handleSummary(data) {
  const customData = {
    'Performance Issues Detected': {
      'N+1 Queries': data.metrics.http_req_duration['values']['p(95)'] > 300 ? 'Yes' : 'No',
      'Memory Leak': 'Check console logs for growth',
      'Sync Blocking': 'Check product creation times > 2s',
    }
  };
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify({...data, customData}),
  };
}