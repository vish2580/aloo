require('dotenv').config();
const pool = require('./src/config/database');

/**
 * Test script for admin referral list endpoint
 * This simulates the SQL query to verify it works without errors
 */

async function testReferralListQuery() {
    console.log('🧪 Testing Admin Referral List Query...\n');

    try {
        const limit = 10;
        const offset = 0;
        const search = null;

        let searchCondition = "";
        let params = [];

        if (search) {
            searchCondition = `AND (u.email ILIKE $3 OR u.id::text ILIKE $3)`;
            params = [limit, offset, `%${search}%`];
        } else {
            params = [limit, offset];
        }

        // Clean query using ONLY existing columns
        const query = `
      WITH team_stats AS (
        SELECT
          r.referred_by as inviter_id,
          COUNT(DISTINCT r.user_id) as team_count,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(t.amount), 0)
             FROM transactions t
             WHERE t.user_id = r.user_id
             AND t.type = 'deposit'
             AND t.status = 'completed')
          ), 0) as total_team_recharge
        FROM referrals r
        WHERE r.referred_by IS NOT NULL
        GROUP BY r.referred_by
      ),
      commission_totals AS (
        SELECT
          user_id,
          COALESCE(SUM(amount), 0) as total_commission
        FROM commissions
        GROUP BY user_id
      )
      SELECT
        u.id as inviter_uid,
        u.email as inviter_email,
        u.is_banned,
        u.created_at,
        u.main_balance as inviter_balance,
        COALESCE(ts.team_count, 0) as team_count,
        COALESCE(ts.total_team_recharge, 0) as team_recharge,
        COALESCE(ct.total_commission, 0) as total_commission
      FROM users u
      INNER JOIN team_stats ts ON ts.inviter_id = u.id
      LEFT JOIN commission_totals ct ON ct.user_id = u.id
      WHERE ts.team_count > 0
      ${searchCondition}
      ORDER BY ts.team_count DESC, u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        console.log('📊 Executing query...');
        const result = await pool.query(query, params);

        console.log(`✅ Query executed successfully!`);
        console.log(`📈 Found ${result.rows.length} inviters with teams\n`);

        if (result.rows.length > 0) {
            console.log('Sample result:');
            console.log(JSON.stringify(result.rows[0], null, 2));
        }

        // Test count query
        const countQuery = `
      SELECT COUNT(DISTINCT r.referred_by) as total
      FROM referrals r
      INNER JOIN users u ON r.referred_by = u.id
      WHERE r.referred_by IS NOT NULL
      ${searchCondition}
    `;

        const countParams = search ? [`%${search}%`] : [];
        const countResult = await pool.query(countQuery, countParams);

        console.log(`\n📊 Total inviters: ${countResult.rows[0].total}`);
        console.log('\n✅ All tests passed! No SQL errors.');

    } catch (error) {
        console.error('❌ Query failed:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testReferralListQuery();
