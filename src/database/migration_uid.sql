-- Sequential UID System Migration
-- Adds numeric UID column to users table
-- SAFE: No modifications to existing UUID primary key or foreign keys

-- Step 1: Add uid column (nullable initially to allow data population)
ALTER TABLE users ADD COLUMN IF NOT EXISTS uid INTEGER;

-- Step 2: Create unique index on uid
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN users.uid IS 'Sequential numeric user ID for display purposes. UUID (id) remains the primary key.';

-- Note: After running this migration, run the assign-uids.js script to populate UIDs
-- Then run: ALTER TABLE users ALTER COLUMN uid SET NOT NULL;

SELECT 'UID column added successfully. Run assign-uids.js script next.' AS message;
