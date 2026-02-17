-- =====================================================
-- Forgot Password System Migration
-- =====================================================
-- Adds password reset token fields to users table
-- =====================================================

-- Add reset token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);

-- Add comment for documentation
COMMENT ON COLUMN users.reset_password_token IS 'Hashed password reset token (SHA-256)';
COMMENT ON COLUMN users.reset_password_expires IS 'Expiry timestamp for reset token';

-- Verification
SELECT 'Forgot Password migration completed successfully!' AS status;
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('reset_password_token', 'reset_password_expires');
