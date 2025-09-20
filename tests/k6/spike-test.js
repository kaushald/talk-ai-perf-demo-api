import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Baseline load
    { duration: '5s', target: 50 },    // Spike to 50 users
    { duration: '30s', target: 50 },   // Stay at 50 users
    { duration: '5s', target: 5 },     // Scale down
    { duration: '10s', target: 5 },    // Recovery period
    { duration: '5s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s during spike
    http_req_failed: ['rate<0.15'],    // Less than 15% errors during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate user journey during spike
  const responses = {};
  
  // 1. Home page
  responses.home = http.get(`${BASE_URL}/`);
  check(responses.home, { 'home page loaded': (r) => r.status === 200 });
  
  sleep(Math.random() * 2);
  
  // 2. Browse products (heavy operation with N+1 problem)
  responses.products = http.get(`${BASE_URL}/api/products?limit=100`);
  check(responses.products, { 'products loaded': (r) => r.status === 200 });
  
  sleep(Math.random() * 3);
  
  // 3. Search products (inefficient search algorithm)
  const searchTerms = ['laptop', 'phone', 'tablet', 'camera', 'headphones'];
  const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  responses.search = http.get(`${BASE_URL}/api/products/search?query=${searchTerm}`);
  check(responses.search, { 'search completed': (r) => r.status === 200 });
  
  sleep(Math.random() * 2);
  
  // 4. View product details
  const products = JSON.parse(responses.products.body).products;
  if (products && products.length > 0) {
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    responses.product = http.get(`${BASE_URL}/api/products/${randomProduct.id}`);
    check(responses.product, { 'product details loaded': (r) => r.status === 200 });
  }
  
  sleep(Math.random() * 1);
}

export function handleSummary(data) {
  console.log('\n=== Spike Test Results ===\n');
  
  const duration = data.metrics.http_req_duration;
  const failed = data.metrics.http_req_failed;
  
  if (duration) {
    console.log('Response Time Under Load:');
    console.log(`  Median: ${duration.values['p(50)'].toFixed(2)}ms`);
    console.log(`  95th percentile: ${duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`  99th percentile: ${duration.values['p(99)'].toFixed(2)}ms`);
  }
  
  if (failed) {
    console.log(`\nError Rate: ${(failed.values.rate * 100).toFixed(2)}%`);
  }
  
  // Check if system handled the spike
  const spikeHandled = duration.values['p(95)'] < 1000 && failed.values.rate < 0.15;
  console.log(`\nSpike Handling: ${spikeHandled ? '✓ PASSED' : '✗ FAILED'}`);
  
  return {
    'spike-test-summary.json': JSON.stringify(data),
  };
}