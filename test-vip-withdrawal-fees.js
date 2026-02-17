const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Test user credentials (you'll need to use actual test users with different VIP levels)
const testUsers = [
    { email: 'vip0@test.com', password: 'Test123!', expectedVipLevel: 0, expectedFeePercent: 10 },
    { email: 'vip5@test.com', password: 'Test123!', expectedVipLevel: 5, expectedFeePercent: 2 },
];

async function testWithdrawalFeeCalculation() {
    console.log('\n========== TESTING VIP-BASED WITHDRAWAL FEE CALCULATION ==========\n');

    for (const testUser of testUsers) {
        console.log(`\n--- Testing ${testUser.email} (Expected VIP ${testUser.expectedVipLevel}) ---`);

        try {
            // 1. Login
            console.log('1. Logging in...');
            const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: testUser.email,
                password: testUser.password,
            });

            if (!loginResponse.data.success) {
                console.log(`❌ Login failed for ${testUser.email}`);
                continue;
            }

            const token = loginResponse.data.data.token;
            console.log('✅ Login successful');

            // 2. Test withdrawal fee preview with different amounts
            const testAmounts = [100, 500, 1000, 5000];

            for (const amount of testAmounts) {
                console.log(`\n2. Testing withdrawal fee preview for $${amount}...`);

                const feeResponse = await axios.get(
                    `${API_BASE_URL}/wallet/withdrawal-fee-preview?amount=${amount}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (feeResponse.data.success) {
                    const { withdrawal_amount, vip_level, fee_percent, fee, net_amount } = feeResponse.data.data;

                    console.log('✅ Fee preview received:');
                    console.log(`   Withdrawal Amount: $${withdrawal_amount}`);
                    console.log(`   VIP Level: ${vip_level}`);
                    console.log(`   Fee Percent: ${fee_percent}%`);
                    console.log(`   Network Fee: $${fee}`);
                    console.log(`   You Will Receive: $${net_amount}`);

                    // Verify calculations
                    const expectedFee = parseFloat(((amount * testUser.expectedFeePercent) / 100).toFixed(2));
                    const expectedNet = parseFloat((amount - expectedFee).toFixed(2));

                    if (vip_level === testUser.expectedVipLevel && fee_percent === testUser.expectedFeePercent) {
                        console.log(`   ✅ VIP level and fee percent are correct!`);
                    } else {
                        console.log(`   ❌ VIP level or fee percent mismatch!`);
                        console.log(`      Expected VIP: ${testUser.expectedVipLevel}, Got: ${vip_level}`);
                        console.log(`      Expected Fee %: ${testUser.expectedFeePercent}%, Got: ${fee_percent}%`);
                    }

                    if (Math.abs(fee - expectedFee) < 0.01 && Math.abs(net_amount - expectedNet) < 0.01) {
                        console.log(`   ✅ Fee calculation is correct!`);
                    } else {
                        console.log(`   ❌ Fee calculation mismatch!`);
                        console.log(`      Expected Fee: $${expectedFee}, Got: $${fee}`);
                        console.log(`      Expected Net: $${expectedNet}, Got: $${net_amount}`);
                    }
                } else {
                    console.log('❌ Failed to get fee preview:', feeResponse.data.message);
                }
            }

        } catch (error) {
            console.error(`❌ Error testing ${testUser.email}:`, error.response?.data || error.message);
        }
    }

    console.log('\n========== TEST COMPLETED ==========\n');
}

// Run the test
testWithdrawalFeeCalculation().catch(console.error);
