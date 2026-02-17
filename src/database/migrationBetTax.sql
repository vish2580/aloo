-- Bet Tax Migration
-- Adds tax_amount column to bets table for platform fee tracking

-- Add tax_amount column to bets table
ALTER TABLE bets ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 2) DEFAULT 0.00;

-- Add index for tax tracking
CREATE INDEX IF NOT EXISTS idx_bets_tax_amount ON bets(tax_amount);

-- Add bet_tax_percent to promotion_config for admin configurability
INSERT INTO promotion_config (key, value, description)
VALUES ('bet_tax_percent', '10', 'Platform tax percentage on bets (default 10%)')
ON CONFLICT (key) DO NOTHING;

-- Success message
SELECT 'Bet tax migration completed successfully!' AS message;
