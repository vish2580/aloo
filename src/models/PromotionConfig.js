const pool = require('../config/database');

class PromotionConfig {
  static async get(key) {
    const query = 'SELECT value FROM promotion_config WHERE key = $1';
    const result = await pool.query(query, [key]);
    return result.rows[0]?.value;
  }

  static async set(key, value, description = null) {
    const query = `
      INSERT INTO promotion_config (key, value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) 
      DO UPDATE SET value = $2, description = COALESCE($3, promotion_config.description), updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [key, value, description]);
    return result.rows[0];
  }

  static async getAll() {
    const query = 'SELECT * FROM promotion_config ORDER BY key';
    const result = await pool.query(query);
    return result.rows;
  }

  static async getCommissionRates() {
    const query = `
      SELECT key, value FROM promotion_config
      WHERE key LIKE 'commission_%'
    `;
    const result = await pool.query(query);
    const rates = {};
    result.rows.forEach(row => {
      rates[row.key] = parseFloat(row.value);
    });
    return rates;
  }
}

module.exports = PromotionConfig;
