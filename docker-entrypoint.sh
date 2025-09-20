#!/bin/sh
set -e

echo "🚀 Starting Demo App initialization..."

# Function to check if database is ready and has data
check_database() {
  node -e "
    const { Sequelize } = require('sequelize');
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      logging: false,
      dialectOptions: {
        connectTimeout: 60000
      }
    });
    
    async function check() {
      try {
        await sequelize.authenticate();
        console.log('DATABASE_READY');
        
        // Check if tables exist and have data
        const [results] = await sequelize.query(
          \"SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Users'\"
        );
        
        if (results[0].count > 0) {
          const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM \"Users\"');
          console.log('USER_COUNT:' + userCount[0].count);
        } else {
          console.log('USER_COUNT:0');
        }
        
        await sequelize.close();
        process.exit(0);
      } catch (error) {
        console.log('DATABASE_NOT_READY');
        process.exit(1);
      }
    }
    
    check();
  " 2>/dev/null
}

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  DB_CHECK=$(check_database || echo "DATABASE_NOT_READY")
  
  if echo "$DB_CHECK" | grep -q "DATABASE_READY"; then
    echo "✅ Database is ready!"
    
    # Extract user count
    USER_COUNT=$(echo "$DB_CHECK" | grep "USER_COUNT:" | cut -d':' -f2)
    
    if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
      echo "📦 Database is empty. Running seed script..."
      npm run seed
      if [ $? -eq 0 ]; then
        echo "✅ Database seeded successfully!"
      else
        echo "❌ Failed to seed database. Continuing anyway..."
      fi
    else
      echo "✅ Database already contains data (${USER_COUNT} users). Skipping seed."
    fi
    
    break
  fi
  
  echo "Database is not ready yet. Retrying in 2 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️ Warning: Could not verify database status after $MAX_RETRIES attempts. Starting anyway..."
fi

echo "🎯 Starting application..."
# Execute the command passed to docker run
exec "$@"