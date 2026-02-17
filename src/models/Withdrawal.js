const pool = require('../config/database');

class Withdrawal {
  static async create({ userId, amount, fee, netAmount, walletAddress }, client = pool) {
    const query = `
      INSERT INTO withdrawals (user_id, amount, fee, net_amount, wallet_address, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    const result = await client.query(query, [userId, amount, fee, netAmount, walletAddress]);
    return result.rows[0];
  }

  static async getByUserId(userId, limit = 50) {
    const query = `
      SELECT * FROM withdrawals 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  static async getPendingByUserId(userId) {
    const query = `
      SELECT * FROM withdrawals 
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }
}

module.exports = Withdrawal;
