/**
 * REAL-TIME BET MONITORING
 * 
 * Run this script and then place a bet in the browser.
 * It will show you exactly what's happening.
 */

const pool = require('./src/config/database');

async function monitorBets() {
    console.log('🔍 REAL-TIME BET MONITOR');
    console.log('='.repeat(60));
    console.log('');

    // Get user
    const userResult = await pool.query(
        'SELECT id, email, main_balance FROM users WHERE email = $1',
        ['lundlele@gmail.com']
    );

    if (userResult.rows.length === 0) {
        console.log('❌ User not found');
        process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`👤 Monitoring user: ${user.email}`);
    console.log(`💰 Current balance: $${user.main_balance}`);
    console.log('');

    // Get initial bet count
    const initialBets = await pool.query(
        'SELECT COUNT(*) as count FROM bets WHERE user_id = $1',
        [user.id]
    );
    let lastBetCount = parseInt(initialBets.rows[0].count);
    let lastBalance = parseFloat(user.main_balance);

    console.log(`📊 Current bet count: ${lastBetCount}`);
    console.log('');
    console.log('👀 Watching for changes... (Press Ctrl+C to stop)');
    console.log('   Go place a bet now!');
    console.log('');

    let checkCount = 0;

    const interval = setInterval(async () => {
        try {
            checkCount++;

            // Check bet count
            const betResult = await pool.query(
                'SELECT COUNT(*) as count FROM bets WHERE user_id = $1',
                [user.id]
            );
            const currentBetCount = parseInt(betResult.rows[0].count);

            // Check balance
            const balanceResult = await pool.query(
                'SELECT main_balance FROM users WHERE id = $1',
                [user.id]
            );
            const currentBalance = parseFloat(balanceResult.rows[0].main_balance);

            // Detect changes
            if (currentBetCount !== lastBetCount || currentBalance !== lastBalance) {
                console.log('');
                console.log('🎉 CHANGE DETECTED!');
                console.log('='.repeat(60));

                if (currentBetCount !== lastBetCount) {
                    console.log(`📈 Bet count changed: ${lastBetCount} → ${currentBetCount}`);

                    // Get the new bet
                    const newBetResult = await pool.query(
                        'SELECT * FROM bets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                        [user.id]
                    );

                    if (newBetResult.rows.length > 0) {
                        const bet = newBetResult.rows[0];
                        console.log('');
                        console.log('✅ NEW BET CREATED:');
                        console.log(`   ID: ${bet.id}`);
                        console.log(`   Round: ${bet.round_number}`);
                        console.log(`   Choice: ${bet.choice}`);
                        console.log(`   Amount: $${bet.amount}`);
                        console.log(`   Tax: $${bet.tax_amount}`);
                        console.log(`   Status: ${bet.result}`);
                        console.log(`   Created: ${bet.created_at}`);
                    }
                }

                if (currentBalance !== lastBalance) {
                    const diff = currentBalance - lastBalance;
                    console.log('');
                    console.log(`💸 Balance changed: $${lastBalance.toFixed(2)} → $${currentBalance.toFixed(2)}`);
                    console.log(`   Difference: ${diff > 0 ? '+' : ''}$${diff.toFixed(2)}`);
                }

                console.log('');
                console.log('='.repeat(60));
                console.log('');

                lastBetCount = currentBetCount;
                lastBalance = currentBalance;
            }

            // Periodic status
            if (checkCount % 5 === 0) {
                console.log(`[${new Date().toLocaleTimeString()}] Still watching... (Bets: ${currentBetCount}, Balance: $${currentBalance.toFixed(2)})`);
            }

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }, 1000);

    // Cleanup
    process.on('SIGINT', async () => {
        console.log('');
        console.log('Stopping monitor...');
        clearInterval(interval);
        await pool.end();
        process.exit(0);
    });
}

monitorBets().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
