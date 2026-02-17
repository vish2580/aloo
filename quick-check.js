/**
 * QUICK DIAGNOSTIC - Check what's happening
 */

const pool = require('./src/config/database');

async function quickCheck() {
    console.log('🔍 QUICK DIAGNOSTIC CHECK');
    console.log('='.repeat(60));

    // 1. Check user
    const userResult = await pool.query(
        'SELECT id, email, main_balance FROM users WHERE email = $1',
        ['lundlele@gmail.com']
    );

    if (userResult.rows.length === 0) {
        console.log('❌ User not found!');
        process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\n✅ User: ${user.email}`);
    console.log(`   Balance: $${user.main_balance}`);
    console.log(`   ID: ${user.id}`);

    // 2. Check bets
    const betResult = await pool.query(
        'SELECT COUNT(*) as count FROM bets WHERE user_id = $1',
        [user.id]
    );
    console.log(`\n📊 Total bets: ${betResult.rows[0].count}`);

    // 3. Check active round
    const roundResult = await pool.query(
        "SELECT * FROM game_rounds WHERE status = 'betting' ORDER BY created_at DESC LIMIT 1"
    );

    if (roundResult.rows.length > 0) {
        const round = roundResult.rows[0];
        console.log(`\n🎮 Active round: #${round.round_number}`);
        console.log(`   Status: ${round.status}`);
        console.log(`   Lock time: ${round.lock_time}`);

        const now = new Date();
        const lockTime = new Date(round.lock_time);
        const secondsUntilLock = (lockTime - now) / 1000;
        console.log(`   Time until lock: ${secondsUntilLock.toFixed(0)}s`);

        if (secondsUntilLock < 2) {
            console.log('   ⚠️  WARNING: Less than 2 seconds until lock - betting may be closed!');
        }
    } else {
        console.log('\n❌ NO ACTIVE ROUND - betting is not possible!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 INSTRUCTIONS:');
    console.log('   1. Make sure you did HARD REFRESH (Ctrl+Shift+R)');
    console.log('   2. Open browser DevTools (F12) → Console tab');
    console.log('   3. Try to place a bet');
    console.log('   4. Look for errors in console');
    console.log('   5. Check Network tab - does POST /bet appear?');
    console.log('   6. What is the status? (pending/200/400/500)');
    console.log('\n   Then tell me what you see!');
    console.log('');

    await pool.end();
}

quickCheck().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
