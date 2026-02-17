/**
 * Quick test to verify withdrawal fee fix is working
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

async function testWithdrawal() {
    try {
        console.log('🧪 Testing Withdrawal Fee Fix\n');

        // Login
        console.log('1️⃣ Logging in...');
        const loginRes = await makeRequest('POST', '/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        const token = loginRes.data.data.token;
        console.log('✅ Logged in\n');

        // Get balance
        const balanceRes = await makeRequest('GET', '/wallet/balance', null, token);
        const balance = balanceRes.data.data.main_balance;
        console.log(`2️⃣ Current balance: $${balance}\n`);

        // Test withdrawal
        const testAmount = 50;
        console.log(`3️⃣ Testing withdrawal of $${testAmount}...`);
        console.log(`   Expected with 10% fee:`);
        console.log(`   - Withdrawal Amount: $50`);
        console.log(`   - Fee: $5`);
        console.log(`   - Net Received: $45`);
        console.log(`   - Balance Deduction: $50\n`);

        try {
            const withdrawalRes = await makeRequest('POST', '/wallet/withdraw', {
                amount: testAmount,
                withdrawal_password: TEST_USER.withdrawal_password,
                wallet_address: 'TEST_' + Date.now()
            }, token);

            console.log('✅ Withdrawal successful!\n');
            console.log('📊 Response:');
            const data = withdrawalRes.data.data;
            console.log(`   Withdrawal Amount: $${data.withdrawal_amount}`);
            console.log(`   Fee: $${data.fee}`);
            console.log(`   Net Amount Received: $${data.net_amount_received}`);
            console.log(`   Total Deducted: $${data.total_deducted}\n`);

            // Verify
            const isCorrect =
                data.withdrawal_amount === 50 &&
                data.fee === 5 &&
                data.net_amount_received === 45 &&
                data.total_deducted === 50;

            if (isCorrect) {
                console.log('🎉 SUCCESS! Withdrawal fee calculation is CORRECT!');
            } else {
                console.log('❌ FAILED! Values are still wrong:');
                console.log(`   Expected: amount=50, fee=5, net=45, deducted=50`);
                console.log(`   Got: amount=${data.withdrawal_amount}, fee=${data.fee}, net=${data.net_amount_received}, deducted=${data.total_deducted}`);
            }

        } catch (withdrawError) {
            if (withdrawError.data) {
                console.log('❌ Withdrawal failed:', withdrawError.data.message);
                if (withdrawError.data.error_code) {
                    console.log('   Error code:', withdrawError.data.error_code);
                }
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

testWithdrawal();
