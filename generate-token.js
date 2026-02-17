/**
 * CHECK TOKEN VALIDITY
 */

const pool = require('./src/config/database');
const jwt = require('jsonwebtoken');

async function checkToken() {
    console.log('🔐 TOKEN VALIDITY CHECK');
    console.log('='.repeat(60));

    // Get user
    const userResult = await pool.query(
        'SELECT id, email FROM users WHERE email = $1',
        ['lundlele@gmail.com']
    );

    if (userResult.rows.length === 0) {
        console.log('❌ User not found');
        await pool.end();
        return;
    }

    const user = userResult.rows[0];
    console.log(`\n✅ User exists: ${user.email}`);
    console.log(`   User ID: ${user.id}`);

    // Generate a valid token
    const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('\n📝 VALID TOKEN FOR TESTING:');
    console.log('');
    console.log(token);
    console.log('');
    console.log('='.repeat(60));
    console.log('\n💡 HOW TO USE THIS TOKEN:');
    console.log('   1. Open browser DevTools (F12)');
    console.log('   2. Go to Console tab');
    console.log('   3. Paste this command:');
    console.log('');
    console.log(`      localStorage.setItem('auth_token', '${token}');`);
    console.log('');
    console.log('   4. Refresh the page');
    console.log('   5. You should be logged in');
    console.log('   6. Try placing a bet');
    console.log('');

    await pool.end();
}

checkToken().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
