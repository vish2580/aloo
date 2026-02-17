const pool = require('./src/config/database');

async function checkWithdrawals() {
    try {
        console.log('Checking withdrawals table...\n');

        const result = await pool.query(`
      SELECT w.*, u.email, u.uid
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
      LIMIT 10
    `);

        console.log(`Found ${result.rows.length} withdrawal(s):\n`);

        result.rows.forEach((w, i) => {
            console.log(`[${i + 1}] Withdrawal ID: ${w.id}`);
            console.log(`    User: ${w.email} (UID: ${w.uid})`);
            console.log(`    Amount: $${w.amount}`);
            console.log(`    Fee: $${w.fee}`);
            console.log(`    Net: $${w.net_amount}`);
            console.log(`    Wallet: ${w.wallet_address}`);
            console.log(`    Status: ${w.status}`);
            console.log(`    Created: ${w.created_at}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkWithdrawals();
