const pool = require('../config/database');

async function fixMissingColumns() {
    try {
        const client = await pool.connect();
        console.log('🔌 Connected to database');

        console.log('🔧 Adding missing columns to users table...');

        // Add columns using DO block to handle existence checks more gracefully if needed, 
        // or just standard ADD COLUMN IF NOT EXISTS

        await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS uid SERIAL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wager DECIMAL(15, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_vip_upgrade TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_vip_bonus DECIMAL(15, 2) DEFAULT 0.00;
      
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
    `);

        console.log('✅ All missing columns added successfully');

        client.release();
        pool.end();
    } catch (error) {
        console.error('❌ Error adding columns:', error);
        process.exit(1);
    }
}

fixMissingColumns();
