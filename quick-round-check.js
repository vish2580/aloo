require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function quickCheck() {
    try {
        const result = await pool.query(`
      SELECT round_number, status, 
             EXTRACT(EPOCH FROM (end_time - NOW())) as seconds_left
      FROM game_rounds
      ORDER BY round_number DESC
      LIMIT 1
    `);

        if (result.rows.length === 0) {
            console.log('NO ROUNDS');
            return;
        }

        const r = result.rows[0];
        console.log(`Round ${r.round_number}: ${r.status} (${Math.floor(r.seconds_left)}s left)`);

        if (r.status !== 'active') {
            console.log('\n❌ ROUND IS NOT ACTIVE - THIS IS WHY BETS HANG!');
            console.log('Start game engine: node src/services/gameEngine.js');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

quickCheck();
