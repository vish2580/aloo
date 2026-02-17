-- ============================================================
-- PROMOTION SYSTEM COMPLETE REBUILD - MIGRATION
-- ============================================================
-- This migration tears down the old promotion system and
-- rebuilds it from scratch with proper structure
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: ADD PHONE TO USERS TABLE
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ============================================================
-- STEP 2: DROP OLD PROMOTION TABLES (CLEAN SLATE)
-- ============================================================
DROP TABLE IF EXISTS red_envelope_claims CASCADE;
DROP TABLE IF EXISTS red_envelopes CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS promotion_config CASCADE;

-- ============================================================
-- STEP 3: CREATE REFERRALS TABLE (CLEAN)
-- ============================================================
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX idx_referrals_user_id ON referrals(user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_referred_by ON referrals(referred_by);

-- ============================================================
-- STEP 4: CREATE COMMISSIONS TABLE (CLEAN)
-- ============================================================
-- This table tracks ALL commission earnings
-- type: 'bet_commission' (auto) or 'first_reward' (manual admin)
CREATE TABLE commissions (
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

CREATE INDEX idx_commissions_user_id ON commissions(user_id);
CREATE INDEX idx_commissions_source_user_id ON commissions(source_user_id);
CREATE INDEX idx_commissions_type ON commissions(type);
CREATE INDEX idx_commissions_level ON commissions(level);
CREATE INDEX idx_commissions_created_at ON commissions(created_at DESC);

-- ============================================================
-- STEP 5: CREATE FIRST REWARD TRACKING TABLE
-- ============================================================
-- Tracks which users have received first reward from their referrer
CREATE TABLE first_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_amount DECIMAL(15, 2) NOT NULL CHECK (reward_amount >= 0),
  given_by_admin UUID REFERENCES users(id) ON DELETE SET NULL,
  given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX idx_first_rewards_user_id ON first_rewards(user_id);
CREATE INDEX idx_first_rewards_referred_by ON first_rewards(referred_by);

-- ============================================================
-- STEP 6: CREATE PROMOTION CONFIG TABLE
-- ============================================================
CREATE TABLE promotion_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO promotion_config (key, value, description) VALUES
  ('commission_l1_percent', '5', 'Level 1 commission percentage'),
  ('commission_l2_percent', '3', 'Level 2 commission percentage'),
  ('commission_l3_percent', '1', 'Level 3 commission percentage'),
  ('bet_tax_percent', '10', 'Platform tax percentage on bets');

-- ============================================================
-- STEP 7: CREATE RED ENVELOPES TABLES (UNCHANGED)
-- ============================================================
CREATE TABLE red_envelopes (
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

CREATE INDEX idx_red_envelopes_code ON red_envelopes(code);
CREATE INDEX idx_red_envelopes_active ON red_envelopes(is_active);

CREATE TABLE red_envelope_claims (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL REFERENCES red_envelopes(id) ON DELETE CASCADE,
  claimed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(envelope_id, claimed_by)
);

CREATE INDEX idx_red_envelope_claims_envelope_id ON red_envelope_claims(envelope_id);
CREATE INDEX idx_red_envelope_claims_claimed_by ON red_envelope_claims(claimed_by);

COMMIT;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Summary:
-- - Added phone to users table
-- - Rebuilt referrals table (clean structure)
-- - Rebuilt commissions table (strict types)
-- - Added first_rewards table (manual tracking)
-- - Recreated promotion_config table
-- - Recreated red_envelopes tables
-- ============================================================
