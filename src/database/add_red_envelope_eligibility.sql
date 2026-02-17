-- ============================================================
-- RED ENVELOPE ELIGIBILITY ENHANCEMENT - MIGRATION
-- ============================================================
-- Adds support for specific user targeting via UID
-- ============================================================

BEGIN;

-- Add eligibility_type column (default 'all' for backward compatibility)
ALTER TABLE red_envelopes 
ADD COLUMN IF NOT EXISTS eligibility_type VARCHAR(50) DEFAULT 'all';

-- Add target_uid column (nullable, only used for specific_user type)
ALTER TABLE red_envelopes 
ADD COLUMN IF NOT EXISTS target_uid VARCHAR(50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_red_envelopes_eligibility_type 
ON red_envelopes(eligibility_type);

CREATE INDEX IF NOT EXISTS idx_red_envelopes_target_uid 
ON red_envelopes(target_uid);

-- Add comment for documentation
COMMENT ON COLUMN red_envelopes.eligibility_type IS 
'Eligibility rule type: all, new_user, deposited, wagered, vip, specific_user';

COMMENT ON COLUMN red_envelopes.target_uid IS 
'Target user UID for specific_user eligibility type';

COMMIT;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Summary:
-- - Added eligibility_type column (default: 'all')
-- - Added target_uid column (nullable)
-- - Created indexes for query performance
-- - Existing envelopes will have eligibility_type = 'all'
-- ============================================================
