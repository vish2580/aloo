const pool = require("../config/database");

/**
 * Commission Model - Clean Commission Tracking
 *
 * RULES:
 * - Two types ONLY: 'bet_commission' (auto) or 'first_reward' (manual)
 * - Levels: 1, 2, 3 ONLY
 * - All commissions are already credited to wallet (this is read-only mirror)
 * - Commission records MUST match transaction records
 */
class Commission {
  /**
   * Create commission record
   * NOTE: This should ONLY be called from ReferralService
   * after wallet has been credited and transaction logged
   */
  static async create(
    {
      userId,
      sourceUserId,
      level,
      amount,
      type,
      referenceId = null,
      description = null,
    },
    client = pool,
  ) {
    // Validate type
    if (!["bet_commission", "first_reward"].includes(type)) {
      throw new Error(
        `Invalid commission type: ${type}. Must be 'bet_commission' or 'first_reward'`,
      );
    }

    // Validate level
    if (![1, 2, 3].includes(level)) {
      throw new Error(`Invalid level: ${level}. Must be 1, 2, or 3`);
    }

    // Validate amount
    if (amount < 0) {
      throw new Error(`Commission amount cannot be negative: ${amount}`);
    }

    const query = `
      INSERT INTO commissions (user_id, source_user_id, level, amount, type, reference_id, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await client.query(query, [
      userId,
      sourceUserId,
      level,
      amount,
      type,
      referenceId,
      description,
    ]);
    return result.rows[0];
  }

  /**
   * Get all commissions for a user
   */
  static async getByUserId(userId, limit = 50, offset = 0, client = pool) {
    const query = `
      SELECT
        c.*,
        u.email as source_email,
        u.phone as source_phone
      FROM commissions c
      LEFT JOIN users u ON c.source_user_id = u.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Get commission summary for a user
   */
  static async getTotalByUser(userId, client = pool) {
    const query = `
      SELECT
        COALESCE(SUM(amount), 0) as total_commission,
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN type = 'first_reward' THEN amount ELSE 0 END), 0) as first_reward_total,
        COALESCE(SUM(CASE WHEN type = 'bet_commission' THEN amount ELSE 0 END), 0) as bet_commission_total
      FROM commissions
      WHERE user_id = $1
    `;
    const result = await client.query(query, [userId]);
    return {
      total_commission: parseFloat(result.rows[0].total_commission),
      total_count: parseInt(result.rows[0].total_count),
      first_reward_total: parseFloat(result.rows[0].first_reward_total),
      bet_commission_total: parseFloat(result.rows[0].bet_commission_total),
    };
  }

  /**
   * Get commission total by level
   */
  static async getByLevel(userId, level, client = pool) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM commissions
      WHERE user_id = $1 AND level = $2
    `;
    const result = await client.query(query, [userId, level]);
    return parseFloat(result.rows[0].total);
  }

  /**
   * Get commission earned from a specific source user (for "Water Reward")
   */
  static async getFromSourceUser(userId, sourceUserId, client = pool) {
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'bet_commission' THEN amount ELSE 0 END), 0) as water_reward,
        COALESCE(SUM(CASE WHEN type = 'first_reward' THEN amount ELSE 0 END), 0) as first_reward
      FROM commissions
      WHERE user_id = $1 AND source_user_id = $2
    `;
    const result = await client.query(query, [userId, sourceUserId]);
    return {
      water_reward: parseFloat(result.rows[0].water_reward),
      first_reward: parseFloat(result.rows[0].first_reward),
    };
  }

  /**
   * Get commission breakdown by level for a user
   */
  static async getBreakdownByLevel(userId, client = pool) {
    const query = `
      SELECT
        level,
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM commissions
      WHERE user_id = $1
      GROUP BY level
      ORDER BY level
    `;
    const result = await client.query(query, [userId]);

    const breakdown = { level_1: 0, level_2: 0, level_3: 0 };
    result.rows.forEach((row) => {
      breakdown[`level_${row.level}`] = parseFloat(row.total);
    });

    return breakdown;
  }

  /**
   * Get commission history with filters
   */
  static async getHistory(
    { userId, type = null, level = null, limit = 50, offset = 0 },
    client = pool,
  ) {
    let query = `
      SELECT
        c.*,
        u.email as source_email,
        u.phone as source_phone
      FROM commissions c
      LEFT JOIN users u ON c.source_user_id = u.id
      WHERE c.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (type) {
      query += ` AND c.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (level) {
      query += ` AND c.level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
  }

  /**
   * Get commission count for a user
   */
  static async getCount(userId, client = pool) {
    const query =
      "SELECT COUNT(*) as count FROM commissions WHERE user_id = $1";
    const result = await client.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if user has received first reward from a specific source user
   */
  static async hasReceivedFirstReward(userId, sourceUserId, client = pool) {
    const query = `
      SELECT 1 FROM commissions
      WHERE user_id = $1
        AND source_user_id = $2
        AND type = 'first_reward'
      LIMIT 1
    `;
    const result = await client.query(query, [userId, sourceUserId]);
    return result.rows.length > 0;
  }

  /**
   * Get all commissions (admin only)
   */
  static async getAll(
    { limit = 100, offset = 0, type = null, level = null },
    client = pool,
  ) {
    let query = `
      SELECT
        c.*,
        u1.email as user_email,
        u2.email as source_email
      FROM commissions c
      LEFT JOIN users u1 ON c.user_id = u1.id
      LEFT JOIN users u2 ON c.source_user_id = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND c.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (level) {
      query += ` AND c.level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
  }

  /**
   * Get platform-wide commission statistics (admin only)
   */
  static async getGlobalStats(client = pool) {
    const query = `
      SELECT
        COUNT(*) as total_commissions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN type = 'bet_commission' THEN amount ELSE 0 END), 0) as bet_commission_total,
        COALESCE(SUM(CASE WHEN type = 'first_reward' THEN amount ELSE 0 END), 0) as first_reward_total,
        COALESCE(SUM(CASE WHEN level = 1 THEN amount ELSE 0 END), 0) as level_1_total,
        COALESCE(SUM(CASE WHEN level = 2 THEN amount ELSE 0 END), 0) as level_2_total,
        COALESCE(SUM(CASE WHEN level = 3 THEN amount ELSE 0 END), 0) as level_3_total
      FROM commissions
    `;
    const result = await client.query(query);
    return {
      total_commissions: parseInt(result.rows[0].total_commissions),
      total_amount: parseFloat(result.rows[0].total_amount),
      bet_commission_total: parseFloat(result.rows[0].bet_commission_total),
      first_reward_total: parseFloat(result.rows[0].first_reward_total),
      level_1_total: parseFloat(result.rows[0].level_1_total),
      level_2_total: parseFloat(result.rows[0].level_2_total),
      level_3_total: parseFloat(result.rows[0].level_3_total),
    };
  }
}

module.exports = Commission;
