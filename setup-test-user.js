const pool = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function setupTestUser() {
    const client = await pool.connect();

    try {
        console.log('Checking for user: lundlele@gmail.com');

        // Check if user exists
        const userCheck = await client.query(
            'SELECT id, email, withdrawal_password_hash FROM users WHERE email = $1',
            ['lundlele@gmail.com']
        );

        if (userCheck.rows.length === 0) {
            console.log('User does not exist. Creating...');

            const password = await bcrypt.hash('Test@123', 10);
            const withdrawalPassword = await bcrypt.hash('Test@123', 10);

            const result = await client.query(
                `INSERT INTO users (email, password_hash, withdrawal_password_hash, main_balance, locked_balance)
         VALUES ($1, $2, $3, 1000, 0)
         RETURNING id, email`,
                ['lundlele@gmail.com', password, withdrawalPassword]
            );

            console.log('✅ User created:', result.rows[0]);
        } else {
            console.log('✅ User exists:', userCheck.rows[0].email);
            console.log('Has withdrawal password:', userCheck.rows[0].withdrawal_password_hash !== null);

            // Update withdrawal password if missing
            if (!userCheck.rows[0].withdrawal_password_hash) {
                console.log('Setting withdrawal password...');
                const withdrawalPassword = await bcrypt.hash('Test@123', 10);
                await client.query(
                    'UPDATE users SET withdrawal_password_hash = $1 WHERE email = $2',
                    [withdrawalPassword, 'lundlele@gmail.com']
                );
                console.log('✅ Withdrawal password set');
            }

            // Update login password to known value
            console.log('Updating login password to Test@123...');
            const password = await bcrypt.hash('Test@123', 10);
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE email = $2',
                [password, 'lundlele@gmail.com']
            );
            console.log('✅ Login password updated');
        }

        console.log('\n✅ Test user ready');
        console.log('Email: lundlele@gmail.com');
        console.log('Password: Test@123');
        console.log('Withdrawal Password: Test@123');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

setupTestUser();
