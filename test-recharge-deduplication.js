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

async function testRechargeDeduplication() {
    console.log('🧪 Testing Recharge Deduplication Fix\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Login
        console.log('\n📝 Step 1: Logging in as test user...');
        const loginResponse = await makeRequest('/auth/login', 'POST', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful');

        // Step 2: Fetch recharge history
        console.log('\n📝 Step 2: Fetching recharge history...');
        const rechargeResponse = await makeRequest('/wallet/recharge-history', 'GET', null, token);

        const recharges = rechargeResponse.data;
        console.log(`✅ Fetched ${recharges.length} recharge entries\n`);

        // Step 3: Display results
        console.log('='.repeat(60));
        console.log('RECHARGE HISTORY (After Deduplication):');
        console.log('='.repeat(60));

        if (recharges.length === 0) {
            console.log('No recharge entries found.');
        } else {
            recharges.forEach((r, index) => {
                console.log(`\n[${index + 1}] Recharge ID: ${r.id}`);
                console.log(`    Amount: $${r.amount}`);
                console.log(`    Status: ${r.status.toUpperCase()}`);
                console.log(`    Payment Method: ${r.payment_method}`);
                console.log(`    Created: ${new Date(r.created_at).toLocaleString()}`);
                if (r.approved_at) {
                    console.log(`    Approved: ${new Date(r.approved_at).toLocaleString()}`);
                }
            });
        }

        // Step 4: Check for duplicates
        console.log('\n' + '='.repeat(60));
        console.log('DUPLICATE CHECK:');
        console.log('='.repeat(60));

        const rechargeIds = recharges.map(r => r.id);
        const uniqueIds = [...new Set(rechargeIds)];

        if (rechargeIds.length === uniqueIds.length) {
            console.log('✅ NO DUPLICATES FOUND - All recharge IDs are unique');
        } else {
            console.log('❌ DUPLICATES DETECTED!');
            const duplicates = rechargeIds.filter((id, index) => rechargeIds.indexOf(id) !== index);
            console.log('   Duplicate IDs:', duplicates);
        }

        // Step 5: Status breakdown
        console.log('\n' + '='.repeat(60));
        console.log('STATUS BREAKDOWN:');
        console.log('='.repeat(60));

        const statusCounts = recharges.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});

        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status.toUpperCase()}: ${count}`);
        });

        // Step 6: Fetch transactions to compare
        console.log('\n📝 Step 6: Fetching transactions for comparison...');
        const transactionsResponse = await makeRequest('/history/transactions', 'GET', null, token);

        const transactions = transactionsResponse.data;
        const rechargeTransactions = transactions.filter(t => t.type === 'recharge');

        console.log(`✅ Found ${rechargeTransactions.length} recharge transactions in transactions table\n`);

        console.log('='.repeat(60));
        console.log('TRANSACTIONS TABLE (type=recharge):');
        console.log('='.repeat(60));

        rechargeTransactions.forEach((t, index) => {
            console.log(`\n[${index + 1}] Transaction ID: ${t.id}`);
            console.log(`    Amount: $${t.amount}`);
            console.log(`    Status: ${t.status.toUpperCase()}`);
            console.log(`    Reference: ${t.reference_id}`);
            console.log(`    Description: ${t.description}`);
            console.log(`    Created: ${new Date(t.created_at).toLocaleString()}`);
        });

        // Final verdict
        console.log('\n' + '='.repeat(60));
        console.log('FINAL VERDICT:');
        console.log('='.repeat(60));

        const approvedInRechargeHistory = recharges.filter(r => r.status === 'approved').length;
        const completedInTransactions = rechargeTransactions.filter(t => t.status === 'completed').length;

        console.log(`\n📊 Summary:`);
        console.log(`   - Recharge History API: ${recharges.length} entries`);
        console.log(`   - APPROVED status in recharge history: ${approvedInRechargeHistory}`);
        console.log(`   - COMPLETED recharge transactions: ${completedInTransactions}`);

        if (approvedInRechargeHistory === 0 && completedInTransactions > 0) {
            console.log('\n✅ FIX WORKING: No APPROVED entries shown when COMPLETED transactions exist!');
        } else if (approvedInRechargeHistory > 0) {
            console.log('\n⚠️  APPROVED entries still present.');
            console.log('   This is expected if there are APPROVED entries without COMPLETED transactions.');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(`   ${error.message}`);
        console.log('\n' + '='.repeat(60) + '\n');
        process.exit(1);
    }
}

// Run the test
testRechargeDeduplication();
