const https = require('http');

// Test withdrawal request
async function testWithdrawal() {
    console.log('🧪 Testing withdrawal request...\n');

    // First, login to get token
    const loginData = JSON.stringify({
        email: 'lundlele@gmail.com',
        password: 'Test@123' // You may need to adjust this
    });

    const loginOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': loginData.length
        }
    };

    return new Promise((resolve, reject) => {
        const loginReq = https.request(loginOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const loginResponse = JSON.parse(data);

                    if (!loginResponse.success) {
                        console.log('❌ Login failed:', loginResponse.message);
                        console.log('Full response:', JSON.stringify(loginResponse, null, 2));
                        resolve();
                        return;
                    }

                    console.log('✅ Login successful');
                    const token = loginResponse.data.token;

                    // Now test withdrawal
                    const withdrawalData = JSON.stringify({
                        amount: 100,
                        withdrawal_password: 'Test@123', // Adjust if needed
                        wallet_address: 'TXYZtest123456789abcdefghijk'
                    });

                    const withdrawOptions = {
                        hostname: 'localhost',
                        port: 5000,
                        path: '/api/wallet/withdraw',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': withdrawalData.length,
                            'Authorization': `Bearer ${token}`
                        },
                        timeout: 5000 // 5 second timeout
                    };

                    console.log('\n🔄 Sending withdrawal request...');
                    const startTime = Date.now();

                    const withdrawReq = https.request(withdrawOptions, (res) => {
                        let withdrawData = '';

                        res.on('data', (chunk) => {
                            withdrawData += chunk;
                        });

                        res.on('end', () => {
                            const endTime = Date.now();
                            const duration = endTime - startTime;

                            console.log(`\n⏱️  Response received in ${duration}ms`);
                            console.log(`📊 Status Code: ${res.statusCode}`);

                            try {
                                const response = JSON.parse(withdrawData);
                                console.log('\n📦 Response:');
                                console.log(JSON.stringify(response, null, 2));

                                if (duration < 5000) {
                                    console.log('\n✅ SUCCESS: No timeout! Response received quickly.');
                                } else {
                                    console.log('\n⚠️  WARNING: Response took longer than expected.');
                                }
                            } catch (e) {
                                console.log('\n❌ Failed to parse response:', withdrawData);
                            }

                            resolve();
                        });
                    });

                    withdrawReq.on('error', (e) => {
                        console.log(`\n❌ Request error: ${e.message}`);
                        resolve();
                    });

                    withdrawReq.on('timeout', () => {
                        console.log('\n❌ REQUEST TIMED OUT!');
                        withdrawReq.destroy();
                        resolve();
                    });

                    withdrawReq.write(withdrawalData);
                    withdrawReq.end();

                } catch (e) {
                    console.log('❌ Error parsing login response:', e.message);
                    console.log('Raw data:', data);
                    resolve();
                }
            });
        });

        loginReq.on('error', (e) => {
            console.log(`❌ Login request error: ${e.message}`);
            resolve();
        });

        loginReq.write(loginData);
        loginReq.end();
    });
}

// Run the test
testWithdrawal().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch((e) => {
    console.log('\n❌ Test failed:', e.message);
    process.exit(1);
});
