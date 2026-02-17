const pool = require('./src/config/database');

async function testTransactionsAPI() {
    const client = await pool.connect();
    try {
        // Get user
        const userResult = await client.query(
            "SELECT id, email FROM users WHERE email = 'lundlele@gmail.com'"
        );

        if (userResult.rows.length === 0) {
            console.log('User not found');
            return;
        }

        const userId = userResult.rows[0].id;
        console.log('Testing transactions for:', userResult.rows[0].email);
        console.log('User ID:', userId);

        // Test what the /history/transactions API would return
        const txResult = await client.query(
            `SELECT id, type, amount, status, description, created_at 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
            [userId]
        );

        console.log('\n=== TRANSACTIONS TABLE ===');
        console.log('Total transactions:', txResult.rows.length);

        if (txResult.rows.length > 0) {
            console.log('\nFirst 5 transactions:');
            txResult.rows.slice(0, 5).forEach((tx, i) => {
                console.log(`${i + 1}. Type: ${tx.type}, Amount: $${tx.amount}, Status: ${tx.status}, Date: ${tx.created_at}`);
            });
        } else {
            console.log('NO TRANSACTIONS FOUND!');
        }

        // Also check recharge_requests
        const rechargeResult = await client.query(
            `SELECT id, amount, status, created_at 
       FROM recharge_requests 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
            [userId]
        );

        console.log('\n=== RECHARGE REQUESTS TABLE ===');
        console.log('Total recharge requests:', rechargeResult.rows.length);
        rechargeResult.rows.forEach((r, i) => {
            console.log(`${i + 1}. Amount: $${r.amount}, Status: ${r.status}, Date: ${r.created_at}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

testTransactionsAPI();
