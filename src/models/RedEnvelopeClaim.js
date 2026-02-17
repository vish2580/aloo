const pool = require('../config/database');

class RedEnvelopeClaim {
  static async create({ envelopeId, claimedBy, amount }, client = pool) {
    const query = `
      INSERT INTO red_envelope_claims (envelope_id, claimed_by, amount)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await client.query(query, [envelopeId, claimedBy, amount]);
    return result.rows[0];
  }

  static async hasClaimed(envelopeId, userId) {
    const query = `
      SELECT * FROM red_envelope_claims
      WHERE envelope_id = $1 AND claimed_by = $2
    `;
    const result = await pool.query(query, [envelopeId, userId]);
    return result.rows.length > 0;
  }

  static async getByEnvelopeId(envelopeId, limit = 100) {
    const query = `
      SELECT rec.*, u.email as claimer_email
      FROM red_envelope_claims rec
      LEFT JOIN users u ON rec.claimed_by = u.id
      WHERE rec.envelope_id = $1
      ORDER BY rec.claimed_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [envelopeId, limit]);
    return result.rows;
  }

  static async getByUserId(userId, limit = 50) {
    const query = `
      SELECT rec.*, re.code as envelope_code
      FROM red_envelope_claims rec
      LEFT JOIN red_envelopes re ON rec.envelope_id = re.id
      WHERE rec.claimed_by = $1
      ORDER BY rec.claimed_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }
}

module.exports = RedEnvelopeClaim;
