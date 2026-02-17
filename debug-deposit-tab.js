const http = require('http');

const API_BASE_URL = 'localhost';
const API_PORT = 5000;
const TEST_USER = {
    email: 'lundlele@gmail.com',
    password: 'lodaloda'
};

function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE_URL,
            port: API_PORT,
            path: `/api${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || parsed.error || body}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${body}`));
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function debugDepositTab() {
    console.log('🔍 Debugging Deposit Tab Issue\n');
    console.log('='.repeat(70));

    try {
        // Step 1: Login
        console.log('\n📝 Step 1: Logging in...');
        const loginResponse = await makeRequest('/auth/login', 'POST', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        const token = loginResponse.data.token;
        const userId = loginResponse.data.user.id;
        console.log(`✅ Login successful - User ID: ${userId}`);

        // Step 2: Fetch recharge history (what Deposit tab uses)
        console.log('\n📝 Step 2: Fetching /wallet/recharge-history (Deposit tab endpoint)...');
        const rechargeResponse = await makeRequest('/wallet/recharge-history', 'GET', null, token);

        const recharges = rechargeResponse.data;
        console.log(`✅ API returned ${recharges.length} recharge entries\n`);

        console.log('='.repeat(70));
        console.log('RECHARGE HISTORY API RESPONSE:');
        console.log('='.repeat(70));

        if (recharges.length === 0) {
            console.log('\n⚠️  NO RECHARGE ENTRIES RETURNED!');
        } else {
            recharges.forEach((r, index) => {
                console.log(`\n[${index + 1}] Recharge ID: ${r.id}`);
                console.log(`    Amount: $${r.amount}`);
                console.log(`    Status: ${r.status.toUpperCase()}`);
                console.log(`    Payment Method: ${r.payment_method || 'N/A'}`);
                console.log(`    Created: ${new Date(r.created_at).toLocaleString()}`);
                if (r.approved_at) {
                    console.log(`    Approved: ${new Date(r.approved_at).toLocaleString()}`);
                }
            });
        }

        // Step 3: Check database directly
        console.log('\n\n📝 Step 3: Checking what the frontend receives...');
        console.log('='.repeat(70));
        console.log('EXPECTED FRONTEND MAPPING:');
        console.log('='.repeat(70));

        const frontendData = recharges.map(r => ({
            id: `recharge_${r.id}`,
            type: 'recharge',
            amount: parseFloat(r.amount),
            status: r.status,
            description: `Recharge Request - ${r.payment_method || 'USDT'}`,
            created_at: r.created_at
        }));

        console.log(`\nFrontend will receive ${frontendData.length} transactions`);
        frontendData.forEach((t, index) => {
            console.log(`\n[${index + 1}] ${t.description}`);
            console.log(`    Amount: $${t.amount}`);
            console.log(`    Status: ${t.status.toUpperCase()}`);
        });

        // Step 4: Fetch all transactions (what All tab uses)
        console.log('\n\n📝 Step 4: Fetching /history/transactions (All tab endpoint)...');
        const allTxResponse = await makeRequest('/history/transactions', 'GET', null, token);

        const allTransactions = allTxResponse.data;
        const rechargeTx = allTransactions.filter(t => t.type === 'recharge');

        console.log(`✅ All transactions: ${allTransactions.length} total`);
        console.log(`✅ Recharge transactions: ${rechargeTx.length}\n`);

        console.log('='.repeat(70));
        console.log('COMPARISON:');
        console.log('='.repeat(70));
        console.log(`\nDeposit tab (/wallet/recharge-history): ${recharges.length} entries`);
        console.log(`All tab recharge entries: ${rechargeTx.length} entries`);

        if (recharges.length < rechargeTx.length) {
            console.log('\n❌ PROBLEM FOUND: Deposit tab has FEWER entries than All tab!');
            console.log('   This means the deduplication logic is filtering TOO MUCH.');
        } else if (recharges.length === rechargeTx.length) {
            console.log('\n⚠️  Both have same count, but check if statuses match...');
        }

        console.log('\n' + '='.repeat(70));
        console.log('DIAGNOSIS:');
        console.log('='.repeat(70));

        const rejectedCount = recharges.filter(r => r.status === 'rejected').length;
        const approvedCount = recharges.filter(r => r.status === 'approved').length;
        const pendingCount = recharges.filter(r => r.status === 'pending').length;

        console.log(`\nRecharge History Breakdown:`);
        console.log(`  REJECTED: ${rejectedCount}`);
        console.log(`  APPROVED: ${approvedCount}`);
        console.log(`  PENDING: ${pendingCount}`);

        if (rejectedCount === 2 && recharges.length === 2) {
            console.log('\n❌ CONFIRMED: Only showing 2 REJECTED entries!');
            console.log('   All APPROVED entries are being filtered out incorrectly.');
        }

        console.log('\n' + '='.repeat(70) + '\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

debugDepositTab();
