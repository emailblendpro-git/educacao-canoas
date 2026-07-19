require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:f8loAwi5WsJurjTz@db.oynbssmxzpyykbihoffl.supabase.co:5432/postgres';

console.log('[DB] DATABASE_URL definida?', !!dbUrl);
console.log('[DB] DATABASE_URL length:', dbUrl?.length);
console.log('[DB] NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
