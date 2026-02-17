const pool = require('./src/config/database');

async function checkUserData() {
    const client = await pool.connect();
    try {
        // Get user ID
        const userResult = await client.query(
            "SELECT id, email FROM users WHERE email = 'lundlele@gmail.com'"
        );

        if (userResult.rows.length === 0) {
            console.log('User not found');
            return;
        }

        const userId = userResult.rows[0].id;
        console.log('User ID:', userId);
        console.log('Email:', userResult.rows[0].email);
        console.log('\n--- RECHARGE REQUESTS ---');

        // Check recharge_requests table
        const rechargeResult = await client.query(
            `SELECT id, amount, status, payment_method, created_at, approved_at 
       FROM recharge_requests 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
            [userId]
        );

        console.log('Total recharge requests:', rechargeResult.rows.length);
        rechargeResult.rows.forEach(row => {
            console.log(`- ID: ${row.id}, Amount: $${row.amount}, Status: ${row.status}, Created: ${row.created_at}`);
        });

        console.log('\n--- TRANSACTIONS ---');

        // Check transactions table
        const txResult = await client.query(
            `SELECT id, type, amount, status, description, created_at 
       FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
            [userId]
        );

        console.log('Total transactions:', txResult.rows.length);
        txResult.rows.forEach(row => {
            console.log(`- Type: ${row.type}, Amount: $${row.amount}, Status: ${row.status}, Created: ${row.created_at}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

checkUserData();
