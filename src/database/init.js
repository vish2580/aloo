const pool = require("../config/database");

const initDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log("Starting database initialization...");

    // Create Users table
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        withdrawal_password_hash VARCHAR(255) NOT NULL,
        country VARCHAR(100) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        main_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,  -- SINGLE SOURCE OF TRUTH for user balance
        locked_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,  -- For pending withdrawals
        balance DECIMAL(15, 2) DEFAULT 0.00,  -- DEPRECATED: Kept for backward compatibility only
        avatar VARCHAR(255) NOT NULL,
        is_banned BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Users table created");

    // Add indexes for balance queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_main_balance ON users(main_balance);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Create Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance_before DECIMAL(15, 2) NOT NULL,
        balance_after DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        reference_id VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Transactions table created");

    // Create Withdrawals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        fee DECIMAL(15, 2) DEFAULT 0.00,
        net_amount DECIMAL(15, 2) NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        notes TEXT
      );
    `);
    console.log("✓ Withdrawals table created");

    // Create Game Rounds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id SERIAL PRIMARY KEY,
        round_number INTEGER UNIQUE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        lock_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        result VARCHAR(50),
        result_number INTEGER,
        status VARCHAR(50) DEFAULT 'betting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Game Rounds table created");

    // Create Bets table (with tax_amount and stake_amount for proper accounting)
    await client.query(`
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        choice VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        tax_amount DECIMAL(15, 2) DEFAULT 0.00,
        stake_amount DECIMAL(15, 2),
        result VARCHAR(50) DEFAULT 'pending',
        payout DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT bets_round_id_fk FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE
      );
    `);
    console.log("✓ Bets table created");

    // Add tax_amount and stake_amount columns if migrating from older schema
    await client.query(`
      ALTER TABLE bets ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 2) DEFAULT 0.00;
      ALTER TABLE bets ADD COLUMN IF NOT EXISTS stake_amount DECIMAL(15, 2);
    `);

    // Update existing bets: set stake_amount = amount - tax_amount if null
    await client.query(`
      UPDATE bets SET stake_amount = amount - COALESCE(tax_amount, 0) WHERE stake_amount IS NULL;
    `);
    console.log("✓ Bets table migrated (tax_amount, stake_amount)");

    // Ensure constraints
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_main_balance_non_negative') THEN
          ALTER TABLE users ADD CONSTRAINT chk_main_balance_non_negative CHECK (main_balance >= 0);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_locked_balance_non_negative') THEN
          ALTER TABLE users ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0);
        END IF;
      END $$;
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
      CREATE INDEX IF NOT EXISTS idx_bets_round_id ON bets(round_id);
      CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
    `);
    console.log("✓ Indexes created");

    console.log("\n✅ Database initialization completed successfully!\n");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initDatabase;
