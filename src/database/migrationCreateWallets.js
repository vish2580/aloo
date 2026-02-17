/**
 * Migration Script: Create Missing Wallets
 *
 * This script creates wallet records for users who don't have one yet.
 * Safe to run multiple times - only creates missing wallets.
 *
 * CRITICAL FIX:
 * - Ensures every user has exactly ONE wallet
 * - Does NOT modify existing wallets
 * - Does NOT reset any balances
 * - Production-safe
 *
 * Run: node src/database/migrationCreateWallets.js
 */

const pool = require('../config/database');

const createMissingWallets = async () => {
  const client = await pool.connect();

  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Creating Missing Wallets Migration   ║');
    console.log('╚════════════════════════════════════════╝\n');

    await client.query('BEGIN');

    // Find all users without wallets
    const usersWithoutWallets = await client.query(`
      SELECT u.id, u.email, u.created_at
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE w.id IS NULL
      ORDER BY u.created_at ASC
    `);

    const count = usersWithoutWallets.rows.length;

    if (count === 0) {
      console.log('✅ All users already have wallets. No action needed.\n');
      await client.query('COMMIT');
      return;
    }

    console.log(`📊 Found ${count} user(s) without wallets\n`);
    console.log('Creating wallets...\n');

    let created = 0;
    let failed = 0;

    for (const user of usersWithoutWallets.rows) {
      try {
        // Create wallet with initial balance = 0
        await client.query(`
          INSERT INTO wallets (user_id, balance, locked_balance)
          VALUES ($1, 0.00, 0.00)
          ON CONFLICT (user_id) DO NOTHING
        `, [user.id]);

        created++;
        console.log(`  ✓ Created wallet for user: ${user.email} (${user.id})`);
      } catch (error) {
        failed++;
        console.error(`  ✗ Failed to create wallet for user: ${user.email}`);
        console.error(`    Error: ${error.message}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         Migration Complete             ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✅ Successfully created: ${created} wallet(s)`);
    if (failed > 0) {
      console.log(`⚠️  Failed to create: ${failed} wallet(s)`);
    }
    console.log('');

    // Verification
    const verification = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM wallets) as total_wallets,
        (SELECT COUNT(*) FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE w.id IS NULL) as users_without_wallet
    `);

    const stats = verification.rows[0];
    console.log('📊 Current Status:');
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Total Wallets: ${stats.total_wallets}`);
    console.log(`   Users Without Wallet: ${stats.users_without_wallet}`);

    if (stats.users_without_wallet === '0') {
      console.log('\n✅ VERIFIED: All users now have wallets!\n');
    } else {
      console.log(`\n⚠️  WARNING: ${stats.users_without_wallet} user(s) still without wallet\n`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    throw error;
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  createMissingWallets()
    .then(() => {
      console.log('Migration script completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = createMissingWallets;
