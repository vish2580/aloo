const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 30, // Increased from 20 to handle more concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms to prevent premature timeouts
});

// Connection pool monitoring
pool.on('connect', (client) => {
  console.log('🔌 [DB POOL] Client connected');
});

pool.on('acquire', (client) => {
  console.log('📥 [DB POOL] Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('🔌 [DB POOL] Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ [DB POOL] Unexpected error on idle client:', err);
  process.exit(-1);
});

// Log pool stats periodically (every 30 seconds)
setInterval(() => {
  console.log(`📊 [DB POOL] Stats - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
}, 30000);

module.exports = pool;
