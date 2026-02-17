require('dotenv').config();
const pool = require('./src/config/database');
const fetch = require('node-fetch');

async function testAPIEndpoint() {
    console.log('🧪 Testing ACTUAL API endpoint /api/game/bet\n');

    try {
        // First, login to get token
        console.log('1️⃣ Logging in...');
        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'lundlele@gmail.com',
                password: 'Lund@1234'
            })
        });

        const loginData = await loginResponse.json();
        if (!loginData.success) {
            console.error('❌ Login failed:', loginData.message);
            return;
        }

        const token = loginData.data.token;
        console.log('✅ Login successful, got token');

        // Get current round info
        console.log('\n2️⃣ Getting current round...');
        const roundResponse = await fetch('http://localhost:5000/api/game/current-round');
        const roundData = await roundResponse.json();

        console.log('Round info:');
        console.log('  - Round number:', roundData.data.round_number);
        console.log('  - Status:', roundData.data.status);
        console.log('  - Time until lock:', roundData.data.time_until_lock, 'seconds');
        console.log('  - Time until end:', roundData.data.time_until_end, 'seconds');
        console.log('  - Can bet:', roundData.data.can_bet);

        if (!roundData.data.can_bet) {
            console.error('❌ Betting is closed!');
            console.log('\n⏰ TIMING ISSUE FOUND:');
            console.log('  - BET_LOCK_BEFORE_SECONDS in .env:', process.env.BET_LOCK_BEFORE_SECONDS);
            console.log('  - Time until lock:', roundData.data.time_until_lock);
            console.log('  - Time until end:', roundData.data.time_until_end);
            console.log('  - Betting should close at:', process.env.BET_LOCK_BEFORE_SECONDS, 'seconds before end');
            console.log('  - But it\'s closing at:', roundData.data.time_until_end, 'seconds before end');
            return;
        }

        // Place bet via API
        console.log('\n3️⃣ Placing bet via API...');
        const betResponse = await fetch('http://localhost:5000/api/game/bet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                choice: 'green',
                amount: 10
            })
        });

        const betData = await betResponse.json();

        if (betResponse.ok) {
            console.log('✅✅✅ BET PLACED VIA API SUCCESSFULLY! ✅✅✅');
            console.log('Response:', JSON.stringify(betData, null, 2));
        } else {
            console.error('❌ BET FAILED VIA API!');
            console.error('Status:', betResponse.status);
            console.error('Response:', JSON.stringify(betData, null, 2));
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await pool.end();
    }
}

testAPIEndpoint();
