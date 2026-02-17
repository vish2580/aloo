const pool = require("../config/database");
require("dotenv").config();

const runMigration = async () => {
    const client = await pool.connect();

    try {
        console.log("Starting recharge UID migration...");

        await client.query("BEGIN");

        // Add UID column (for display purposes, references users.uid)
        await client.query(`
      ALTER TABLE recharge_requests ADD COLUMN IF NOT EXISTS uid INTEGER;
    `);
        console.log("✓ Added uid column");

        // Add notified column (tracks if user has seen approval/rejection popup)
        await client.query(`
      ALTER TABLE recharge_requests ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT false;
    `);
        console.log("✓ Added notified column");

        // Update existing records to populate UID from users table
        const updateResult = await client.query(`
      UPDATE recharge_requests r
      SET uid = u.uid
      FROM users u
      WHERE r.user_id = u.id AND r.uid IS NULL
    `);
        console.log(`✓ Updated ${updateResult.rowCount} records with UID`);

        // Create indexes for faster lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recharge_requests_uid ON recharge_requests(uid);
    `);
        console.log("✓ Created uid index");

        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recharge_requests_notified ON recharge_requests(notified) WHERE notified = false;
    `);
        console.log("✓ Created notified index");

        await client.query("COMMIT");

        // Verification
        const stats = await client.query(`
      SELECT COUNT(*) as total_requests, COUNT(uid) as requests_with_uid FROM recharge_requests
    `);
        console.log("\n✅ Migration completed successfully!");
        console.log(`   Total requests: ${stats.rows[0].total_requests}`);
        console.log(`   Requests with UID: ${stats.rows[0].requests_with_uid}\n`);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

// Run if called directly
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = runMigration;
