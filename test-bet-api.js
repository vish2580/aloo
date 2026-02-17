const http = require('http');

async function testBetHistoryAPI() {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 4 }, 'your-secret-key-change-this-in-production');

    console.log('🔑 Testing bet history API for user ID 4 (lundlele@gmail.com)\n');

    const testPage = (page) => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: `/api/game/current-bets?page=${page}&limit=5`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    };

    try {
        // Test Page 1
        console.log('📄 Testing Page 1:');
        const page1 = await testPage(1);
        console.log(`  Total bets: ${page1.total}`);
        console.log(`  Current page: ${page1.page}`);
        console.log(`  Total pages: ${page1.totalPages}`);
        console.log(`  Bets returned: ${page1.data.length}`);
        console.log('  Bet IDs:', page1.data.map(b => b.bet_id));
        console.log('  Round numbers:', page1.data.map(b => b.round_number));

        // Test Page 2
        console.log('\n📄 Testing Page 2:');
        const page2 = await testPage(2);
        console.log(`  Total bets: ${page2.total}`);
        console.log(`  Current page: ${page2.page}`);
        console.log(`  Total pages: ${page2.totalPages}`);
        console.log(`  Bets returned: ${page2.data.length}`);
        console.log('  Bet IDs:', page2.data.map(b => b.bet_id));
        console.log('  Round numbers:', page2.data.map(b => b.round_number));

        console.log('\n✅ API test completed');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testBetHistoryAPI();
