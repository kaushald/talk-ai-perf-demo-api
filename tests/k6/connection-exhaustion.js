import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('connection_errors');
const connectionTime = new Trend('connection_time');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 concurrent connections
    { duration: '1m', target: 100 },   // Increase to 100 connections
    { duration: '1m', target: 200 },   // Push to 200 connections (likely to exhaust pool)
    { duration: '30s', target: 50 },   // Scale back down
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    connection_errors: ['rate<0.3'],   // Less than 30% connection errors
    http_req_failed: ['rate<0.3'],     // Less than 30% request failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate rapid-fire requests that hold connections
  const batch = [];
  
  // Create multiple concurrent requests to exhaust connection pool
  for (let i = 0; i < 5; i++) {
    batch.push([
      'GET',
      `${BASE_URL}/api/products?limit=100`,  // Heavy query
      null,
      { tags: { name: 'ProductsList' } }
    ]);
    
    batch.push([
      'GET',
      `${BASE_URL}/api/orders?limit=50`,     // Another heavy query
      null,
      { tags: { name: 'OrdersList' } }
    ]);
    
    batch.push([
      'GET',
      `${BASE_URL}/api/products/search?query=test`,  // Inefficient search
      null,
      { tags: { name: 'Search' } }
    ]);
  }
  
  // Send all requests at once to stress connection pool
  const responses = http.batch(batch);
  
  // Check responses
  let successCount = 0;
  let connectionErrors = 0;
  
  responses.forEach((res, index) => {
    const checkResult = check(res, {
      'status is 200': (r) => r.status === 200,
      'no connection error': (r) => !r.error && r.status !== 0,
    });
    
    if (!checkResult) {
      errorRate.add(1);
      if (res.error || res.status === 0) {
        connectionErrors++;
        console.log(`Connection error on request ${index}: ${res.error || 'Connection refused'}`);
      }
    } else {
      successCount++;
    }
    
    // Track connection timing
    if (res.timings) {
      connectionTime.add(res.timings.connecting);
    }
  });
  
  // Log connection pool stress
  if (connectionErrors > 0) {
    console.log(`⚠️  Connection pool stress detected: ${connectionErrors}/${responses.length} requests failed`);
  }
  
  // Very short sleep to maintain pressure on connection pool
  sleep(Math.random() * 0.5);
  
  // Additional single heavy request to test recovery
  const recoveryRes = http.get(`${BASE_URL}/api/products?limit=50`);
  check(recoveryRes, {
    'recovery request successful': (r) => r.status === 200,
  });
}

export function handleSummary(data) {
  console.log('\n=== Connection Exhaustion Test Results ===\n');
  
  const metrics = data.metrics;
  
  // Connection metrics
  if (metrics.connection_time) {
    console.log('Connection Times:');
    console.log(`  Median: ${metrics.connection_time.values.med.toFixed(2)}ms`);
    console.log(`  P95: ${metrics.connection_time.values['p(95)'].toFixed(2)}ms`);
    console.log(`  Max: ${metrics.connection_time.values.max.toFixed(2)}ms`);
  }
  
  // Error metrics
  if (metrics.connection_errors) {
    const errorPct = (metrics.connection_errors.values.rate * 100).toFixed(2);
    console.log(`\nConnection Error Rate: ${errorPct}%`);
    
    if (errorPct > 20) {
      console.log('⚠️  HIGH CONNECTION ERRORS - Connection pool likely exhausted');
      console.log('   Recommendation: Increase connection pool size or implement connection pooling');
    }
  }
  
  // HTTP metrics
  if (metrics.http_req_failed) {
    console.log(`HTTP Failure Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }
  
  // Concurrent connections
  if (metrics.vus_max) {
    console.log(`\nMax Concurrent VUs: ${metrics.vus_max.values.value}`);
  }
  
  // Throughput under stress
  if (metrics.http_reqs) {
    console.log(`Throughput: ${metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  }
  
  // Analysis
  console.log('\n=== Connection Pool Analysis ===');
  const connectionErrorRate = metrics.connection_errors?.values.rate || 0;
  const httpFailRate = metrics.http_req_failed?.values.rate || 0;
  
  if (connectionErrorRate > 0.1 || httpFailRate > 0.1) {
    console.log('⚠️  Connection pool issues detected:');
    console.log('   - Consider increasing database connection pool size');
    console.log('   - Implement connection retry logic');
    console.log('   - Add circuit breaker pattern');
    console.log('   - Review connection timeout settings');
  } else {
    console.log('✓ Connection pool handled the load successfully');
  }
  
  // Features that may affect connection pooling
  console.log('\nFactors affecting connection performance:');
  console.log('  - Detailed relation loading requiring more connection time');
  console.log('  - Smart search operations utilizing connections');
  console.log('  - Advanced database queries with complex joins');
  if (process.env.ENABLE_CONNECTION_POOLING === 'true') {
    console.log('  ✓ CONNECTION_POOLING optimization is enabled');
  }
  
  return {
    'connection-exhaustion-summary.json': JSON.stringify(data),
  };
}