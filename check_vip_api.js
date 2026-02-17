const pool = require('./src/config/database');

(async () => {
    const client = await pool.connect();
    try {
        // Simulate the VIP status API call
        const result = await client.query(
            'SELECT vip_level, total_wager, last_vip_upgrade, pending_vip_bonus FROM users WHERE email = $1',
            ['lundlele@gmail.com']
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('=== RAW DATABASE DATA ===');
            console.log(JSON.stringify(user, null, 2));
            console.log('\n=== WHAT API SHOULD RETURN ===');
            console.log('pending_vip_bonus:', parseFloat(user.pending_vip_bonus) || 0);
            console.log('Should show claim button?', parseFloat(user.pending_vip_bonus) > 0 ? 'YES' : 'NO');
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
