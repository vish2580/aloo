require('dotenv').config();
const pool = require('./src/config/database');

async function placeFiftyDollarBet() {
    console.log('🎯 Placing $50 bet for lundlele@gmail.com\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get user
        const userResult = await client.query(
            'SELECT id, email, main_balance FROM users WHERE email = $1',
            ['lundlele@gmail.com']
        );

        const user = userResult.rows[0];
        console.log('👤 User:', user.email);
        console.log('💰 Current Balance:', user.main_balance);

        // Get current round
        const roundResult = await client.query(
            "SELECT * FROM game_rounds WHERE status = 'betting' ORDER BY created_at DESC LIMIT 1"
        );

        if (roundResult.rows.length === 0) {
            console.error('❌ No active betting round!');
            await client.query('ROLLBACK');
            return;
        }

        const round = roundResult.rows[0];
        console.log('🎮 Round:', round.round_number);

        const now = new Date();
        const lockTime = new Date(round.lock_time);
        const timeUntilLock = Math.floor((lockTime - now) / 1000);
        console.log('⏰ Time until lock:', timeUntilLock, 'seconds');

        if (timeUntilLock <= 2) {
            console.error('❌ Betting is closed!');
            await client.query('ROLLBACK');
            return;
        }

        const betAmount = 50;
        const taxAmount = betAmount * 0.1;
        const stakeAmount = betAmount - taxAmount;

        console.log('\n💵 Bet Details:');
        console.log('   Amount: $' + betAmount);
        console.log('   Tax (10%): $' + taxAmount);
        console.log('   Stake: $' + stakeAmount);

        // Insert bet
        const betResult = await client.query(`
      INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [user.id, round.id, round.round_number, 'purple', betAmount, taxAmount, stakeAmount]);

        console.log('\n✅ BET PLACED!');
        console.log('   Bet ID:', betResult.rows[0].id);
        console.log('   Choice: PURPLE');

        // Update balance
        const newBalance = parseFloat(user.main_balance) - betAmount;
        await client.query(
            'UPDATE users SET main_balance = $1 WHERE id = $2',
            [newBalance, user.id]
        );

        console.log('\n💰 BALANCE UPDATED:');
        console.log('   Before: $' + user.main_balance);
        console.log('   After: $' + newBalance);

        // Insert transaction
        await client.query(`
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id, description)
      VALUES ($1, 'game_bet', $2, $3, $4, 'completed', $5, $6)
    `, [
            user.id,
            -betAmount,
            user.main_balance,
            newBalance,
            `BET-${betResult.rows[0].id}`,
            `Bet $${betAmount} on purple - Round ${round.round_number}`
        ]);

        await client.query('COMMIT');

        console.log('\n✅✅✅ SUCCESS! ✅✅✅');
        console.log('\n📊 Summary:');
        console.log('   Bet ID:', betResult.rows[0].id);
        console.log('   Round:', round.round_number);
        console.log('   Choice: PURPLE');
        console.log('   Amount: $50');
        console.log('   New Balance: $' + newBalance);
        console.log('\n🔄 Refresh your browser to see the updated balance and bet history!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ FAILED:', error.message);
        console.error(error);
    } finally {
        client.release();
        await pool.end();
    }
}

placeFiftyDollarBet();
