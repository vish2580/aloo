const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testApi() {
    console.log('🧪 Testing API...');

    // 1. Register User
    const email = `test${Date.now()}@example.com`;
    const password = 'password123';
    console.log(`\n📝 Registering user: ${email}`);

    try {
        const registerRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                confirmPassword: password,
                withdrawal_password: 'withdraw123',
                country: 'US',
                referral_code: '123456'
            })
        });

        const registerData = await registerRes.json();
        console.log('Register Response:', registerData);

        if (!registerData.success && !registerData.token) {
            console.error('❌ Registration failed');
            // If invite code is required and invalid, we might fail here.
            // Let's try login if user already exists (unlikely with timestamp)
            return;
        }

        const token = registerData.token;
        console.log('✅ Registration successful. Token received.');

        // 2. Get User Profile
        console.log('\n👤 Fetching user profile...');
        const profileRes = await fetch(`${BASE_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const profileData = await profileRes.json();
        console.log('Profile Response:', profileData);

        if (profileData.success) {
            console.log('✅ Profile fetch successful');
            console.log(`User ID: ${profileData.user.id}`);
            console.log(`Balance: ${profileData.user.main_balance}`);
        } else {
            console.error('❌ Profile fetch failed');
        }

    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

testApi();
