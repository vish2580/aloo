const pool = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function runVIPMigration() {
    const client = await pool.connect();

    try {
        console.log('Starting VIP System migration...\n');

        // Read the migration SQL file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'src/database/migration_vip_system.sql'),
            'utf8'
        );

        // Execute the migration
        await client.query(migrationSQL);

        console.log('✅ VIP System migration completed successfully!\n');
        console.log('Added columns:');
        console.log('  - vip_level (INTEGER, default 0)');
        console.log('  - total_wager (DECIMAL(15,2), default 0.00)');
        console.log('  - last_vip_upgrade (TIMESTAMP)');
        console.log('\nIndexes created:');
        console.log('  - idx_users_vip_level');
        console.log('  - idx_users_total_wager');

    } catch (error) {
        console.error('❌ Error running VIP migration:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runVIPMigration()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
