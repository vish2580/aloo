/**
 * Simple test script to verify corrected withdrawal fee calculation
 * Uses native http module - no external dependencies
 */

const http = require('http');

const API_BASE = 'localhost';
const API_PORT = 5000;

// Test user credentials
const TEST_USER = {
    email: 'lundlele@gmail.com',
    password: 'lodaloda',
    withdrawal_password: 'lodaloda'
};

function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE,
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
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 400) {
                        reject({ statusCode: res.statusCode, data: parsed });
                    } else {
                        resolve({ statusCode: res.statusCode, data: parsed });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, error: 'Invalid JSON', body });
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

async function testWithdrawalFeeCalculation() {
    try {
        console.log('🧪 Testing Withdrawal Fee Calculation Fix\n');
        console.log('='.repeat(60));

        // Step 1: Login
        console.log('\n1️⃣ Logging in as', TEST_USER.email);
        const loginRes = await makeRequest('POST', '/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        const token = loginRes.data.token || loginRes.data.data?.token;
        console.log('✅ Login successful');
        console.log('   Token:', token ? 'received' : 'NOT FOUND');
        console.log('   Response structure:', JSON.stringify(loginRes.data, null, 2));

        // Step 2: Get current balance
        console.log('\n2️⃣ Fetching current balance...');
        const balanceRes = await makeRequest('GET', '/wallet/balance', null, token);

        const currentBalance = balanceRes.data.data.main_balance;
        console.log(`✅ Current balance: $${currentBalance}`);

        // Step 3: Check withdrawal history
        console.log('\n3️⃣ Checking withdrawal history...');
        const historyRes = await makeRequest('GET', '/wallet/withdrawals', null, token);

        console.log(`✅ Found ${historyRes.data.data.length} withdrawal(s)`);

        if (historyRes.data.data.length > 0) {
            console.log('\n📋 Existing Withdrawals:');
            historyRes.data.data.forEach((w, i) => {
                console.log(`\n[${i + 1}] ID: ${w.id}`);
                console.log(`    Withdrawal Amount: $${w.amount}`);
                console.log(`    Fee: $${w.fee}`);
                console.log(`    Net Amount: $${w.net_amount}`);
                console.log(`    Status: ${w.status}`);
                console.log(`    Created: ${new Date(w.created_at).toLocaleString()}`);

                // Show if this is old (incorrect) logic
                const expectedFee = (w.amount * 0.10).toFixed(2);
                const expectedNet = (w.amount - parseFloat(expectedFee)).toFixed(2);
                if (w.fee != expectedFee || w.net_amount != expectedNet) {
                    console.log(`    ⚠️  OLD LOGIC (before fix)`);
                }
            });
        }

        // Step 4: Test new withdrawal
        const testAmount = 100;
        const expectedFeePercent = 10;
        const expectedFee = parseFloat((testAmount * expectedFeePercent / 100).toFixed(2));
        const expectedNet = parseFloat((testAmount - expectedFee).toFixed(2));

        console.log('\n4️⃣ Testing NEW withdrawal with corrected fee logic');
        console.log(`   Withdrawal Amount: $${testAmount}`);
        console.log(`   Expected Fee (${expectedFeePercent}%): $${expectedFee}`);
        console.log(`   Expected Net Amount: $${expectedNet}`);
        console.log(`   Expected Balance Deduction: $${testAmount}`);

        if (currentBalance < testAmount) {
            console.log('\n⚠️  Insufficient balance for test withdrawal');
            console.log(`   Need: $${testAmount}, Have: $${currentBalance}`);
            console.log('\n✅ Verification complete - cannot test withdrawal due to low balance');
            console.log('\n💡 To test: Add balance via admin panel and run this script again');
            return;
        }

        // Check for pending withdrawals
        const pendingWithdrawals = historyRes.data.data.filter(w => w.status === 'pending');
        if (pendingWithdrawals.length > 0) {
            console.log('\n⚠️  Cannot test - user has pending withdrawal');
            console.log('   Please approve/reject pending withdrawal first');
            console.log('\n✅ Verification complete - skipped test due to pending withdrawal');
            return;
        }

        console.log('\n   Attempting withdrawal...');

        try {
            const withdrawalRes = await makeRequest('POST', '/wallet/withdraw', {
                amount: testAmount,
                withdrawal_password: TEST_USER.withdrawal_password,
                wallet_address: 'TEST_WALLET_' + Date.now()
            }, token);

            console.log('\n✅ Withdrawal request successful!');
            console.log('\n📊 Response Data:');
            console.log(`   Withdrawal ID: ${withdrawalRes.data.data.withdrawal_id}`);
            console.log(`   Withdrawal Amount: $${withdrawalRes.data.data.withdrawal_amount}`);
            console.log(`   Fee: $${withdrawalRes.data.data.fee}`);
            console.log(`   Net Amount Received: $${withdrawalRes.data.data.net_amount_received}`);
            console.log(`   Total Deducted: $${withdrawalRes.data.data.total_deducted}`);
            console.log(`   Status: ${withdrawalRes.data.data.status}`);

            // Verify calculations
            console.log('\n🔍 Verification:');
            const actualFee = withdrawalRes.data.data.fee;
            const actualNet = withdrawalRes.data.data.net_amount_received;
            const actualDeducted = withdrawalRes.data.data.total_deducted;

            const feeMatch = actualFee === expectedFee;
            const netMatch = actualNet === expectedNet;
            const deductedMatch = actualDeducted === testAmount;

            console.log(`   Fee calculation: ${feeMatch ? '✅' : '❌'} (Expected: $${expectedFee}, Got: $${actualFee})`);
            console.log(`   Net amount: ${netMatch ? '✅' : '❌'} (Expected: $${expectedNet}, Got: $${actualNet})`);
            console.log(`   Balance deduction: ${deductedMatch ? '✅' : '❌'} (Expected: $${testAmount}, Got: $${actualDeducted})`);

            if (feeMatch && netMatch && deductedMatch) {
                console.log('\n🎉 ALL TESTS PASSED! Withdrawal fee calculation is correct.');
            } else {
                console.log('\n❌ TESTS FAILED! Fee calculation still has issues.');
            }

        } catch (withdrawError) {
            if (withdrawError.data) {
                console.log('\n❌ Withdrawal failed:', withdrawError.data.message);
                if (withdrawError.data.error_code) {
                    console.log('   Error code:', withdrawError.data.error_code);
                }
            } else {
                throw withdrawError;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Test completed\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message || error);
        if (error.data) {
            console.error('   Response:', JSON.stringify(error.data, null, 2));
        }
        process.exit(1);
    }
}

// Run test
testWithdrawalFeeCalculation();
