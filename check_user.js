const pool = require('./src/config/database');

(async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT id, email, vip_level, total_wager, pending_vip_bonus, main_balance FROM users WHERE email = $1',
            ['lundlele@gmail.com']
        );

        if (result.rows.length > 0) {
            console.log('=== USER DATA ===');
            console.log(JSON.stringify(result.rows[0], null, 2));
        } else {
            console.log('User not found');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();
