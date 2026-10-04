const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    
    // Read all .sql migration files sorted alphabetically
    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    await client.query('BEGIN');

    for (const file of migrationFiles) {
      console.log(`Executing migration: ${file}`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
    }

    await client.query('COMMIT');
    console.log('All migrations executed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
