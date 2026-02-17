const pool = require("../config/database");

/**
 * FirstReward Model - Manual Admin Reward Tracking
 *
 * RULES:
 * - First Reward is MANUAL (admin gives it)
 * - Only given when invited user makes FIRST recharge
 * - One reward per user (tracked to prevent duplicates)
 * - Creates commission entry + wallet credit + transaction
 */
class FirstReward {
  /**
   * Create first reward record
   * This is called AFTER wallet credit and transaction are logged
   */
  static async create(
    { userId, referredBy, rewardAmount, givenByAdmin },
    client = pool,
  ) {
    const query = `
      INSERT INTO first_rewards (user_id, referred_by, reward_amount, given_by_admin)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await client.query(query, [
      userId,
      referredBy,
      rewardAmount,
      givenByAdmin,
    ]);
    return result.rows[0];
  }

  /**
   * Check if user has already received first reward
   */
  static async hasReceived(userId, client = pool) {
    const query = "SELECT 1 FROM first_rewards WHERE user_id = $1 LIMIT 1";
    const result = await client.query(query, [userId]);
    return result.rows.length > 0;
  }

  /**
   * Get first reward record for a user
   */
  static async getByUserId(userId, client = pool) {
    const query = `
      SELECT
        fr.*,
        u1.email as user_email,
        u2.email as referrer_email,
        u3.email as admin_email
      FROM first_rewards fr
      LEFT JOIN users u1 ON fr.user_id = u1.id
      LEFT JOIN users u2 ON fr.referred_by = u2.id
      LEFT JOIN users u3 ON fr.given_by_admin = u3.id
      WHERE fr.user_id = $1
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get all first rewards given to a referrer's invites
   */
  static async getByReferrer(referrerId, limit = 50, offset = 0, client = pool) {
    const query = `
      SELECT
        fr.*,
        u.email as user_email,
        u.phone as user_phone
      FROM first_rewards fr
      LEFT JOIN users u ON fr.user_id = u.id
      WHERE fr.referred_by = $1
      ORDER BY fr.given_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(query, [referrerId, limit, offset]);
    return result.rows;
  }

  /**
   * Get total first rewards given to a referrer
   */
  static async getTotalByReferrer(referrerId, client = pool) {
    const query = `
      SELECT
        COALESCE(SUM(reward_amount), 0) as total,
        COUNT(*) as count
      FROM first_rewards
      WHERE referred_by = $1
    `;
    const result = await client.query(query, [referrerId]);
    return {
      total: parseFloat(result.rows[0].total),
      count: parseInt(result.rows[0].count),
    };
  }

  /**
   * Get all first rewards (admin only)
   */
  static async getAll(limit = 100, offset = 0, client = pool) {
    const query = `
      SELECT
        fr.*,
        u1.email as user_email,
        u1.phone as user_phone,
        u2.email as referrer_email,
        u3.email as admin_email
      FROM first_rewards fr
      LEFT JOIN users u1 ON fr.user_id = u1.id
      LEFT JOIN users u2 ON fr.referred_by = u2.id
      LEFT JOIN users u3 ON fr.given_by_admin = u3.id
      ORDER BY fr.given_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Get global statistics (admin only)
   */
  static async getGlobalStats(client = pool) {
    const query = `
      SELECT
        COUNT(*) as total_rewards,
        COALESCE(SUM(reward_amount), 0) as total_amount,
        COALESCE(AVG(reward_amount), 0) as average_amount
      FROM first_rewards
    `;
    const result = await client.query(query);
    return {
      total_rewards: parseInt(result.rows[0].total_rewards),
      total_amount: parseFloat(result.rows[0].total_amount),
      average_amount: parseFloat(result.rows[0].average_amount),
    };
  }

  /**
   * Get users eligible for first reward (made first recharge but not received reward)
   * Admin helper function
   */
  static async getEligibleUsers(limit = 50, offset = 0, client = pool) {
    const query = `
      SELECT DISTINCT
        u.id as user_id,
        u.email,
        u.phone,
        r.referred_by,
        ref_user.email as referrer_email,
        rr.created_at as first_recharge_date,
        rr.amount as recharge_amount
      FROM users u
      JOIN referrals r ON u.id = r.user_id
      JOIN recharge_requests rr ON u.id = rr.user_id
      LEFT JOIN users ref_user ON r.referred_by = ref_user.id
      LEFT JOIN first_rewards fr ON u.id = fr.user_id
      WHERE r.referred_by IS NOT NULL
        AND rr.status = 'approved'
        AND fr.id IS NULL
      ORDER BY rr.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Check if user is eligible for first reward
   */
  static async isEligible(userId, client = pool) {
    const query = `
      SELECT 1
      FROM users u
      JOIN referrals r ON u.id = r.user_id
      LEFT JOIN first_rewards fr ON u.id = fr.user_id
      WHERE u.id = $1
        AND r.referred_by IS NOT NULL
        AND fr.id IS NULL
      LIMIT 1
    `;
    const result = await client.query(query, [userId]);
    return result.rows.length > 0;
  }

  /**
   * Get count of eligible users
   */
  static async getEligibleCount(client = pool) {
    const query = `
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN referrals r ON u.id = r.user_id
      JOIN recharge_requests rr ON u.id = rr.user_id
      LEFT JOIN first_rewards fr ON u.id = fr.user_id
      WHERE r.referred_by IS NOT NULL
        AND rr.status = 'approved'
        AND fr.id IS NULL
    `;
    const result = await client.query(query);
    return parseInt(result.rows[0].count);
  }
}

module.exports = FirstReward;
