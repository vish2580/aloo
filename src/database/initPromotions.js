const pool = require("../config/database");

/**
 * PROMOTION SYSTEM - CLEAN INITIALIZATION
 *
 * This initializes a production-grade 3-level referral system:
 * - Level 1/2/3 ONLY (no Level 4 or beyond)
 * - Real-time commission auto-credited to main wallet
 * - First Reward is MANUAL (admin-only)
 * - All data perfectly synced (wallet, transactions, commissions)
 */

const initPromotionsSchema = async () => {
  const client = await pool.connect();

  try {
    console.log("🔧 Starting CLEAN promotion system initialization...\n");

    // ============================================================
    // STEP 1: ADD PHONE TO USERS TABLE
    // ============================================================
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    `);
    console.log("✓ Added phone field to users table");

    // ============================================================
    // STEP 2: CREATE REFERRALS TABLE
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) UNIQUE NOT NULL,
        referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log("✓ Referrals table created");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
      CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals(referred_by);
    `);
    console.log("✓ Referrals indexes created");

    // ============================================================
    // STEP 3: CREATE COMMISSIONS TABLE
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
        amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
        type VARCHAR(50) NOT NULL CHECK (type IN ('bet_commission', 'first_reward')),
        reference_id VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Commissions table created (strict types)");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_commissions_source_user_id ON commissions(source_user_id);
      CREATE INDEX IF NOT EXISTS idx_commissions_type ON commissions(type);
      CREATE INDEX IF NOT EXISTS idx_commissions_level ON commissions(level);
      CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at DESC);
    `);
    console.log("✓ Commissions indexes created");

    // ============================================================
    // STEP 4: CREATE FIRST REWARDS TRACKING TABLE
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS first_rewards (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_amount DECIMAL(15, 2) NOT NULL CHECK (reward_amount >= 0),
        given_by_admin UUID REFERENCES users(id) ON DELETE SET NULL,
        given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log("✓ First Rewards tracking table created");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_first_rewards_user_id ON first_rewards(user_id);
      CREATE INDEX IF NOT EXISTS idx_first_rewards_referred_by ON first_rewards(referred_by);
    `);
    console.log("✓ First Rewards indexes created");

    // ============================================================
    // STEP 5: CREATE PROMOTION CONFIG TABLE
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS promotion_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Promotion Config table created");

    // Insert default configuration
    await client.query(`
      INSERT INTO promotion_config (key, value, description)
      VALUES
        ('commission_l1_percent', '5', 'Level 1 commission percentage'),
        ('commission_l2_percent', '3', 'Level 2 commission percentage'),
        ('commission_l3_percent', '1', 'Level 3 commission percentage'),
        ('bet_tax_percent', '10', 'Platform tax percentage on bets')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log("✓ Default promotion config inserted");

    // ============================================================
    // STEP 6: CREATE RED ENVELOPES TABLES
    // ============================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS red_envelopes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        max_claims INTEGER DEFAULT 1,
        current_claims INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Red Envelopes table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS red_envelope_claims (
        id SERIAL PRIMARY KEY,
        envelope_id INTEGER NOT NULL REFERENCES red_envelopes(id) ON DELETE CASCADE,
        claimed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(envelope_id, claimed_by)
      );
    `);
    console.log("✓ Red Envelope Claims table created");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_red_envelopes_code ON red_envelopes(code);
      CREATE INDEX IF NOT EXISTS idx_red_envelopes_active ON red_envelopes(is_active);
      CREATE INDEX IF NOT EXISTS idx_red_envelope_claims_envelope_id ON red_envelope_claims(envelope_id);
      CREATE INDEX IF NOT EXISTS idx_red_envelope_claims_claimed_by ON red_envelope_claims(claimed_by);
    `);
    console.log("✓ Red Envelope indexes created");

    console.log("\n✅ CLEAN promotion system initialization completed!\n");
    console.log("📋 System Rules:");
    console.log("   - 3-Level referral system (L1, L2, L3 only)");
    console.log("   - Real-time commission auto-credit");
    console.log("   - First Reward is MANUAL (admin-only)");
    console.log("   - All data synced (wallet + transactions + commissions)\n");
  } catch (error) {
    console.error("❌ Error initializing promotion system:", error);
    throw error;
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  initPromotionsSchema()
    .then(() => {
      console.log("✅ Done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Failed:", err);
      process.exit(1);
    });
}

module.exports = initPromotionsSchema;
