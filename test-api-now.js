const http = require('http');

function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api${path}`,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Parse error: ${body}`));
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    try {
        console.log('Logging in...');
        const login = await makeRequest('/auth/login', 'POST', {
            email: 'lundlele@gmail.com',
            password: 'lodaloda'
        });

        const token = login.data.token;
        console.log('✅ Logged in\n');

        console.log('Fetching /wallet/recharge-history?limit=100...');
        const recharge = await makeRequest('/wallet/recharge-history?limit=100', 'GET', null, token);

        console.log(`\n📊 API returned ${recharge.data.length} entries:\n`);
        recharge.data.forEach((r, i) => {
            console.log(`[${i + 1}] ID: ${r.id} | Status: ${r.status.toUpperCase()} | Amount: $${r.amount}`);
        });

        console.log(`\n✅ Total entries: ${recharge.data.length}`);

        const byStatus = {};
        recharge.data.forEach(r => {
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        });

        console.log('\nBreakdown by status:');
        Object.entries(byStatus).forEach(([status, count]) => {
            console.log(`  ${status.toUpperCase()}: ${count}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

test();
