const pool = require("../config/database");
const fs = require("fs");
const path = require("path");

/**
 * DATABASE MIGRATION RUNNER
 * Executes the security & admin audit system migration
 */

async function runSecurityMigration() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting security migration...\n");

    // Read the migration SQL file
    const sqlFilePath = path.join(__dirname, "migrationSecurity.sql");
    const sql = fs.readFileSync(sqlFilePath, "utf8");

    console.log("📄 Migration file loaded successfully");
    console.log("🚀 Executing migration...\n");

    // Execute the migration
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("✅ Migration completed successfully!\n");
    console.log("📊 Changes applied:");
    console.log("   ✓ Security tracking fields added to users table");
    console.log("   ✓ security_flags table created");
    console.log("   ✓ admin_actions audit log created");
    console.log("   ✓ Referral risk tracking view created");
    console.log("   ✓ Wallet hold functionality added");
    console.log("   ✓ Risk calculation functions created");
    console.log("   ✓ Auto-update triggers created");
    console.log("   ✓ Performance indexes added\n");

    // Verify tables exist
    const verifyQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('security_flags', 'admin_actions')
      ORDER BY table_name;
    `;

    const result = await client.query(verifyQuery);
    console.log("✅ Verification:");
    result.rows.forEach((row) => {
      console.log(`   ✓ Table '${row.table_name}' exists`);
    });

    console.log("\n✅ Security system is ready!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed!");
    console.error("Error:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runSecurityMigration()
    .then(() => {
      console.log("\n✅ Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = runSecurityMigration;
