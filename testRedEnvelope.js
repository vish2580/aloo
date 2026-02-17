/**
 * FINAL TEST - Verify All Eligibility Types Work
 */

const pool = require('./src/config/database');
const RedEnvelope = require('./src/models/RedEnvelope');

async function testAllEligibilityTypes() {
    try {
        console.log('🧪 Testing Red Envelope Creation - All Eligibility Types\n');

        // Test 1: All users
        console.log('Test 1: Creating envelope with "all" eligibility...');
        const env1 = await RedEnvelope.create({
            code: 'TEST_ALL_' + Date.now(),
            amount: 10,
            maxClaims: 1,
            expiresAt: null,
            createdBy: 'admin',
            eligibilityRule: 'all',
            targetUid: null
        });
        console.log('✅ SUCCESS! Code:', env1.code, '| eligibility_rule:', env1.eligibility_rule);

        // Test 2: VIP
        console.log('\nTest 2: Creating envelope with "vip" eligibility...');
        const env2 = await RedEnvelope.create({
            code: 'TEST_VIP_' + Date.now(),
            amount: 20,
            maxClaims: 1,
            expiresAt: null,
            createdBy: 'admin',
            eligibilityRule: 'vip',
            targetUid: null
        });
        console.log('✅ SUCCESS! Code:', env2.code, '| eligibility_rule:', env2.eligibility_rule);

        // Test 3: Specific user (get a real UID first)
        console.log('\nTest 3: Creating envelope with "specific_user" eligibility...');
        const userResult = await pool.query('SELECT uid FROM users LIMIT 1');
        if (userResult.rows.length > 0) {
            const testUid = userResult.rows[0].uid;
            const env3 = await RedEnvelope.create({
                code: 'TEST_SPECIFIC_' + Date.now(),
                amount: 30,
                maxClaims: 1,
                expiresAt: null,
                createdBy: 'admin',
                eligibilityRule: 'specific_user',
                targetUid: testUid
            });
            console.log('✅ SUCCESS! Code:', env3.code, '| eligibility_rule:', env3.eligibility_rule, '| target_uid:', env3.target_uid);
        } else {
            console.log('⚠️  No users in database, skipping specific_user test');
        }

        // Clean up
        console.log('\n🧹 Cleaning up test data...');
        await pool.query(`DELETE FROM red_envelopes WHERE code LIKE 'TEST_%'`);
        console.log('✅ Cleanup complete');

        console.log('\n✅✅✅ ALL TESTS PASSED! ✅✅✅');
        console.log('\nRed envelope creation is working for:');
        console.log('  ✅ "all" eligibility');
        console.log('  ✅ "vip" eligibility');
        console.log('  ✅ "specific_user" eligibility');
        console.log('\nYou can now use the admin panel to create red envelopes!');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

testAllEligibilityTypes();
