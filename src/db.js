require('dotenv').config();
const { Pool } = require('pg');

console.log('[DB] DATABASE_URL definida?', !!process.env.DATABASE_URL);
console.log('[DB] DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('[DB] NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
