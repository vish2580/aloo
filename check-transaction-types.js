const pool = require('./src/config/database');

async function checkTransactionTypes() {
    try {
        const result = await pool.query(`
      SELECT DISTINCT type FROM transactions 
      WHERE user_id = (SELECT id FROM users WHERE email = 'lundlele@gmail.com')
      ORDER BY type;
    `);

        console.log('\n=== Transaction Types in DB ===');
        result.rows.forEach(row => {
            console.log(`  - ${row.type}`);
        });

        const sampleTxns = await pool.query(`
      SELECT type, amount, status, description, created_at 
      FROM transactions 
      WHERE user_id = (SELECT id FROM users WHERE email = 'lundlele@gmail.com')
      ORDER BY created_at DESC
      LIMIT 10;
    `);

        console.log('\n=== Recent Transactions ===');
        sampleTxns.rows.forEach(txn => {
            console.log(`  ${txn.type} | ${txn.amount} | ${txn.status} | ${txn.description}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkTransactionTypes();
