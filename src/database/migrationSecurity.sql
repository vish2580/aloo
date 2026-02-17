-- ============================================================
-- SECURITY & ADMIN AUDIT SYSTEM MIGRATION
-- ============================================================
-- This migration adds:
-- 1. Security tracking fields to users
-- 2. Security flags table for fraud detection
-- 3. Admin actions audit log
-- 4. Referral risk tracking
-- ============================================================

-- STEP 1: ADD SECURITY FIELDS TO USERS TABLE
-- ============================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'green' CHECK (risk_level IN ('green', 'yellow', 'red')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for IP lookups
CREATE INDEX IF NOT EXISTS idx_users_signup_ip ON users(signup_ip);
CREATE INDEX IF NOT EXISTS idx_users_last_login_ip ON users(last_login_ip);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_risk_level ON users(risk_level);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ============================================================
-- STEP 2: CREATE SECURITY FLAGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS security_flags (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN (
    'same_ip',
    'same_device',
    'same_phone',
    'fast_signup_recharge',
    'multiple_accounts',
    'referral_abuse',
    'suspicious_pattern',
    'high_withdrawal_ratio',
    'unusual_betting'
  )),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  metadata JSONB, -- Store additional context (IPs, related user IDs, etc.)
  related_user_ids UUID[], -- Array of related suspicious user IDs
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for security flags
CREATE INDEX IF NOT EXISTS idx_security_flags_user_id ON security_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_security_flags_type ON security_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_security_flags_severity ON security_flags(severity);
CREATE INDEX IF NOT EXISTS idx_security_flags_resolved ON security_flags(is_resolved);
CREATE INDEX IF NOT EXISTS idx_security_flags_created ON security_flags(created_at DESC);

-- ============================================================
-- STEP 3: CREATE ADMIN ACTIONS AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'user_ban',
    'user_unban',
    'team_ban',
    'balance_adjust',
    'withdrawal_approve',
    'withdrawal_reject',
    'game_pause',
    'game_resume',
    'game_override',
    'referral_bonus_revoke',
    'wallet_hold',
    'wallet_unhold',
    'envelope_create',
    'envelope_deactivate',
    'settings_update',
    'announcement_create',
    'announcement_delete',
    'flag_resolve'
  )),
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_entity_type VARCHAR(50), -- 'user', 'withdrawal', 'envelope', 'setting', etc.
  target_entity_id VARCHAR(255), -- ID of the affected entity
  action_data JSONB, -- Store details (amount, reason, before/after values, etc.)
  reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for admin actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_entity ON admin_actions(target_entity_type, target_entity_id);

-- ============================================================
-- STEP 4: CREATE REFERRAL RISK TRACKING VIEW
-- ============================================================
-- This view aggregates referral data for fraud detection
CREATE OR REPLACE VIEW referral_risk_summary AS
SELECT
  r.referred_by as inviter_id,
  u.email as inviter_email,
  u.risk_level as inviter_risk_level,
  COUNT(DISTINCT r.user_id) as total_team_members,
  COUNT(DISTINCT CASE WHEN u2.signup_ip = u.signup_ip THEN r.user_id END) as same_ip_count,
  COUNT(DISTINCT CASE WHEN u2.device_id = u.device_id AND u2.device_id IS NOT NULL THEN r.user_id END) as same_device_count,
  COUNT(DISTINCT CASE WHEN u2.phone = u.phone AND u2.phone IS NOT NULL THEN r.user_id END) as same_phone_count,
  COALESCE(SUM(
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = r.user_id
     AND t.type = 'deposit'
     AND t.status = 'completed')
  ), 0) as total_team_recharge,
  COALESCE(SUM(
    (SELECT COALESCE(SUM(w.amount), 0)
     FROM withdrawals w
     WHERE w.user_id = r.user_id
     AND w.status = 'approved')
  ), 0) as total_team_withdrawal,
  COALESCE(SUM(c.amount), 0) as total_referral_bonus,
  COUNT(DISTINCT sf.id) as active_flags_count,
  MAX(sf.severity) as highest_flag_severity
