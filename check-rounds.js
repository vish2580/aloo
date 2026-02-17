require('dotenv').config();
const pool = require('./src/config/database');

async function checkRoundStatus() {
    console.log('🎮 Checking round status...\n');

    try {
        // Get all recent rounds
        const allRounds = await pool.query(
            `SELECT id, round_number, status, lock_time, end_time, created_at 
       FROM game_rounds 
       ORDER BY created_at DESC 
       LIMIT 5`
        );

        console.log('📊 RECENT ROUNDS (Last 5):');
        allRounds.rows.forEach((round, index) => {
            console.log(`\n   Round #${index + 1}:`);
            console.log('     ID:', round.id);
            console.log('     Number:', round.round_number);
            console.log('     Status:', round.status);
            console.log('     Created:', round.created_at);
            console.log('     Lock Time:', round.lock_time);
            console.log('     End Time:', round.end_time);

            if (round.status === 'betting') {
                const now = new Date();
                const lockTime = new Date(round.lock_time);
                const endTime = new Date(round.end_time);
                const timeUntilLock = Math.floor((lockTime - now) / 1000);
                const timeUntilEnd = Math.floor((endTime - now) / 1000);
                console.log('     ⏰ Time until lock:', timeUntilLock, 'seconds');
                console.log('     ⏰ Time until end:', timeUntilEnd, 'seconds');
            }
        });

        // Check if game engine is running
        console.log('\n🔍 CHECKING GAME ENGINE STATUS:');
        console.log('   ROUND_DURATION_SECONDS:', process.env.ROUND_DURATION_SECONDS);
        console.log('   BET_LOCK_BEFORE_SECONDS:', process.env.BET_LOCK_BEFORE_SECONDS);

        const bettingRound = await pool.query(
            "SELECT * FROM game_rounds WHERE status = 'betting' LIMIT 1"
        );

        if (bettingRound.rows.length === 0) {
            console.log('\n⚠️ NO ACTIVE BETTING ROUND!');
            console.log('   The game engine may not be running or may be between rounds.');
            console.log('   Check if the server is running: node src/server.js');
            console.log('   The game engine should automatically create new rounds.');
        } else {
            console.log('\n✅ ACTIVE BETTING ROUND FOUND!');
            console.log('   You can place bets now.');
        }

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        pool.end();
    }
}

checkRoundStatus();
