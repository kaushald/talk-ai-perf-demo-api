#!/bin/bash
set -e

echo "🌱 Database Seeding Script"
echo "=========================="

# Check if Docker containers are running
if ! docker ps --format "table {{.Names}}" | grep -q "demo-app\|demo-postgres"; then
    echo "❌ Error: Docker containers are not running."
    echo "Please start the containers first with: docker-compose up -d"
    exit 1
fi

echo "📋 Checking container status..."

# Check if postgres is healthy
if ! docker ps --filter "name=demo-postgres" --filter "health=healthy" | grep -q "demo-postgres"; then
    echo "⏳ Waiting for PostgreSQL to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker ps --filter "name=demo-postgres" --filter "health=healthy" | grep -q "demo-postgres"; then
            echo "✅ PostgreSQL is healthy!"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
        echo "Waiting for PostgreSQL... (${timeout}s remaining)"
    done

    if [ $timeout -le 0 ]; then
        echo "❌ PostgreSQL failed to become healthy within 60 seconds"
        echo "Check container logs: docker logs demo-postgres"
        exit 1
    fi
fi

echo "🔍 Checking current database state..."

# Check if database already has data
USER_COUNT=$(docker exec demo-app node -e "
const { sequelize } = require('./src/models');
async function checkUsers() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT COUNT(*) as count FROM \"Users\"');
    console.log(results[0].count);
    await sequelize.close();
  } catch (error) {
    console.log('0');
    process.exit(0);
  }
}
checkUsers();
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" != "0" ] && [ -n "$USER_COUNT" ]; then
    echo "⚠️  Database already contains $USER_COUNT users."
    echo ""
    read -p "Do you want to reset and reseed the database? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "🚫 Seeding cancelled."
        exit 0
    fi
    echo "🔄 Resetting database first..."
    docker exec demo-app npm run reset
fi

echo "📦 Starting database seeding..."
echo "This will create:"
echo "  • 1,000 users (including test user)"
echo "  • 20 product categories"
echo "  • 500 products"
echo "  • 5,000 orders with items"
echo ""

# Run the seed script
if docker exec demo-app npm run seed; then
    echo ""
    echo "✅ Database seeded successfully!"
    echo ""
    echo "🔑 Test credentials:"
    echo "   Username: testuser"
    echo "   Password: password123"
    echo ""
    echo "🌐 API is available at: http://localhost:3000"
    echo "📊 Metrics available at: http://localhost:3000/metrics"
    echo "🔍 Grafana dashboard at: http://localhost:3009 (admin/admin)"
else
    echo ""
    echo "❌ Database seeding failed!"
    echo "Check the container logs for more details:"
    echo "  docker logs demo-app"
    exit 1
fi