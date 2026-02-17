require('dotenv').config();
const pool = require('./src/config/database');

async function testFiftyDollarBet() {
    console.log('🧪 Testing $50 bet placement\n');

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
        console.log('👤 USER:');
        console.log('   Balance:', user.main_balance);

        const betAmount = 50;
        console.log('\n💰 ATTEMPTING $50 BET:');
        console.log('   Bet amount:', betAmount);
        console.log('   Current balance:', user.main_balance);
        console.log('   Balance after bet would be:', parseFloat(user.main_balance) - betAmount);

        // Check min/max bet limits
        const minBet = parseFloat(process.env.MIN_BET_AMOUNT || 10);
        const maxBet = parseFloat(process.env.MAX_BET_AMOUNT || 10000);

        console.log('\n📋 BET LIMITS:');
        console.log('   MIN_BET_AMOUNT:', minBet);
        console.log('   MAX_BET_AMOUNT:', maxBet);
        console.log('   Is $50 within limits?', betAmount >= minBet && betAmount <= maxBet ? 'YES ✅' : 'NO ❌');

        // Check if user has enough balance
        if (parseFloat(user.main_balance) < betAmount) {
            console.log('\n❌ INSUFFICIENT BALANCE!');
            console.log('   Required:', betAmount);
            console.log('   Available:', user.main_balance);
            console.log('   Short by:', betAmount - parseFloat(user.main_balance));
            await pool.end();
            return;
        }

        // Get current round
        const roundResult = await pool.query(
            "SELECT * FROM game_rounds WHERE status = 'betting' ORDER BY created_at DESC LIMIT 1"
        );

        if (roundResult.rows.length === 0) {
            console.error('\n❌ No active betting round!');
            await pool.end();
            return;
        }

        const round = roundResult.rows[0];
        const now = new Date();
        const lockTime = new Date(round.lock_time);
        const timeUntilLock = Math.floor((lockTime - now) / 1000);

        console.log('\n🎮 CURRENT ROUND:');
        console.log('   Round:', round.round_number);
        console.log('   Status:', round.status);
        console.log('   Time until lock:', timeUntilLock, 'seconds');

        if (timeUntilLock <= 2) {
            console.error('\n❌ BETTING IS CLOSED (too close to lock time)');
            await pool.end();
            return;
        }

        // Try to place the bet
        console.log('\n🎯 PLACING $50 BET...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const taxAmount = betAmount * 0.1; // 10% tax
            const stakeAmount = betAmount - taxAmount;

            // Insert bet
            const betResult = await client.query(`
        INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `, [user.id, round.id, round.round_number, 'green', betAmount, taxAmount, stakeAmount]);

            console.log('✅ BET INSERTED!');
            console.log('   Bet ID:', betResult.rows[0].id);

            // Update balance
            const newBalance = parseFloat(user.main_balance) - betAmount;
            await client.query(
                'UPDATE users SET main_balance = $1 WHERE id = $2',
                [newBalance, user.id]
            );

            console.log('✅ BALANCE UPDATED!');
            console.log('   Old:', user.main_balance);
            console.log('   New:', newBalance);

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
                `Bet $${betAmount} on green - Round ${round.round_number}`
            ]);

            await client.query('COMMIT');
            console.log('\n✅✅✅ $50 BET SUCCESSFUL! ✅✅✅');
            console.log('\nRefresh your browser to see:');
            console.log('- Balance:', newBalance);
            console.log('- New bet in history');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('\n❌ BET FAILED!');
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

testFiftyDollarBet();
