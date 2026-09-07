import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('CRITICAL: Missing DATABASE_URL - ALL database calls will fail!');
}

// Create a connection pool using the PostgreSQL connection string.
// SSL is required for Supabase-hosted databases.
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  } catch (err) {
    console.error('Failed to create PostgreSQL pool:', err.message);
  }
}

// Verify the connection on startup
if (pool) {
  pool
    .query('SELECT 1')
    .then(() => console.log('PostgreSQL pool connected successfully'))
    .catch((err) => console.error('PostgreSQL pool connection failed:', err.message));
}

export default pool;
