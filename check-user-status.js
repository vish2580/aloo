require('dotenv').config();
const pool = require('./src/config/database');

async function checkUserStatus() {
    console.log('🔍 Checking user status for lundlele@gmail.com\n');

    try {
        // Get user current state
        const userResult = await pool.query(
            'SELECT id, email, main_balance FROM users WHERE email = $1',
            ['lundlele@gmail.com']
        );

        if (userResult.rows.length === 0) {
            console.error('❌ User not found!');
            await pool.end();
            return;
        }

        const user = userResult.rows[0];
        console.log('👤 USER STATUS:');
        console.log('   ID:', user.id);
        console.log('   Email:', user.email);
        console.log('   Current Balance:', user.main_balance);

        // Get all bets for this user
        const betsResult = await pool.query(
            `SELECT b.*, gr.round_number, gr.status as round_status 
       FROM bets b 
       LEFT JOIN game_rounds gr ON b.round_id = gr.id 
       WHERE b.user_id = $1 
       ORDER BY b.created_at DESC 
       LIMIT 10`,
            [user.id]
        );

        console.log('\n📊 RECENT BETS (Last 10):');
        if (betsResult.rows.length === 0) {
            console.log('   No bets found');
        } else {
            betsResult.rows.forEach((bet, index) => {
                console.log(`\n   Bet #${index + 1}:`);
                console.log('     ID:', bet.id);
                console.log('     Round:', bet.round_number);
                console.log('     Choice:', bet.choice);
                console.log('     Amount:', bet.amount);
                console.log('     Result:', bet.result);
                console.log('     Created:', bet.created_at);
                console.log('     Round Status:', bet.round_status);
            });
        }

        // Get current round
        const roundResult = await pool.query(
            "SELECT * FROM game_rounds WHERE status = 'betting' ORDER BY created_at DESC LIMIT 1"
        );

        console.log('\n🎮 CURRENT ROUND:');
        if (roundResult.rows.length === 0) {
            console.log('   ❌ No active betting round!');
        } else {
            const round = roundResult.rows[0];
            console.log('   ID:', round.id);
            console.log('   Round Number:', round.round_number);
            console.log('   Status:', round.status);
            console.log('   Lock Time:', round.lock_time);

            const now = new Date();
            const lockTime = new Date(round.lock_time);
            const timeUntilLock = Math.floor((lockTime - now) / 1000);
            console.log('   Time until lock:', timeUntilLock, 'seconds');
            console.log('   Can bet:', timeUntilLock > 2 ? 'YES' : 'NO');
        }

        // Get recent transactions
        const txResult = await pool.query(
            `SELECT * FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
            [user.id]
        );

        console.log('\n💰 RECENT TRANSACTIONS (Last 5):');
        if (txResult.rows.length === 0) {
            console.log('   No transactions found');
        } else {
            txResult.rows.forEach((tx, index) => {
                console.log(`\n   Transaction #${index + 1}:`);
                console.log('     Type:', tx.type);
                console.log('     Amount:', tx.amount);
                console.log('     Balance Before:', tx.balance_before);
                console.log('     Balance After:', tx.balance_after);
                console.log('     Status:', tx.status);
                console.log('     Created:', tx.created_at);
            });
        }

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await pool.end();
    }
}

checkUserStatus();
