require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function checkBalance() {
  const client = await pool.connect();

  try {
    // Check if user exists
    const userResult = await client.query(
      'SELECT id, email, main_balance, locked_balance, created_at FROM users WHERE email = $1',
      ['lundlele@gmail.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found: lundlele@gmail.com');
      console.log('   Creating test user...');
      
      // Create user if not exists
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);
      const withdrawalPasswordHash = await bcrypt.hash('123456', 10);
      
      const createResult = await client.query(
        `INSERT INTO users (email, password_hash, withdrawal_password_hash, country, avatar, currency, main_balance, locked_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, main_balance, locked_balance`,
        ['lundlele@gmail.com', passwordHash, withdrawalPasswordHash, 'India', 'avatar1.png', 'USD', 100.00, 0.00]
      );
      
      console.log('✅ User created successfully!');
      console.log('   Email: lundlele@gmail.com');
      console.log('   Password: password123');
      console.log('   Withdrawal PIN: 123456');
      console.log('   Balance: $100.00');
      
    } else {
      const user = userResult.rows[0];
      console.log('✅ User found!');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Main Balance: $${parseFloat(user.main_balance).toFixed(2)}`);
      console.log(`   Locked Balance: $${parseFloat(user.locked_balance).toFixed(2)}`);
      console.log(`   Created: ${user.created_at}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

checkBalance();
