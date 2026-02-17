const http = require('http');

/**
 * BACKEND WITHDRAWAL TEST SCRIPT
 * Tests POST /api/wallet/withdraw with full logging
 */

async function testWithdrawalBackend() {
    console.log('='.repeat(60));
    console.log('BACKEND WITHDRAWAL TEST');
    console.log('='.repeat(60));
    console.log('User: lundlele@gmail.com');
    console.log('Endpoint: POST /api/wallet/withdraw');
    console.log('='.repeat(60));

    // Step 1: Login to get token
    console.log('\n[STEP 1] Logging in...');
    const loginPayload = JSON.stringify({
        email: 'lundlele@gmail.com',
        password: 'lodaloda'
    });

    const loginOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginPayload)
        },
        timeout: 10000
    };

    const token = await new Promise((resolve, reject) => {
        const req = http.request(loginOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`[LOGIN] Status: ${res.statusCode}`);
                    console.log(`[LOGIN] Response:`, JSON.stringify(response, null, 2));

                    if (response.success && response.data && response.data.token) {
                        console.log('[LOGIN] ✅ Success - Token obtained');
                        resolve(response.data.token);
                    } else {
                        console.log('[LOGIN] ❌ Failed - No token');
                        reject(new Error('Login failed: ' + response.message));
                    }
                } catch (e) {
                    console.log('[LOGIN] ❌ Parse error:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.log('[LOGIN] ❌ Request error:', e.message);
            reject(e);
        });

        req.on('timeout', () => {
            console.log('[LOGIN] ❌ Timeout');
            req.destroy();
            reject(new Error('Login timeout'));
        });

        req.write(loginPayload);
        req.end();
    });

    // Step 2: Test withdrawal
    console.log('\n[STEP 2] Testing withdrawal...');
    console.log('='.repeat(60));

    const withdrawalPayload = {
        amount: 100,
        wallet_address: 'TXYZtest123456789abcdefghijk',
        withdrawal_password: 'lodaloda'
    };

    console.log('[REQUEST] Payload:');
    console.log(JSON.stringify(withdrawalPayload, null, 2));
    console.log('='.repeat(60));

    const withdrawalPayloadStr = JSON.stringify(withdrawalPayload);
    const withdrawalOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/wallet/withdraw',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(withdrawalPayloadStr),
            'Authorization': `Bearer ${token}`
        },
        timeout: 10000
    };

    const startTime = Date.now();
    console.log(`[WITHDRAWAL] Request sent at: ${new Date().toISOString()}`);

    return new Promise((resolve, reject) => {
        const req = http.request(withdrawalOptions, (res) => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            console.log('\n' + '='.repeat(60));
            console.log('[RESPONSE] Received');
            console.log('='.repeat(60));
            console.log(`[RESPONSE] Duration: ${duration}ms`);
            console.log(`[RESPONSE] Status Code: ${res.statusCode}`);
            console.log(`[RESPONSE] Headers:`, res.headers);

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('\n[RESPONSE] Body:');
                try {
                    const response = JSON.parse(data);
                    console.log(JSON.stringify(response, null, 2));
                } catch (e) {
                    console.log('Raw:', data);
                }

                console.log('\n' + '='.repeat(60));
                console.log('TEST RESULTS');
                console.log('='.repeat(60));

                if (duration < 3000) {
                    console.log('✅ Response time: PASS (< 3 seconds)');
                } else if (duration < 10000) {
                    console.log('⚠️  Response time: SLOW (' + duration + 'ms)');
                } else {
                    console.log('❌ Response time: TIMEOUT');
                }

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ Status code: SUCCESS (' + res.statusCode + ')');
                } else if (res.statusCode >= 400 && res.statusCode < 500) {
                    console.log('⚠️  Status code: CLIENT ERROR (' + res.statusCode + ')');
                } else {
                    console.log('❌ Status code: SERVER ERROR (' + res.statusCode + ')');
                }

                console.log('='.repeat(60));
                resolve();
            });
        });

        req.on('error', (e) => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            console.log('\n' + '='.repeat(60));
            console.log('[ERROR] Request failed');
            console.log('='.repeat(60));
            console.log(`[ERROR] Duration: ${duration}ms`);
            console.log(`[ERROR] Message: ${e.message}`);
            console.log(`[ERROR] Code: ${e.code}`);
            console.log('='.repeat(60));
            reject(e);
        });

        req.on('timeout', () => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            console.log('\n' + '='.repeat(60));
            console.log('[TIMEOUT] Request timed out');
            console.log('='.repeat(60));
            console.log(`[TIMEOUT] Duration: ${duration}ms`);
            console.log('[TIMEOUT] ❌ NO RESPONSE FROM BACKEND');
            console.log('='.repeat(60));
            console.log('\nPOSSIBLE CAUSES:');
            console.log('1. Controller execution stopped before res.json()');
            console.log('2. Hanging await without timeout');
            console.log('3. Uncommitted transaction');
            console.log('4. Database query hanging');
            console.log('5. Missing return statement in error path');
            console.log('='.repeat(60));

            req.destroy();
            reject(new Error('Withdrawal request timeout'));
        });

        req.write(withdrawalPayloadStr);
        req.end();
    });
}

// Run test
testWithdrawalBackend()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((e) => {
        console.log('\n❌ Test failed:', e.message);
        process.exit(1);
    });
