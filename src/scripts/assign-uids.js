/**
 * Assign UIDs to Existing Users
 * 
 * This script assigns sequential numeric UIDs to all existing users
 * based on their registration date (created_at).
 * 
 * Oldest user gets UID 1, newest gets highest UID.
 */

const pool = require("../config/database");

async function assignUIDs() {
    const client = await pool.connect();

    try {
        console.log("🚀 Starting UID assignment process...\n");

        await client.query("BEGIN");

        // Step 1: Check if any users already have UIDs
        const existingUidsResult = await client.query(
            "SELECT COUNT(*) as count FROM users WHERE uid IS NOT NULL"
        );
        const existingUidsCount = parseInt(existingUidsResult.rows[0].count);

        if (existingUidsCount > 0) {
            console.log(
                `⚠️  Warning: ${existingUidsCount} users already have UIDs assigned.`
            );
            console.log("   This script will only assign UIDs to users without one.\n");
        }

        // Step 2: Get all users without UIDs, ordered by created_at
        const usersResult = await client.query(
            `SELECT id, email, created_at 
       FROM users 
       WHERE uid IS NULL 
       ORDER BY created_at ASC`
        );

        const users = usersResult.rows;

        if (users.length === 0) {
            console.log("✅ All users already have UIDs assigned. Nothing to do.");
            await client.query("COMMIT");
            return;
        }

        console.log(`📊 Found ${users.length} users without UIDs`);
        console.log(`   Assigning UIDs starting from ${existingUidsCount + 1}...\n`);

        // Step 3: Get the current max UID
        const maxUidResult = await client.query(
            "SELECT COALESCE(MAX(uid), 0) as max_uid FROM users"
        );
        let currentUid = parseInt(maxUidResult.rows[0].max_uid);

        // Step 4: Assign UIDs sequentially
        let assignedCount = 0;
        for (const user of users) {
            currentUid++;

            await client.query("UPDATE users SET uid = $1 WHERE id = $2", [
                currentUid,
                user.id,
            ]);

            assignedCount++;

            // Log progress every 100 users
            if (assignedCount % 100 === 0) {
                console.log(`   ✓ Assigned ${assignedCount}/${users.length} UIDs...`);
            }
        }

        console.log(`\n✅ Successfully assigned ${assignedCount} UIDs`);
        console.log(`   UID range: ${existingUidsCount + 1} to ${currentUid}\n`);

        // Step 5: Verify no duplicates
        const duplicateCheck = await client.query(
            `SELECT uid, COUNT(*) as count 
       FROM users 
       WHERE uid IS NOT NULL 
       GROUP BY uid 
       HAVING COUNT(*) > 1`
        );

        if (duplicateCheck.rows.length > 0) {
            throw new Error(
                `❌ Duplicate UIDs detected! Rolling back. Duplicates: ${JSON.stringify(duplicateCheck.rows)}`
            );
        }

        console.log("✅ Verified: No duplicate UIDs");

        // Step 6: Verify all users have UIDs
        const nullUidCheck = await client.query(
            "SELECT COUNT(*) as count FROM users WHERE uid IS NULL"
        );
        const nullCount = parseInt(nullUidCheck.rows[0].count);

        if (nullCount > 0) {
            throw new Error(`❌ ${nullCount} users still have NULL UIDs!`);
        }

        console.log("✅ Verified: All users have UIDs assigned\n");

        // Step 7: Make uid column NOT NULL
        console.log("🔒 Setting uid column to NOT NULL...");
        await client.query("ALTER TABLE users ALTER COLUMN uid SET NOT NULL");
        console.log("✅ uid column is now NOT NULL\n");

        await client.query("COMMIT");

        console.log("🎉 UID assignment completed successfully!");
        console.log("\n📋 Summary:");
        console.log(`   - Total users: ${existingUidsCount + assignedCount}`);
        console.log(`   - UIDs assigned in this run: ${assignedCount}`);
        console.log(`   - UID range: 1 to ${currentUid}`);
        console.log("\n✅ Database is ready. You can now update the backend code.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("\n❌ Error assigning UIDs:", error.message);
        console.error("   Transaction rolled back. No changes made.");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
assignUIDs()
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
