const pool = require('../config/database');

class IdempotencyKey {
  static async get(key) {
    const query = `
      SELECT * FROM idempotency_keys 
      WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP
    `;
    const result = await pool.query(query, [key]);
    return result.rows[0];
  }

  static async create({ key, userId, endpoint, response, statusCode }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const query = `
      INSERT INTO idempotency_keys (key, user_id, endpoint, response, status_code, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (key) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [
      key,
      userId,
      endpoint,
      JSON.stringify(response),
      statusCode,
      expiresAt
    ]);
    return result.rows[0];
  }

  static async cleanup() {
    const query = 'DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP';
    await pool.query(query);
  }
}

module.exports = IdempotencyKey;
