import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// We'll fetch test data in the setup function instead
let testUsers = [];
let testProducts = [];

// Setup function runs once before the test
export function setup() {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  
  // Fetch users
  const usersRes = http.get(`${BASE_URL}/api/users?limit=10`);
  const users = usersRes.status === 200 ? JSON.parse(usersRes.body).users : [];
  
  // Fetch products
  const productsRes = http.get(`${BASE_URL}/api/products?limit=20`);
  const products = productsRes.status === 200 ? JSON.parse(productsRes.body).products : [];
  
  console.log(`Loaded ${users.length} users and ${products.length} products for testing`);
  
  return { users, products };
}

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 300 },   // Ramp up to 300 users
    { duration: '5m', target: 300 },   // Stay at 300 users
    { duration: '5m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.2'],               // Error rate under 20%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function (data) {
  // Get test data passed from setup
  const testUsers = data.users || [];
  const testProducts = data.products || [];
  
  const userId = `user_${__VU}_${__ITER}`;
  
  // Mix of operations to stress different parts of the system
  const operation = Math.random();
  
  if (operation < 0.4) {
    // 40% - Read heavy operations (triggers N+1 problem)
    const res = http.get(`${BASE_URL}/api/products?limit=50`);
    check(res, { 'products loaded': (r) => r.status === 200 }) || errorRate.add(1);
    
  } else if (operation < 0.6) {
    // 20% - Search operations (inefficient algorithm)
    const res = http.get(`${BASE_URL}/api/products/search?query=test`);
    check(res, { 'search completed': (r) => r.status === 200 }) || errorRate.add(1);
    
  } else if (operation < 0.8) {
    // 20% - Order creation (memory leak)
    // Get random user and product from test data
    const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
    const randomProduct = testProducts[Math.floor(Math.random() * testProducts.length)];
    
    if (!randomUser || !randomProduct) {
      console.log('Skipping order creation - no test data available');
      return;
    }
    
    const payload = JSON.stringify({
      userId: randomUser.id,
      items: [
        { 
          productId: randomProduct.id, 
          quantity: Math.floor(Math.random() * 3) + 1 
        }
      ],
      shippingAddress: randomUser.address || {
        street: '123 Stress Test St',
        city: 'Load City',
        state: 'TS',
        zip: '12345',
        country: 'USA'
      },
      paymentMethod: 'credit_card',
      notes: `Stress test order from VU ${__VU}`
    });
    
    const params = {
      headers: { 'Content-Type': 'application/json' },
    };
    
    const res = http.post(`${BASE_URL}/api/orders`, payload, params);
    check(res, { 'order created': (r) => r.status === 201 }) || errorRate.add(1);
    
  } else {
    // 20% - Mixed read operations
    const res = http.get(`${BASE_URL}/api/orders?limit=10`);
    check(res, { 'orders loaded': (r) => r.status === 200 }) || errorRate.add(1);
    
    // Check memory leak growth
    if (res.status === 200) {
      const body = JSON.parse(res.body);
      if (body.memoryLeakInfo) {
        console.log(`Memory leak size: ${body.memoryLeakInfo.orderHistorySize} orders`);
      }
    }
  }
  
  sleep(Math.random() * 3 + 1); // Random think time between 1-4 seconds
}

export function handleSummary(data) {
  console.log('\n=== Stress Test Results ===\n');
  
  const metrics = data.metrics;
  
  // Performance metrics
  if (metrics.http_req_duration) {
    console.log('Response Times:');
    console.log(`  Min: ${metrics.http_req_duration.values.min.toFixed(2)}ms`);
    console.log(`  Median: ${metrics.http_req_duration.values['p(50)'].toFixed(2)}ms`);
    console.log(`  95th: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`  99th: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
    console.log(`  Max: ${metrics.http_req_duration.values.max.toFixed(2)}ms`);
  }
  
  // Throughput
  if (metrics.http_reqs) {
    console.log(`\nThroughput: ${metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  }
  
  // Error rate
  if (metrics.errors) {
    console.log(`Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%`);
  }
  
  // VUs
  if (metrics.vus_max) {
    console.log(`\nMax VUs: ${metrics.vus_max.values.value}`);
  }
  
  // Breaking point analysis
  console.log('\n=== Breaking Point Analysis ===');
  
  const p95 = metrics.http_req_duration?.values['p(95)'] || 0;
  const errorRate = metrics.errors?.values.rate || 0;
  
  if (p95 > 2000) {
    console.log(`⚠️  System started degrading at ${metrics.vus_max.values.value} VUs`);
    console.log(`   P95 response time: ${p95.toFixed(2)}ms (threshold: 2000ms)`);
  }
  
  if (errorRate > 0.2) {
    console.log(`⚠️  Error rate exceeded threshold: ${(errorRate * 100).toFixed(2)}%`);
  }
  
  if (p95 <= 2000 && errorRate <= 0.2) {
    console.log(`✓ System handled ${metrics.vus_max.values.value} concurrent users successfully`);
  }
  
  return {
    'stress-test-summary.json': JSON.stringify(data),
  };
}