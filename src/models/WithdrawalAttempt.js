const pool = require('../config/database');

class WithdrawalAttempt {
  static async get(userId) {
    const query = 'SELECT * FROM withdrawal_attempts WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  static async incrementFailed(userId, client = pool) {
    const query = `
      INSERT INTO withdrawal_attempts (user_id, failed_attempts, last_attempt)
      VALUES ($1, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET 
        failed_attempts = withdrawal_attempts.failed_attempts + 1,
        last_attempt = CURRENT_TIMESTAMP,
        locked_until = CASE 
          WHEN withdrawal_attempts.failed_attempts + 1 >= 3 
          THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
          ELSE withdrawal_attempts.locked_until
        END
      RETURNING *
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  static async reset(userId, client = pool) {
    const query = `
      UPDATE withdrawal_attempts 
      SET failed_attempts = 0, locked_until = NULL, last_attempt = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  static async isLocked(userId) {
    const query = `
      SELECT locked_until FROM withdrawal_attempts 
      WHERE user_id = $1 AND locked_until > CURRENT_TIMESTAMP
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.length > 0;
  }
}

module.exports = WithdrawalAttempt;
