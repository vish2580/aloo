/**
 * Test minimum withdrawal amount
 */

const http = require('http');

const API_BASE = 'localhost';
const API_PORT = 5000;

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

async function testMinWithdrawal() {
    try {
        console.log('🧪 Testing Minimum Withdrawal Amount\n');

        // Login
        console.log('1️⃣ Logging in...');
        const loginRes = await makeRequest('POST', '/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        const token = loginRes.data.data.token;
        console.log('✅ Logged in\n');

        // Clear pending withdrawals first
        console.log('2️⃣ Clearing pending withdrawals...');
        const withdrawalsRes = await makeRequest('GET', '/wallet/withdrawals', null, token);
        const pendingWithdrawals = withdrawalsRes.data.data.filter(w => w.status === 'pending');

        if (pendingWithdrawals.length > 0) {
            console.log(`   Found ${pendingWithdrawals.length} pending withdrawal(s), please reject them in admin panel first.`);
            console.log('   Skipping withdrawal test.\n');
            return;
        }
        console.log('✅ No pending withdrawals\n');

        // Test $20 withdrawal (should succeed)
        console.log('3️⃣ Testing $20 withdrawal (minimum amount)...');
        try {
            const withdrawalRes = await makeRequest('POST', '/wallet/withdraw', {
                amount: 20,
                withdrawal_password: TEST_USER.withdrawal_password,
                wallet_address: 'TEST_MIN_' + Date.now()
            }, token);

            console.log('✅ $20 withdrawal ACCEPTED!\n');
            console.log('📊 Response:');
            const data = withdrawalRes.data.data;
            console.log(`   Withdrawal Amount: $${data.withdrawal_amount}`);
            console.log(`   Fee (10%): $${data.fee}`);
            console.log(`   Net Amount: $${data.net_amount_received}\n`);

            console.log('🎉 SUCCESS! Minimum withdrawal is now $20');

        } catch (withdrawError) {
            if (withdrawError.data) {
                console.log('❌ $20 withdrawal REJECTED');
                console.log('   Error:', withdrawError.data.message);
                console.log('   Error code:', withdrawError.data.error_code);
                console.log('\n⚠️  FAILED! Server still enforcing higher minimum');
            } else {
                throw withdrawError;
            }
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message || error);
        if (error.data) {
            console.error('   Response:', JSON.stringify(error.data, null, 2));
        }
        process.exit(1);
    }
}

testMinWithdrawal();
