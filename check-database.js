const pool = require('./src/config/database');

async function checkDatabase() {
    console.log('🔍 Checking Database for lundlele@gmail.com\n');
    console.log('='.repeat(70));

    try {
        // Find user
        const userQuery = `SELECT id, email FROM users WHERE email = $1`;
        const userResult = await pool.query(userQuery, ['lundlele@gmail.com']);

        if (userResult.rows.length === 0) {
            console.log('❌ User not found');
            await pool.end();
            process.exit(1);
        }

        const userId = userResult.rows[0].id;
        console.log(`✅ User ID: ${userId}\n`);

        // Get ALL recharge requests
        console.log('📝 ALL RECHARGE REQUESTS:');
        console.log('='.repeat(70));
        const rechargeQuery = `
      SELECT id, amount, status, payment_method, created_at, approved_at
      FROM recharge_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
        const rechargeResult = await pool.query(rechargeQuery, [userId]);

        console.log(`Total: ${rechargeResult.rows.length}\n`);
        rechargeResult.rows.forEach((r, i) => {
            console.log(`[${i + 1}] ID: ${r.id} | Status: ${r.status.toUpperCase()} | Amount: $${r.amount}`);
        });

        // Get ALL recharge transactions
        console.log('\n\n📝 ALL RECHARGE TRANSACTIONS:');
        console.log('='.repeat(70));
        const txQuery = `
      SELECT id, reference_id, amount, status, type, created_at
      FROM transactions
      WHERE user_id = $1 AND type = 'recharge'
      ORDER BY created_at DESC
    `;
        const txResult = await pool.query(txQuery, [userId]);

        console.log(`Total: ${txResult.rows.length}\n`);
        txResult.rows.forEach((t, i) => {
            console.log(`[${i + 1}] Ref: ${t.reference_id} | Status: ${t.status.toUpperCase()} | Amount: $${t.amount}`);
        });

        // Check which APPROVED entries have COMPLETED transactions
        console.log('\n\n📝 DEDUPLICATION CHECK:');
        console.log('='.repeat(70));

        const approvedRequests = rechargeResult.rows.filter(r => r.status === 'approved');
        console.log(`\nAPPROVED recharge requests: ${approvedRequests.length}`);

        for (const req of approvedRequests) {
            const refId = `RECHARGE-${req.id}`;
            const hasTx = txResult.rows.some(t => t.reference_id === refId && t.status === 'completed');
            console.log(`  - Request ID ${req.id}: ${hasTx ? '✓ HAS' : '✗ NO'} completed transaction (${refId})`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('EXPECTED RESULT AFTER DEDUPLICATION:');
        console.log('='.repeat(70));

        let expectedCount = 0;
        rechargeResult.rows.forEach(req => {
            if (req.status === 'pending' || req.status === 'rejected') {
                expectedCount++;
                console.log(`  ✓ Include: ID ${req.id} (${req.status.toUpperCase()})`);
            } else if (req.status === 'approved') {
                const refId = `RECHARGE-${req.id}`;
                const hasTx = txResult.rows.some(t => t.reference_id === refId && t.status === 'completed');
                if (hasTx) {
                    console.log(`  ✗ Filter: ID ${req.id} (APPROVED with COMPLETED tx)`);
                } else {
                    expectedCount++;
                    console.log(`  ✓ Include: ID ${req.id} (APPROVED without COMPLETED tx)`);
                }
            }
        });

        console.log(`\n📊 Expected entries in Deposit tab: ${expectedCount}`);
        console.log('='.repeat(70) + '\n');

        await pool.end();

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

checkDatabase();
