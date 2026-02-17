require('dotenv').config();
const fetch = require('node-fetch');

async function testBetEndpoint() {
    try {
        console.log('\n=== TESTING BET ENDPOINT ===\n');

        // First, login to get token
        console.log('1. Logging in...');
        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'testuser',
                password: 'Test@123'
            })
        });

        if (!loginResponse.ok) {
            console.log('❌ Login failed:', loginResponse.status);
            const error = await loginResponse.text();
            console.log(error);
            return;
        }

        const loginData = await loginResponse.json();
        const token = loginData.data.token;
        console.log('✅ Logged in successfully');
        console.log('Token:', token.substring(0, 20) + '...');

        // Check current round
        console.log('\n2. Checking current round...');
        const roundResponse = await fetch('http://localhost:5000/api/game/current-round', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const roundData = await roundResponse.json();
        console.log('Round:', roundData.data.round_number);
        console.log('Status:', roundData.data.status);
        console.log('Can Bet:', roundData.data.can_bet);

        if (!roundData.data.can_bet) {
            console.log('\n❌ Cannot place bet right now');
            console.log('Reason: Round is locked or not active');
            return;
        }

        // Try to place bet
        console.log('\n3. Placing bet...');
        console.log('Amount: $50');
        console.log('Choice: red');

        const startTime = Date.now();
        console.log('Request sent at:', new Date().toISOString());

        const betResponse = await fetch('http://localhost:5000/api/game/bet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                choice: 'red',
                amount: 50
            })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log('Response received at:', new Date().toISOString());
        console.log('Duration:', duration, 'ms');
        console.log('Status:', betResponse.status);

        if (betResponse.ok) {
            const betData = await betResponse.json();
            console.log('\n✅ BET PLACED SUCCESSFULLY!');
            console.log('Bet ID:', betData.data.bet_id);
            console.log('New Balance:', betData.data.new_balance);
        } else {
            const error = await betResponse.text();
            console.log('\n❌ BET FAILED');
            console.log('Error:', error);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

testBetEndpoint();
