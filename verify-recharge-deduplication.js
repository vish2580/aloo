const pool = require('./src/config/database');

async function verifyDeduplication() {
    console.log('🔍 Verifying Recharge Deduplication Logic\n');
    console.log('='.repeat(70));

    try {
        // Find the test user
        const userQuery = `SELECT id, email FROM users WHERE email = $1`;
        const userResult = await pool.query(userQuery, ['lundlele@gmail.com']);

        if (userResult.rows.length === 0) {
            console.log('❌ Test user not found');
            process.exit(1);
        }

        const userId = userResult.rows[0].id;
        console.log(`\n✅ Found test user: ${userResult.rows[0].email} (ID: ${userId})`);

        // Get all recharge requests for this user
        console.log('\n📝 Fetching all recharge requests from database...');
        const rechargeQuery = `
      SELECT id, amount, status, payment_method, created_at, approved_at
      FROM recharge_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
        const rechargeResult = await pool.query(rechargeQuery, [userId]);
        const allRecharges = rechargeResult.rows;

        console.log(`✅ Found ${allRecharges.length} total recharge requests in database\n`);

        // Display all recharges
        console.log('='.repeat(70));
        console.log('ALL RECHARGE REQUESTS IN DATABASE:');
        console.log('='.repeat(70));

        allRecharges.forEach((r, index) => {
            console.log(`\n[${index + 1}] ID: ${r.id} | Status: ${r.status.toUpperCase()} | Amount: $${r.amount}`);
            console.log(`    Created: ${new Date(r.created_at).toLocaleString()}`);
            if (r.approved_at) {
                console.log(`    Approved: ${new Date(r.approved_at).toLocaleString()}`);
            }
        });

        // Check for completed transactions
        console.log('\n\n📝 Checking for COMPLETED transactions...');
        const txQuery = `
      SELECT id, reference_id, amount, status, created_at
      FROM transactions
      WHERE user_id = $1 AND type = 'recharge'
      ORDER BY created_at DESC
    `;
        const txResult = await pool.query(txQuery, [userId]);
        const rechargeTransactions = txResult.rows;

        console.log(`✅ Found ${rechargeTransactions.length} recharge transactions\n`);

        console.log('='.repeat(70));
        console.log('RECHARGE TRANSACTIONS (type=recharge):');
        console.log('='.repeat(70));

        rechargeTransactions.forEach((t, index) => {
            console.log(`\n[${index + 1}] TX ID: ${t.id} | Status: ${t.status.toUpperCase()} | Amount: $${t.amount}`);
            console.log(`    Reference: ${t.reference_id}`);
            console.log(`    Created: ${new Date(t.created_at).toLocaleString()}`);
        });

        // Apply deduplication logic
        console.log('\n\n📝 Applying deduplication logic...');
        const deduplicatedRecharges = [];

        for (const request of allRecharges) {
            // Always include PENDING and REJECTED
            if (request.status === 'pending' || request.status === 'rejected') {
                deduplicatedRecharges.push(request);
                continue;
            }

            // For APPROVED, check if COMPLETED transaction exists
            if (request.status === 'approved') {
                const refId = `RECHARGE-${request.id}`;
                const hasCompleted = rechargeTransactions.some(
                    t => t.reference_id === refId && t.status === 'completed'
                );

                if (hasCompleted) {
                    console.log(`   ⊘ Filtering out APPROVED request ID ${request.id} (COMPLETED transaction exists)`);
                    continue; // Skip this APPROVED entry
                } else {
                    console.log(`   ✓ Keeping APPROVED request ID ${request.id} (no COMPLETED transaction)`);
                    deduplicatedRecharges.push(request);
                }
            }
        }

        console.log(`\n✅ After deduplication: ${deduplicatedRecharges.length} entries\n`);

        // Display deduplicated results
        console.log('='.repeat(70));
        console.log('DEDUPLICATED RECHARGE HISTORY (What API should return):');
        console.log('='.repeat(70));

        if (deduplicatedRecharges.length === 0) {
            console.log('\nNo entries to display (all APPROVED entries had COMPLETED transactions)');
        } else {
            deduplicatedRecharges.forEach((r, index) => {
                console.log(`\n[${index + 1}] ID: ${r.id} | Status: ${r.status.toUpperCase()} | Amount: $${r.amount}`);
                console.log(`    Created: ${new Date(r.created_at).toLocaleString()}`);
            });
        }

        // Final summary
        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY:');
        console.log('='.repeat(70));
        console.log(`\n   Total recharge requests in DB: ${allRecharges.length}`);
        console.log(`   APPROVED status: ${allRecharges.filter(r => r.status === 'approved').length}`);
        console.log(`   PENDING status: ${allRecharges.filter(r => r.status === 'pending').length}`);
        console.log(`   REJECTED status: ${allRecharges.filter(r => r.status === 'rejected').length}`);
        console.log(`\n   COMPLETED transactions: ${rechargeTransactions.filter(t => t.status === 'completed').length}`);
        console.log(`\n   After deduplication: ${deduplicatedRecharges.length} entries`);
        console.log(`   Filtered out: ${allRecharges.length - deduplicatedRecharges.length} APPROVED entries\n`);

        const approvedFiltered = allRecharges.filter(r => r.status === 'approved').length -
            deduplicatedRecharges.filter(r => r.status === 'approved').length;

        if (approvedFiltered > 0) {
            console.log(`✅ SUCCESS: ${approvedFiltered} APPROVED entries filtered out (they have COMPLETED transactions)`);
        } else {
            console.log(`ℹ️  No APPROVED entries were filtered (none had COMPLETED transactions)`);
        }

        console.log('\n' + '='.repeat(70) + '\n');

        await pool.end();

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

verifyDeduplication();
