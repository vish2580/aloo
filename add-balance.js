require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function addBalance(email, amount) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user
    const userResult = await client.query(
      'SELECT id, email, main_balance FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', email);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const user = userResult.rows[0];
    const balanceBefore = parseFloat(user.main_balance);
    const balanceAfter = balanceBefore + amount;

    // Update balance
    await client.query(
      'UPDATE users SET main_balance = main_balance + $1 WHERE id = $2',
      [amount, user.id]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        'admin_credit',
        amount,
        balanceBefore,
        balanceAfter,
        'completed',
        `ADMIN-CREDIT-${Date.now()}`,
        `Admin added $${amount} balance`
      ]
    );

    await client.query('COMMIT');

    console.log('✅ Balance added successfully!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Previous Balance: $${balanceBefore.toFixed(2)}`);
    console.log(`   Amount Added: $${amount.toFixed(2)}`);
    console.log(`   New Balance: $${balanceAfter.toFixed(2)}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const amount = parseFloat(process.argv[3]);

if (!email || !amount || isNaN(amount)) {
  console.log('Usage: node add-balance.js <email> <amount>');
  console.log('Example: node add-balance.js lundlele@gmail.com 200');
  process.exit(1);
}

addBalance(email, amount);
