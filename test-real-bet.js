require('dotenv').config();
const pool = require('./src/config/database');

async function testRealBet() {
    console.log('🧪 Testing REAL bet placement with user lundlele@gmail.com\n');

    try {
        // Get user
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
        console.log('✅ User found:');
        console.log('   ID:', user.id);
        console.log('   Email:', user.email);
        console.log('   Balance:', user.main_balance);

        // Get current round
        const roundResult = await pool.query(
            "SELECT * FROM game_rounds WHERE status = 'betting' ORDER BY created_at DESC LIMIT 1"
        );

        if (roundResult.rows.length === 0) {
            console.error('❌ No active betting round!');
            await pool.end();
            return;
        }

        const round = roundResult.rows[0];
        console.log('\n✅ Active round found:');
        console.log('   ID:', round.id);
        console.log('   Round Number:', round.round_number);
        console.log('   Status:', round.status);
        console.log('   Lock Time:', round.lock_time);

        const now = new Date();
        const lockTime = new Date(round.lock_time);
        const timeUntilLock = Math.floor((lockTime - now) / 1000);
        console.log('   Time until lock:', timeUntilLock, 'seconds');

        if (timeUntilLock <= 2) {
            console.error('❌ Betting is closed (too close to lock time)');
            await pool.end();
            return;
        }

        // Try to place bet
        console.log('\n🎯 Attempting to place bet...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const betAmount = 10;
            const taxAmount = 1;
            const stakeAmount = 9;

            console.log('   Bet amount:', betAmount);
            console.log('   Tax:', taxAmount);
            console.log('   Stake:', stakeAmount);

            // Insert bet
            const betResult = await client.query(`
        INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `, [user.id, round.id, round.round_number, 'red', betAmount, taxAmount, stakeAmount]);

            console.log('\n✅ BET INSERTED SUCCESSFULLY!');
            console.log('   Bet ID:', betResult.rows[0].id);
            console.log('   Round Number:', betResult.rows[0].round_number);
            console.log('   Choice:', betResult.rows[0].choice);
            console.log('   Amount:', betResult.rows[0].amount);

            // Update balance
            const newBalance = parseFloat(user.main_balance) - betAmount;
            await client.query(
                'UPDATE users SET main_balance = $1 WHERE id = $2',
                [newBalance, user.id]
            );

            console.log('\n✅ BALANCE UPDATED!');
            console.log('   Old balance:', user.main_balance);
            console.log('   New balance:', newBalance);

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
                `Bet $${betAmount} on red - Round ${round.round_number}`
            ]);

            console.log('✅ TRANSACTION RECORDED!');

            await client.query('COMMIT');
            console.log('\n✅✅✅ BET PLACEMENT SUCCESSFUL! ✅✅✅');
            console.log('\nNow check your browser:');
            console.log('- Balance should show:', newBalance);
            console.log('- Bet should appear in history');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('\n❌ BET PLACEMENT FAILED!');
            console.error('Error:', error.message);
            console.error('\nFull error:', error);
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await pool.end();
    }
}

testRealBet();
