const pool = require('./src/config/database');

async function checkWithdrawalDetails() {
    try {
        console.log('Checking withdrawal with ID 2 (the $51 one)...\n');

        const result = await pool.query(`
            SELECT 
                w.*,
                u.email,
                u.uid,
                t.amount as transaction_amount,
                t.balance_before,
                t.balance_after
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN transactions t ON t.reference_id = 'WD-' || w.id
            WHERE w.id = 2
        `);

        if (result.rows.length === 0) {
            console.log('No withdrawal found with ID 2');
            return;
        }

        const w = result.rows[0];
        console.log('=== WITHDRAWAL RECORD ===');
        console.log(`ID: ${w.id}`);
        console.log(`User: ${w.email} (UID: ${w.uid})`);
        console.log(`Created: ${w.created_at}`);
        console.log(`Status: ${w.status}`);
        console.log('');
        console.log('=== STORED IN WITHDRAWALS TABLE ===');
        console.log(`amount: $${w.amount}`);
        console.log(`fee: $${w.fee}`);
        console.log(`net_amount: $${w.net_amount}`);
        console.log(`wallet_address: ${w.wallet_address}`);
        console.log('');
        console.log('=== BALANCE CHANGE (from transactions table) ===');
        console.log(`Balance before: $${w.balance_before}`);
        console.log(`Balance after: $${w.balance_after}`);
        console.log(`Amount deducted: $${Math.abs(w.transaction_amount)}`);
        console.log('');
        console.log('=== ANALYSIS ===');

        // Check if this uses old or new logic
        const expectedFeeOld = (50 * 0.02).toFixed(2); // 2% of $50
        const expectedFeeNew = (50 * 0.10).toFixed(2); // 10% of $50

        if (parseFloat(w.fee) === parseFloat(expectedFeeOld)) {
            console.log('❌ This withdrawal uses OLD LOGIC (2% fee)');
            console.log(`   Expected with old logic: amount=$51, fee=$1, net=$50`);
            console.log(`   Actual: amount=$${w.amount}, fee=$${w.fee}, net=$${w.net_amount}`);
        } else if (parseFloat(w.fee) === parseFloat(expectedFeeNew)) {
            console.log('✅ This withdrawal uses NEW LOGIC (10% fee)');
            console.log(`   Expected with new logic: amount=$50, fee=$5, net=$45`);
            console.log(`   Actual: amount=$${w.amount}, fee=$${w.fee}, net=$${w.net_amount}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkWithdrawalDetails();
