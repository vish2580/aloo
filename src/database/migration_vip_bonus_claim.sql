-- Migration: Add pending VIP bonus tracking
-- Date: 2026-02-16
-- Description: Add pending_vip_bonus column to users table for manual VIP bonus claiming

-- Add pending_vip_bonus column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS pending_vip_bonus DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN users.pending_vip_bonus IS 'Pending VIP upgrade bonus that user needs to manually claim';

-- Update existing users to have 0 pending bonus (should already be default)
UPDATE users SET pending_vip_bonus = 0.00 WHERE pending_vip_bonus IS NULL;
