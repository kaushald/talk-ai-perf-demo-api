#!/bin/sh
set -e

echo "🚀 Starting Demo App..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const { Sequelize } = require('sequelize');
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      logging: false,
      dialectOptions: { connectTimeout: 60000 }
    });

    sequelize.authenticate()
      .then(() => { console.log('DATABASE_READY'); process.exit(0); })
      .catch(() => { console.log('DATABASE_NOT_READY'); process.exit(1); });
  " 2>/dev/null && echo "✅ Database connection established!"; then
    break
  fi

  echo "Database not ready yet. Retrying in 2 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️ Warning: Could not connect to database after $MAX_RETRIES attempts. Starting anyway..."
fi

echo "🎯 Starting application..."
# Execute the command passed to docker run
exec "$@"