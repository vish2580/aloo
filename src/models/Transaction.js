const pool = require('../config/database');

class Transaction {
  static async create({ userId, type, amount, balanceBefore, balanceAfter, status = 'completed', referenceId = null, description = null }, client = pool) {
    const query = `
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reference_id, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await client.query(query, [userId, type, amount, balanceBefore, balanceAfter, status, referenceId, description]);
    return result.rows[0];
  }

  static async getByUserId(userId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async getByType(userId, type, limit = 50) {
    const query = `
      SELECT * FROM transactions 
      WHERE user_id = $1 AND type = $2 
      ORDER BY created_at DESC 
      LIMIT $3
    `;
    const result = await pool.query(query, [userId, type, limit]);
    return result.rows;
  }
}

module.exports = Transaction;
