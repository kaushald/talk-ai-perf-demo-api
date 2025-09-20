import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

// Custom metrics
const errorRate = new Rate("errors");
const orderCreationTime = new Trend("order_creation_time");
const searchResponseTime = new Trend("search_response_time");
const ordersCompleted = new Counter("orders_completed");
const memoryLeakGrowth = new Trend("memory_leak_growth");

// Test configuration
export const options = {
  stages: [
    { duration: "10s", target: 5 }, // Warm up with 5 users
    { duration: "30s", target: 20 }, // Ramp to 20 users
    { duration: "50s", target: 20 }, // Stay at 20 users
    { duration: "20s", target: 50 }, // Spike to 50 users
    { duration: "30s", target: 50 }, // Maintain spike load
    { duration: "20s", target: 10 }, // Scale down
    { duration: "10s", target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500", "p(99)<3000"], // Response time thresholds
    errors: ["rate<0.1"], // Error rate < 10%
    order_creation_time: ["p(95)<2000"], // Order creation < 2s
    search_response_time: ["p(95)<1000"], // Search < 1s
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Test data
const searchTerms = [
  "laptop",
  "phone",
  "tablet",
  "camera",
  "monitor",
  "keyboard",
  "mouse",
  "headphones",
];
const firstNames = [
  "John",
  "Jane",
  "Bob",
  "Alice",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
];

// Helper function to generate user data
function generateUserData() {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${timestamp}@test.com`,
    password: `Pass${timestamp}!`,
    phone: `555-${Math.floor(Math.random() * 900) + 100}-${
      Math.floor(Math.random() * 9000) + 1000
    }`,
    address: {
      street: `${Math.floor(Math.random() * 9999) + 1} Main St`,
      city: "Test City",
      state: "TC",
      zip: `${Math.floor(Math.random() * 90000) + 10000}`,
    },
  };
}

// Main test scenario
export default function () {
  const userData = generateUserData();
  let userId = null;

  // Login with test user to get the actual UUID
  group("User Authentication", function () {
    const loginPayload = JSON.stringify({
      username: "testuser",
      password: "password123",
    });

    const loginRes = http.post(`${BASE_URL}/api/users/login`, loginPayload, {
      headers: { "Content-Type": "application/json" },
    });

    check(loginRes, {
      "login successful": (r) => r.status === 200,
      "user ID received": (r) => {
        if (r.status !== 200) {
          console.error(`Login failed: ${r.status} - ${r.body}`);
          return false;
        }
        const body = JSON.parse(r.body);
        return body.user && body.user.id;
      },
    }) || errorRate.add(1);

    if (loginRes.status === 200) {
      const loginData = JSON.parse(loginRes.body);
      userId = loginData.user.id;
      console.log(`Logged in as test user with ID: ${userId}`);
    } else {
      console.error("Login failed - test will continue with null userId");
    }

    sleep(1);
  });

  // 1. PRODUCT BROWSING FLOW (renamed from #2)
  let selectedProducts = [];

  group("Product Browsing", function () {
    // Browse products (triggers N+1 query problem)
    const productsRes = http.get(`${BASE_URL}/api/products?limit=50`);
    check(productsRes, {
      "products loaded": (r) => r.status === 200,
      "products returned": (r) => {
        const body = JSON.parse(r.body);
        return body.products && body.products.length > 0;
      },
    }) || errorRate.add(1);

    if (productsRes.status === 200) {
      const products = JSON.parse(productsRes.body).products;
      // Select 2-5 random products for purchase
      const numProducts = Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < numProducts && i < products.length; i++) {
        selectedProducts.push(
          products[Math.floor(Math.random() * products.length)]
        );
      }
    }

    sleep(2);

    // Search for products (triggers O(n²) search problem)
    const searchTerm = randomItem(searchTerms);
    const searchStart = Date.now();
    const searchRes = http.get(
      `${BASE_URL}/api/products/search?query=${searchTerm}`
    );
    const searchDuration = Date.now() - searchStart;

    searchResponseTime.add(searchDuration);

    check(searchRes, {
      "search completed": (r) => r.status === 200,
      "search has results": (r) => {
        const body = JSON.parse(r.body);
        return body.results !== undefined;
      },
    }) || errorRate.add(1);

    sleep(1);

    // View individual product details
    if (selectedProducts.length > 0) {
      const productToView = randomItem(selectedProducts);
      const productRes = http.get(
        `${BASE_URL}/api/products/${productToView.id}`
      );

      check(productRes, {
        "product details loaded": (r) => r.status === 200,
        "product has details": (r) => {
          const body = JSON.parse(r.body);
          return body.name && body.price;
        },
      }) || errorRate.add(1);
    }

    sleep(2);
  });

  // 2. ORDER CREATION FLOW (renamed from #3)
  let orderId = null;

  group("Order Creation", function () {
    if (selectedProducts.length === 0) {
      console.log("Skipping order creation - no products selected");
      return;
    }

    if (!userId) {
      console.error("Skipping order creation - no valid user ID");
      errorRate.add(1);
      return;
    }

    // Prepare order items
    const orderItems = selectedProducts.map((product) => ({
      productId: product.id,
      quantity: Math.floor(Math.random() * 3) + 1,
    }));

    const orderPayload = JSON.stringify({
      userId: userId,
      items: orderItems,
      shippingAddress: {
        street: userData.address.street,
        city: userData.address.city,
        state: userData.address.state,
        zip: userData.address.zip,
      },
      paymentMethod: randomItem(["credit_card", "debit_card", "paypal"]),
      notes: `Test order from K6 load test - ${__VU}.${__ITER}`,
    });

    const orderStart = Date.now();
    const orderRes = http.post(`${BASE_URL}/api/orders`, orderPayload, {
      headers: { "Content-Type": "application/json" },
    });
    const orderDuration = Date.now() - orderStart;

    orderCreationTime.add(orderDuration);

    check(orderRes, {
      "order created": (r) => r.status === 201,
      "order has number": (r) => {
        if (r.status !== 201) {
          console.error(`Order creation failed: ${r.status} - ${r.body}`);
          return false;
        }
        const body = JSON.parse(r.body);
        return body.orderNumber !== undefined;
      },
    }) || errorRate.add(1);

    if (orderRes.status === 201) {
      orderId = JSON.parse(orderRes.body).id;
      ordersCompleted.add(1);
      if (__ITER % 10 === 0) {
        console.log(`Order created successfully: ${orderId}`);
      }
    }

    sleep(3);
  });

  // 3. POST-ORDER ACTIVITIES (renamed from #4)
  group("Post-Order Activities", function () {
    // Check order status
    if (orderId) {
      const orderStatusRes = http.get(`${BASE_URL}/api/orders/${orderId}`);

      check(orderStatusRes, {
        "order status retrieved": (r) => r.status === 200,
        "order has status": (r) => {
          if (r.status !== 200) return false;
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        },
      }) || errorRate.add(1);

      sleep(1);

      // Update order status (simulate processing)
      const statusUpdatePayload = JSON.stringify({
        status: randomItem(["processing", "shipped"]),
      });

      const statusUpdateRes = http.put(
        `${BASE_URL}/api/orders/${orderId}/status`,
        statusUpdatePayload,
        { headers: { "Content-Type": "application/json" } }
      );

      check(statusUpdateRes, {
        "order status updated": (r) => r.status === 200,
      }) || errorRate.add(1);
    }

    sleep(2);

    // Get user's order history
    if (userId) {
      const ordersRes = http.get(`${BASE_URL}/api/orders/user/${userId}`);

      check(ordersRes, {
        "order history retrieved": (r) => r.status === 200,
        "has orders": (r) => {
          if (r.status !== 200) return false;
          const body = JSON.parse(r.body);
          return body.orders && body.orders.length > 0;
        },
      }) || errorRate.add(1);
    }

    sleep(1);

    // Check for memory leak growth
    const ordersListRes = http.get(`${BASE_URL}/api/orders?limit=5`);
    if (ordersListRes.status === 200) {
      const body = JSON.parse(ordersListRes.body);
      if (body.memoryLeakInfo) {
        memoryLeakGrowth.add(body.memoryLeakInfo.orderHistorySize);
        if (__ITER % 10 === 0) {
          console.log(
            `Memory leak - Order history size: ${body.memoryLeakInfo.orderHistorySize}`
          );
        }
      }
    }
  });

  // 4. SYSTEM METRICS CHECK (renamed from #5)
  group("System Metrics", function () {
    const metricsRes = http.get(`${BASE_URL}/metrics`);

    check(metricsRes, {
      "metrics available": (r) => r.status === 200,
    }) || errorRate.add(1);

    if (metricsRes.status === 200 && __ITER % 20 === 0) {
      // Prometheus metrics are in text format, not JSON
      console.log("Prometheus metrics endpoint is available");
    }
  });

  // Random think time between user journeys
  sleep(Math.random() * 5 + 2);
}

// Custom summary report
export function handleSummary(data) {
  const summary = [];

  summary.push("\n=== E-Commerce Checkout Flow Test Results ===\n");

  // Overall statistics
  const metrics = data.metrics;

  if (metrics.http_reqs) {
    summary.push(`Total Requests: ${metrics.http_reqs.values.count}`);
    summary.push(
      `Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)} req/s`
    );
  }

  // Response times
  if (metrics.http_req_duration) {
    summary.push("\nOverall Response Times:");
    summary.push(
      `  Median: ${metrics.http_req_duration.values["p(50)"].toFixed(2)}ms`
    );
    summary.push(
      `  95th percentile: ${metrics.http_req_duration.values["p(95)"].toFixed(
        2
      )}ms`
    );
    summary.push(
      `  99th percentile: ${metrics.http_req_duration.values["p(99)"].toFixed(
        2
      )}ms`
    );
  }

  // Business metrics
  if (metrics.orders_completed) {
    summary.push("\nBusiness Metrics:");
    summary.push(
      `  Orders Completed: ${metrics.orders_completed.values.count}`
    );
    summary.push(
      `  Orders/minute: ${(metrics.orders_completed.values.rate * 60).toFixed(
        2
      )}`
    );
  }

  if (metrics.order_creation_time) {
    summary.push(
      `  Order Creation Time (p95): ${metrics.order_creation_time.values[
        "p(95)"
      ].toFixed(2)}ms`
    );
  }

  if (metrics.search_response_time) {
    summary.push(
      `  Search Response Time (p95): ${metrics.search_response_time.values[
        "p(95)"
      ].toFixed(2)}ms`
    );
  }

  // Error rate
  if (metrics.errors) {
    summary.push(
      `\nError Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%`
    );
  }

  // Memory leak info
  if (metrics.memory_leak_growth && metrics.memory_leak_growth.values.max > 0) {
    summary.push("\nMemory Leak Detection:");
    summary.push(
      `  Max Order History Size: ${metrics.memory_leak_growth.values.max}`
    );
    summary.push(
      `  Growth Rate: ~${(
        metrics.memory_leak_growth.values.max /
        metrics.orders_completed.values.count
      ).toFixed(2)} per order`
    );
  }

  // Threshold results
  summary.push("\nThreshold Results:");
  for (const [name, metric] of Object.entries(metrics)) {
    if (metric.thresholds) {
      const passed = Object.values(metric.thresholds).every((t) => t.ok);
      summary.push(`  ${name}: ${passed ? "✓ PASS" : "✗ FAIL"}`);
    }
  }

  // Performance issues detected
  summary.push("\n=== Performance Issues Detected ===");

  if (
    metrics.http_req_duration &&
    metrics.http_req_duration.values["p(95)"] > 1500
  ) {
    summary.push("⚠️  High response times detected (>1.5s at p95)");
  }

  if (
    metrics.search_response_time &&
    metrics.search_response_time.values["p(95)"] > 1000
  ) {
    summary.push(
      "⚠️  Slow product search (>1s at p95) - likely O(n²) algorithm"
    );
  }

  if (
    metrics.memory_leak_growth &&
    metrics.memory_leak_growth.values.max > 100
  ) {
    summary.push("⚠️  Memory leak detected - order history growing unbounded");
  }

  if (metrics.errors && metrics.errors.values.rate > 0.05) {
    summary.push("⚠️  Elevated error rate (>5%)");
  }

  const summaryText = summary.join("\n");

  return {
    stdout: summaryText,
    "checkout-flow-summary.json": JSON.stringify(data),
    "checkout-flow-summary.txt": summaryText,
  };
}
