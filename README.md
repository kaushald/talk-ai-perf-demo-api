# Demo E-Commerce API

E-commerce API with deliberate performance issues for testing and demonstration purposes.

## Overview

This is a demonstration API designed for performance testing workshops and conferences. It includes intentionally introduced performance issues to showcase various performance testing and monitoring techniques.

## Features

- Product catalog with categories
- User authentication
- Shopping cart functionality
- Order processing
- Deliberately introduced performance bottlenecks for testing

## Performance Issues

This API contains 5 deliberate performance issues:

1. **N+1 Query Problem** - In product listings
2. **Connection Pool Exhaustion** - Database connection management
3. **Memory Leaks** - In certain endpoints
4. **Slow Database Queries** - Missing indexes
5. **Inefficient Caching** - Redis caching issues

## Tech Stack

- **Node.js** with Express.js
- **PostgreSQL** for data storage
- **Redis** for caching
- **Sequelize** ORM
- **Prometheus** metrics
- **Docker** support

## Prerequisites

- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- Docker and Docker Compose (optional)

## Installation

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/kaushald/demo-ecommerce-api.git
cd demo-ecommerce-api
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials

5. Seed the database:
```bash
npm run seed
```

6. Start the application:
```bash
npm start
```

The API will be available at `http://localhost:3000`

### Docker Setup

1. Start all services using Docker Compose:
```bash
docker-compose up -d
```

This will start:
- The API server on port 3000
- PostgreSQL on port 5432
- Redis on port 6379
- Prometheus on port 9090
- Grafana on port 3001 (optional)

## API Endpoints

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `GET /api/products/search` - Search products

### Users
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `GET /api/users/profile` - Get user profile

### Cart
- `GET /api/cart` - Get cart items
- `POST /api/cart/add` - Add item to cart
- `DELETE /api/cart/:itemId` - Remove item from cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details

## Testing

### Run K6 Performance Tests

```bash
# Basic load test
npm test

# Stress test
k6 run tests/k6/stress-test.js

# Spike test
k6 run tests/k6/spike-test.js

# Connection exhaustion test
k6 run tests/k6/connection-exhaustion.js

# Checkout flow test
k6 run tests/k6/checkout-flow.js
```

### Test Configuration

Tests can be configured using environment variables:
- `BASE_URL` - API base URL (default: http://localhost:3000)

## Monitoring

### Prometheus Metrics

The API exposes metrics at `/metrics` endpoint for Prometheus scraping.

### Health Check

- `GET /health` - Basic health check
- `GET /ready` - Readiness probe

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with hot reload
- `npm run seed` - Seed database with sample data
- `npm run reset` - Reset database
- `npm test` - Run K6 performance tests

## Project Structure

```
demo-ecommerce-api/
├── src/
│   ├── app.js           # Express application
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── utils/           # Utilities
├── tests/
│   └── k6/              # K6 performance tests
├── scripts/
│   ├── seed-data.js     # Database seeding
│   └── reset-db.js      # Database reset
├── docker-compose.yml    # Docker configuration
├── Dockerfile           # Container definition
└── package.json         # Node dependencies
```

## License

MIT

## Author

Kaushal Dalvi

## Contributing

This is a demonstration project for performance testing workshops. Pull requests for educational improvements are welcome!