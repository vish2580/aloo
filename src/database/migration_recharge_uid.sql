-- =====================================================
-- Recharge System Enhancement Migration
-- =====================================================
-- Adds UID and notified columns to recharge_requests
-- =====================================================

-- Add UID column (for display purposes, references users.uid)
ALTER TABLE recharge_requests ADD COLUMN IF NOT EXISTS uid INTEGER;

-- Add notified column (tracks if user has seen approval/rejection popup)
ALTER TABLE recharge_requests ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT false;

-- Update existing records to populate UID from users table
UPDATE recharge_requests r
SET uid = u.uid
FROM users u
WHERE r.user_id = u.id AND r.uid IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_recharge_requests_uid ON recharge_requests(uid);
CREATE INDEX IF NOT EXISTS idx_recharge_requests_notified ON recharge_requests(notified) WHERE notified = false;

-- Verification
SELECT 'Recharge requests table updated successfully!' AS status;
SELECT COUNT(*) as total_requests, COUNT(uid) as requests_with_uid FROM recharge_requests;
