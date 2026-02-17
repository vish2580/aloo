require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function checkStatus() {
    try {
        const result = await pool.query(`
      SELECT round_number, status, 
             start_time, end_time,
             EXTRACT(EPOCH FROM (end_time - NOW())) as seconds_left,
             EXTRACT(EPOCH FROM (NOW() - start_time)) as seconds_elapsed
      FROM game_rounds
      ORDER BY round_number DESC
      LIMIT 1
    `);

        if (result.rows.length === 0) {
            console.log('❌ NO ROUNDS FOUND');
            return;
        }

        const r = result.rows[0];
        console.log('\n=== CURRENT ROUND STATUS ===');
        console.log('Round:', r.round_number);
        console.log('Status:', r.status);
        console.log('Start:', r.start_time);
        console.log('End:', r.end_time);
        console.log('Seconds Elapsed:', Math.floor(r.seconds_elapsed));
        console.log('Seconds Left:', Math.floor(r.seconds_left));

        const BET_LOCK = parseInt(process.env.BET_LOCK_BEFORE_SECONDS || '30');
        const canBet = r.status === 'active' && r.seconds_left > BET_LOCK;

        console.log('\nBet Lock Before End:', BET_LOCK, 'seconds');
        console.log('Can Place Bets:', canBet ? '✅ YES' : '❌ NO');

        if (!canBet) {
            if (r.status !== 'active') {
                console.log('Reason: Round status is', r.status, '(needs to be "active")');
            } else {
                console.log('Reason: Too close to end (', Math.floor(r.seconds_left), 's left, need >', BET_LOCK, 's)');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkStatus();
