const pool = require('../config/database');

class Bet {
  static async create({ userId, roundId, roundNumber, choice, amount, taxAmount = 0, stakeAmount = null }, client = pool) {
    // If stakeAmount not provided, calculate it (bet - tax)
    const calculatedStake = stakeAmount !== null ? stakeAmount : (amount - taxAmount);

    const query = `
      INSERT INTO bets (user_id, round_id, round_number, choice, amount, tax_amount, stake_amount, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `;
    const result = await client.query(query, [userId, roundId, roundNumber, choice, amount, taxAmount, calculatedStake]);
    return result.rows[0];
  }

  static async getByRoundId(roundId) {
    const query = 'SELECT * FROM bets WHERE round_id = $1';
    const result = await pool.query(query, [roundId]);
    return result.rows;
  }

  static async getPendingByRoundId(roundId, client = pool) {
    const query = `SELECT * FROM bets WHERE round_id = $1 AND result = 'pending'`;
    const result = await client.query(query, [roundId]);
    return result.rows;
  }

  static async updateResult(betId, result, payout, client = pool) {
    const query = `
      UPDATE bets 
      SET result = $1, payout = $2 
      WHERE id = $3 
      RETURNING *
    `;
    const res = await client.query(query, [result, payout, betId]);
    return res.rows[0];
  }

  static async getByUserId(userId, limit = 50, offset = 0) {
    const query = `
      SELECT b.*, gr.result as round_result, gr.result_number 
      FROM bets b
      LEFT JOIN game_rounds gr ON b.round_id = gr.id
      WHERE b.user_id = $1 
      ORDER BY b.created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async getUserBetsForRound(userId, roundId) {
    const query = 'SELECT * FROM bets WHERE user_id = $1 AND round_id = $2';
    const result = await pool.query(query, [userId, roundId]);
    return result.rows;
  }

  // Get user's bet history with pagination and total count
  static async getUserBetHistoryWithCount(userId, limit = 5, offset = 0) {
    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM bets WHERE user_id = $1';
    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated bets with round information
    const dataQuery = `
      SELECT b.*, gr.result as round_result, gr.result_number, gr.round_number 
      FROM bets b
      LEFT JOIN game_rounds gr ON b.round_id = gr.id
      WHERE b.user_id = $1 
      ORDER BY b.created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const dataResult = await pool.query(dataQuery, [userId, limit, offset]);

    return {
      bets: dataResult.rows,
      total: total
    };
  }
}

module.exports = Bet;
