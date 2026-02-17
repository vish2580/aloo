const pool = require('../config/database');

class GameRound {
  static async create({ roundNumber, startTime, lockTime, endTime }) {
    const query = `
      INSERT INTO game_rounds (round_number, start_time, lock_time, end_time, status)
      VALUES ($1, $2, $3, $4, 'betting')
      RETURNING *
    `;
    const result = await pool.query(query, [roundNumber, startTime, lockTime, endTime]);
    return result.rows[0];
  }

  static async getCurrent() {
    const query = `
      SELECT * FROM game_rounds
      WHERE status IN ('betting', 'locked')
      ORDER BY round_number DESC
      LIMIT 1
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }

  static async getById(id) {
    const query = 'SELECT * FROM game_rounds WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async updateStatus(id, status) {
    const query = `
      UPDATE game_rounds
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, id]);
    return result.rows[0];
  }

  static async setResult(id, result, resultNumber) {
    const query = `
      UPDATE game_rounds
      SET result = $1, result_number = $2, status = 'completed'
      WHERE id = $3
      RETURNING *
    `;
    const res = await pool.query(query, [result, resultNumber, id]);
    return res.rows[0];
  }

  static async getRecent(limit = 20) {
    const query = `
      SELECT * FROM game_rounds
      WHERE status = 'completed'
      ORDER BY round_number DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  static async getOrphanedRounds() {
    const query = `
      SELECT * FROM game_rounds
      WHERE status IN ('betting', 'locked')
      AND end_time < NOW()
      ORDER BY round_number ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async getLastRound() {
    const query = `
      SELECT * FROM game_rounds
      ORDER BY round_number DESC
      LIMIT 1
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }
}

module.exports = GameRound;
