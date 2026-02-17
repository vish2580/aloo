-- =====================================================
-- CRITICAL MIGRATION: Consolidate Balance System
-- =====================================================
-- This migration implements single source of truth for balance
-- users.main_balance becomes the ONLY balance field
-- Eliminates wallets table to prevent dual-balance inconsistencies
-- =====================================================

-- Step 1: Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS main_balance DECIMAL(15, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(15, 2) DEFAULT 0.00;

-- Step 2: Migrate wallet balances to users.main_balance
-- If wallets table exists, copy balances over
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets') THEN
    -- Copy wallet balance to users.main_balance
    UPDATE users u
    SET main_balance = COALESCE(w.balance, u.balance, 0.00),
        locked_balance = COALESCE(w.locked_balance, 0.00)
    FROM wallets w
    WHERE u.id = w.user_id;

    -- For users without wallet records, use users.balance
    UPDATE users
    SET main_balance = COALESCE(main_balance, balance, 0.00)
    WHERE main_balance IS NULL;
  ELSE
    -- If no wallets table, just copy from users.balance
    UPDATE users
    SET main_balance = COALESCE(balance, 0.00)
    WHERE main_balance IS NULL;
  END IF;
END $$;

-- Step 3: Ensure main_balance is never NULL
UPDATE users SET main_balance = 0.00 WHERE main_balance IS NULL;
UPDATE users SET locked_balance = 0.00 WHERE locked_balance IS NULL;

-- Step 4: Set NOT NULL constraint
ALTER TABLE users ALTER COLUMN main_balance SET NOT NULL;
ALTER TABLE users ALTER COLUMN locked_balance SET NOT NULL;

-- Step 5: Drop old balance column (deprecated)
ALTER TABLE users DROP COLUMN IF EXISTS balance;

-- Step 6: Drop wallets table (no longer needed)
DROP TABLE IF EXISTS wallets CASCADE;

-- Step 7: Create recharge_requests table (admin approval system)
CREATE TABLE IF NOT EXISTS recharge_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) DEFAULT 'USDT_TRC20',
  transaction_hash VARCHAR(255),
  screenshot_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_main_balance ON users(main_balance);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_user_id ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_status ON recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_created_at ON recharge_requests(created_at DESC);

-- Step 9: Add constraint to prevent negative balance
ALTER TABLE users ADD CONSTRAINT chk_main_balance_non_negative CHECK (main_balance >= 0);
ALTER TABLE users ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0);

-- Step 10: Update transactions table to ensure compatibility
-- Add index for faster balance lookups
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Step 11: Create audit trigger for balance changes (optional but recommended)
CREATE OR REPLACE FUNCTION audit_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.main_balance != OLD.main_balance OR NEW.locked_balance != OLD.locked_balance THEN
    -- Log can be added here if needed
    NEW.updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_balance ON users;
CREATE TRIGGER trigger_audit_balance
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_balance_change();

-- Verification queries
SELECT 'Migration completed successfully!' AS status;
SELECT
  COUNT(*) as total_users,
  SUM(main_balance) as total_balance,
  MIN(main_balance) as min_balance,
  MAX(main_balance) as max_balance
FROM users;

SELECT 'Recharge requests table created' AS status;
SELECT COUNT(*) as pending_recharges FROM recharge_requests WHERE status = 'pending';
