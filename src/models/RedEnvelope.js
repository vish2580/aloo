const pool = require('../config/database');

class RedEnvelope {
  static async create({ code, amount, maxClaims = 1, expiresAt = null, createdBy, eligibilityRule = 'all', targetUid = null }) {
    // If createdBy is 'admin' (not a valid UUID), set to NULL
    const creatorId = createdBy === 'admin' ? null : createdBy;

    const query = `
      INSERT INTO red_envelopes (code, amount, max_claims, expires_at, created_by, eligibility_rule, target_uid)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [code, amount, maxClaims, expiresAt, creatorId, eligibilityRule, targetUid]);
    return result.rows[0];
  }

  static async getByCode(code) {
    const query = 'SELECT * FROM red_envelopes WHERE code = $1';
    const result = await pool.query(query, [code]);
    return result.rows[0];
  }

  static async getById(id) {
    const query = 'SELECT * FROM red_envelopes WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getActiveForUser(userId = null) {
    // Get the most recent active envelope that is not expired and has claims remaining
    // If userId is provided, filter by eligibility
    let query;
    let params = [];

    if (userId) {
      query = `
        SELECT re.* FROM red_envelopes re
        LEFT JOIN users u ON u.id = $1
        WHERE re.is_active = true 
          AND re.current_claims < re.max_claims
          AND (re.expires_at IS NULL OR re.expires_at > NOW())
          AND (
            re.eligibility_rule != 'specific_user' 
            OR (re.eligibility_rule = 'specific_user' AND re.target_uid = u.uid)
          )
        ORDER BY re.created_at DESC
        LIMIT 1
      `;
      params = [userId];
    } else {
      query = `
        SELECT * FROM red_envelopes 
        WHERE is_active = true 
          AND current_claims < max_claims
          AND (expires_at IS NULL OR expires_at > NOW())
          AND eligibility_rule != 'specific_user'
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async getAll(limit = 50, offset = 0) {
    const query = `
      SELECT re.*, u.email as creator_email
      FROM red_envelopes re
      LEFT JOIN users u ON re.created_by = u.id
      ORDER BY re.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  static async incrementClaims(id, client = pool) {
    const query = `
      UPDATE red_envelopes
      SET current_claims = current_claims + 1
      WHERE id = $1
      RETURNING *
    `;
    const result = await client.query(query, [id]);
    return result.rows[0];
  }

  static async deactivate(id) {
    const query = `
      UPDATE red_envelopes
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = RedEnvelope;
