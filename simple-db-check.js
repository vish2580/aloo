const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function checkConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to the database');
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Current Database Time:', res.rows[0].now);
    client.release();
    pool.end();
  } catch (err) {
    console.error('❌ Connection error', err.stack);
    pool.end();
  }
}

checkConnection();
