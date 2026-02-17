const http = require('http');

async function testAdminWithdrawalsAPI() {
    console.log('Testing Admin Withdrawals API...\n');

    // Step 1: Admin login
    const loginPayload = JSON.stringify({
        username: 'admin',
        password: 'admin123'
    });

    const loginOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginPayload)
        }
    };

    const token = await new Promise((resolve, reject) => {
        const req = http.request(loginOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('[ADMIN LOGIN] Status:', res.statusCode);
                    if (response.success && response.data && response.data.token) {
                        console.log('[ADMIN LOGIN] ✅ Success\n');
                        resolve(response.data.token);
                    } else {
                        console.log('[ADMIN LOGIN] ❌ Failed:', response.message);
                        reject(new Error('Admin login failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(loginPayload);
        req.end();
    });

    // Step 2: Get withdrawals
    const withdrawalsOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/withdrawals',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(withdrawalsOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('[GET WITHDRAWALS] Status:', res.statusCode);
                try {
                    const response = JSON.parse(data);
                    console.log('[GET WITHDRAWALS] Response:');
                    console.log(JSON.stringify(response, null, 2));

                    if (response.success && response.data) {
                        console.log(`\n✅ Found ${response.data.length} withdrawal(s)`);
                    } else {
                        console.log('\n❌ No withdrawals or error');
                    }
                    resolve();
                } catch (e) {
                    console.log('Raw response:', data);
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

testAdminWithdrawalsAPI()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((e) => {
        console.log('\n❌ Test failed:', e.message);
        process.exit(1);
    });