FROM referrals r
JOIN users u ON r.referred_by = u.id
JOIN users u2 ON r.user_id = u2.id
LEFT JOIN commissions c ON c.user_id = r.referred_by AND c.from_user_id = r.user_id
LEFT JOIN security_flags sf ON (sf.user_id = r.referred_by OR sf.user_id = r.user_id) AND sf.is_resolved = false
WHERE r.referred_by IS NOT NULL
GROUP BY r.referred_by, u.email, u.risk_level;

-- ============================================================
-- STEP 5: CREATE WALLET HOLD FUNCTIONALITY
-- ============================================================
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS is_held BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS held_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS held_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS hold_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_wallets_held ON wallets(is_held);

-- ============================================================
-- STEP 6: ADD TEAM BAN TRACKING TO USERS
-- ============================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_scope VARCHAR(20) DEFAULT 'single' CHECK (ban_scope IN ('single', 'team'));

-- ============================================================
-- STEP 7: CREATE FUNCTION TO AUTO-CALCULATE RISK SCORE
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_user_risk_score(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  risk_score INTEGER := 0;
  flag_count INTEGER;
  critical_flags INTEGER;
  high_flags INTEGER;
  same_ip_users INTEGER;
  same_device_users INTEGER;
  fast_recharge BOOLEAN;
BEGIN
  -- Count security flags
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE severity = 'critical'),
         COUNT(*) FILTER (WHERE severity = 'high')
  INTO flag_count, critical_flags, high_flags
  FROM security_flags
  WHERE user_id = target_user_id AND is_resolved = false;

  -- Add points based on flags
  risk_score := risk_score + (critical_flags * 50);
  risk_score := risk_score + (high_flags * 25);
  risk_score := risk_score + ((flag_count - critical_flags - high_flags) * 10);

  -- Check same IP users (excluding self)
  SELECT COUNT(DISTINCT u2.id) INTO same_ip_users
  FROM users u1
  JOIN users u2 ON u1.signup_ip = u2.signup_ip
  WHERE u1.id = target_user_id
  AND u2.id != target_user_id
  AND u1.signup_ip IS NOT NULL;

  IF same_ip_users > 0 THEN
    risk_score := risk_score + (same_ip_users * 15);
  END IF;

  -- Check same device users
  SELECT COUNT(DISTINCT u2.id) INTO same_device_users
  FROM users u1
  JOIN users u2 ON u1.device_id = u2.device_id
  WHERE u1.id = target_user_id
  AND u2.id != target_user_id
  AND u1.device_id IS NOT NULL;

  IF same_device_users > 0 THEN
    risk_score := risk_score + (same_device_users * 20);
  END IF;

  -- Check fast signup to recharge (< 5 minutes)
  SELECT EXISTS(
    SELECT 1 FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE u.id = target_user_id
    AND t.type = 'deposit'
    AND t.created_at - u.created_at < INTERVAL '5 minutes'
  ) INTO fast_recharge;

  IF fast_recharge THEN
    risk_score := risk_score + 30;
  END IF;

  RETURN LEAST(risk_score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 8: CREATE FUNCTION TO UPDATE RISK LEVEL
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_risk_level(target_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  score INTEGER;
  level VARCHAR(20);
BEGIN
  score := calculate_user_risk_score(target_user_id);

  IF score >= 70 THEN
    level := 'red';
  ELSIF score >= 40 THEN
    level := 'yellow';
  ELSE
    level := 'green';
  END IF;

  UPDATE users
  SET risk_score = score,
      risk_level = level,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  RETURN level;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 9: CREATE TRIGGER TO AUTO-UPDATE RISK ON FLAG CREATION
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_risk_on_flag()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_risk_level(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_security_flag_update_risk ON security_flags;
CREATE TRIGGER trg_security_flag_update_risk
AFTER INSERT OR UPDATE ON security_flags
FOR EACH ROW
EXECUTE FUNCTION trigger_update_risk_on_flag();

-- ============================================================
-- STEP 10: CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at DESC);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Summary:
-- ✅ Security tracking fields added to users
-- ✅ Security flags table created
-- ✅ Admin actions audit log created
-- ✅ Referral risk tracking view created
-- ✅ Wallet hold functionality added
-- ✅ Team ban tracking added
-- ✅ Risk score calculation functions created
-- ✅ Auto-update triggers created
-- ✅ Performance indexes added
-- ============================================================
