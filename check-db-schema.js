require('dotenv').config();
const pool = require('./src/config/database');

async function checkDatabase() {
    console.log('🔍 Checking database schema...\n');

    try {
        // Check bets table structure
        const betsSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bets'
      ORDER BY ordinal_position
    `);

        console.log('📋 BETS TABLE COLUMNS:');
        betsSchema.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

        // Check for triggers on bets table
        const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'bets'
    `);

        console.log('\n⚡ TRIGGERS ON BETS TABLE:');
        if (triggers.rows.length === 0) {
            console.log('  No triggers found');
        } else {
            triggers.rows.forEach(row => {
                console.log(`  - ${row.trigger_name} (${row.event_manipulation})`);
                console.log(`    Action: ${row.action_statement.substring(0, 100)}...`);
            });
        }

        // Check for functions related to bets
        const functions = await pool.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname LIKE '%bet%'
    `);

        console.log('\n🔧 FUNCTIONS RELATED TO BETS:');
        if (functions.rows.length === 0) {
            console.log('  No functions found');
        } else {
            functions.rows.forEach(row => {
                console.log(`\n  Function: ${row.proname}`);
                console.log(`  Source:\n${row.prosrc}`);
            });
        }

        // Try to insert a test bet to see the actual error
        console.log('\n🧪 Testing bet insertion...');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const testBet = await client.query(`
        INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `, ['11ef76b1-2e38-4be3-96c5-ccf1e255cd12', 314, 20260109587, 'red', 10, 1, 9]);

            console.log('✅ Test bet inserted successfully:', testBet.rows[0]);

            await client.query('ROLLBACK');
            console.log('✅ Test rolled back (no actual data inserted)');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Test bet insertion failed:', error.message);
            console.error('Error details:', error);
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Database check failed:', error);
    } finally {
        await pool.end();
    }
}

checkDatabase();
