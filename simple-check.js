const pool = require('./src/config/database');

async function simpleCheck() {
    try {
        // Get user
        const userResult = await pool.query(`SELECT id FROM users WHERE email = $1`, ['lundlele@gmail.com']);
        const userId = userResult.rows[0].id;
        console.log('User ID:', userId);

        // Count recharge requests by status
        const reqResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM recharge_requests 
      WHERE user_id = $1 
      GROUP BY status
    `, [userId]);

        console.log('\nRecharge Requests:');
        reqResult.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

        // Count recharge transactions
        const txResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE user_id = $1 AND type = 'recharge' AND status = 'completed'
    `, [userId]);

        console.log(`\nCompleted Recharge Transactions: ${txResult.rows[0].count}`);

        // Check if APPROVED requests have matching transactions
        const approvedResult = await pool.query(`
      SELECT id FROM recharge_requests 
      WHERE user_id = $1 AND status = 'approved'
    `, [userId]);

        console.log(`\nAPPROVED requests: ${approvedResult.rows.length}`);

        for (const req of approvedResult.rows) {
            const txCheck = await pool.query(`
        SELECT id FROM transactions 
        WHERE user_id = $1 
          AND reference_id = $2 
          AND type = 'recharge'
          AND status = 'completed'
      `, [userId, `RECHARGE-${req.id}`]);

            console.log(`  Request ${req.id}: ${txCheck.rows.length > 0 ? 'HAS' : 'NO'} completed tx`);
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

simpleCheck();
