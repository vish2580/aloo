require('dotenv').config();
const pool = require('./src/config/database');

async function fixTrigger() {
    console.log('🔧 Fixing set_bet_round_number trigger...\n');

    try {
        // Check game_rounds table structure first
        const gameRoundsSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'game_rounds'
      ORDER BY ordinal_position
    `);

        console.log('📋 GAME_ROUNDS TABLE COLUMNS:');
        gameRoundsSchema.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

        // Drop and recreate the trigger function with correct column name
        console.log('\n🔧 Dropping old trigger function...');
        await pool.query('DROP FUNCTION IF EXISTS set_bet_round_number() CASCADE');
        console.log('✅ Old function dropped');

        console.log('\n🔧 Creating new trigger function...');
        await pool.query(`
      CREATE OR REPLACE FUNCTION set_bet_round_number()
      RETURNS TRIGGER AS $$
      BEGIN
        SELECT round_number INTO NEW.round_number
        FROM game_rounds
        WHERE id = NEW.round_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        console.log('✅ New function created');

        console.log('\n🔧 Creating trigger...');
        await pool.query(`
      CREATE TRIGGER trigger_set_bet_round_number
      BEFORE INSERT ON bets
      FOR EACH ROW
      EXECUTE FUNCTION set_bet_round_number();
    `);
        console.log('✅ Trigger created');

        // Test the fix
        console.log('\n🧪 Testing bet insertion after fix...');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const testBet = await client.query(`
        INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `, ['11ef76b1-2e38-4be3-96c5-ccf1e255cd12', 314, 20260109587, 'red', 10, 1, 9]);

            console.log('✅ Test bet inserted successfully!');
            console.log('   Bet ID:', testBet.rows[0].id);
            console.log('   Round Number:', testBet.rows[0].round_number);

            await client.query('ROLLBACK');
            console.log('✅ Test rolled back (no actual data inserted)');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Test bet insertion still failed:', error.message);
        } finally {
            client.release();
        }

        console.log('\n✅ Trigger fix complete!');

    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await pool.end();
    }
}

fixTrigger();
