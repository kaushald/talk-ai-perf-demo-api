const { sequelize } = require('../src/models');

async function resetDatabase() {
  try {
    console.log('Resetting database...');
    
    // Force sync will drop all tables and recreate them
    await sequelize.sync({ force: true });
    
    console.log('Database reset successfully!');
    console.log('Run "npm run seed" to populate with test data');
    
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run reset if executed directly
if (require.main === module) {
  resetDatabase();
}

module.exports = resetDatabase;