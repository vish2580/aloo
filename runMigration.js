/**
 * Migration Runner Script
 * 
 * This script applies the red envelope eligibility migration to the database.
 * Run with: node runMigration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('./src/config/database');

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🔄 Starting migration: add_red_envelope_eligibility');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'src', 'database', 'add_red_envelope_eligibility.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Extract only the forward migration (before the ROLLBACK section)
        const forwardMigration = migrationSQL.split('-- ============================================================')[0];

        // Begin transaction
        await client.query('BEGIN');

        // Execute the migration
        await client.query(forwardMigration);

        // Commit transaction
        await client.query('COMMIT');

        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('Added columns:');
        console.log('  - eligibility_type (VARCHAR(50), default: \'all\')');
        console.log('  - target_uid (VARCHAR(50), nullable)');
        console.log('');
        console.log('You can now restart your application to use the new feature.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        console.error('');
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
runMigration();
