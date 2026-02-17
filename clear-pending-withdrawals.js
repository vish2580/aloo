const pool = require('./src/config/database');

async function clearPendingWithdrawals() {
    try {
        console.log('Clearing pending withdrawals for testing...\n');

        const result = await pool.query(`
            UPDATE withdrawals 
            SET status = 'rejected'
            WHERE user_id = (SELECT id FROM users WHERE email = 'lundlele@gmail.com')
            AND status = 'pending'
            RETURNING id, amount, fee, net_amount
        `);

        console.log(`✅ Cleared ${result.rows.length} pending withdrawal(s):`);
        result.rows.forEach(w => {
            console.log(`   ID ${w.id}: amount=$${w.amount}, fee=$${w.fee}, net=$${w.net_amount}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

clearPendingWithdrawals();
