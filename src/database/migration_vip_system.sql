-- VIP Level System Migration
-- Adds VIP-related columns to users table

-- Add VIP level column (0-5)
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0 NOT NULL;

-- Add total wager tracking column
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wager DECIMAL(15, 2) DEFAULT 0.00 NOT NULL;

-- Add last VIP upgrade timestamp to prevent duplicate bonuses
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_vip_upgrade TIMESTAMP;

-- Create index for VIP level queries
CREATE INDEX IF NOT EXISTS idx_users_vip_level ON users(vip_level);

-- Create index for total wager queries
CREATE INDEX IF NOT EXISTS idx_users_total_wager ON users(total_wager);

-- Add constraints using DO block to avoid errors if they already exist
DO $$
BEGIN
    -- Add constraint to ensure VIP level is between 0 and 5
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_vip_level_range') THEN
        ALTER TABLE users ADD CONSTRAINT chk_vip_level_range CHECK (vip_level >= 0 AND vip_level <= 5);
    END IF;

    -- Add constraint to ensure total wager is non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_total_wager_non_negative') THEN
        ALTER TABLE users ADD CONSTRAINT chk_total_wager_non_negative CHECK (total_wager >= 0);
    END IF;
END $$;

