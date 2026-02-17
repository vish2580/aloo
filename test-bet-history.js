const pool = require('./src/config/database');

async function testBetHistory() {
    try {
        // Get user ID
        const userResult = await pool.query(
            "SELECT id, email FROM users WHERE email = 'lundlele@gmail.com'"
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found');
            return;
        }

        const userId = userResult.rows[0].id;
        console.log(`✅ Found user: ${userResult.rows[0].email} (ID: ${userId})`);

        // Get total bet count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM bets WHERE user_id = $1',
            [userId]
        );
        console.log(`\n📊 Total bets: ${countResult.rows[0].count}`);

        // Get all bets ordered by created_at DESC
        const betsResult = await pool.query(
            `SELECT b.id, b.round_number, b.choice, b.amount, b.result, b.created_at,
              gr.result as round_result, gr.result_number
       FROM bets b
       LEFT JOIN game_rounds gr ON b.round_id = gr.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
            [userId]
        );

        console.log(`\n📝 All bets (ordered by created_at DESC):`);
        betsResult.rows.forEach((bet, index) => {
            console.log(`  ${index + 1}. Bet ID: ${bet.id} | Round: ${bet.round_number} | Choice: ${bet.choice} | Amount: $${bet.amount} | Result: ${bet.result} | Created: ${bet.created_at}`);
        });

        // Test pagination - Page 1 (limit 5, offset 0)
        console.log(`\n📄 Page 1 (LIMIT 5 OFFSET 0):`);
        const page1Result = await pool.query(
            `SELECT b.id, b.round_number, b.choice, b.amount, b.result, b.created_at
       FROM bets b
       LEFT JOIN game_rounds gr ON b.round_id = gr.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 5 OFFSET 0`,
            [userId]
        );
        page1Result.rows.forEach((bet, index) => {
            console.log(`  ${index + 1}. Bet ID: ${bet.id} | Round: ${bet.round_number} | Created: ${bet.created_at}`);
        });

        // Test pagination - Page 2 (limit 5, offset 5)
        console.log(`\n📄 Page 2 (LIMIT 5 OFFSET 5):`);
        const page2Result = await pool.query(
            `SELECT b.id, b.round_number, b.choice, b.amount, b.result, b.created_at
       FROM bets b
       LEFT JOIN game_rounds gr ON b.round_id = gr.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 5 OFFSET 5`,
            [userId]
        );
        if (page2Result.rows.length === 0) {
            console.log(`  (No bets on page 2)`);
        } else {
            page2Result.rows.forEach((bet, index) => {
                console.log(`  ${index + 1}. Bet ID: ${bet.id} | Round: ${bet.round_number} | Created: ${bet.created_at}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testBetHistory();
