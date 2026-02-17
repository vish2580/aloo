const pool = require("../config/database");

/**
 * Referral Model - Clean 3-Level Referral System
 *
 * RULES:
 * - Only 3 levels supported (Level 1, 2, 3)
 * - Each user can only have ONE referrer
 * - Referral code must be unique
 * - Levels are calculated dynamically based on referral chain
 */
class Referral {
  /**
   * Create referral entry for new user
   */
  static async create(
    { userId, referralCode, referredBy = null },
    client = pool,
  ) {
    const query = `
      INSERT INTO referrals (user_id, referral_code, referred_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await client.query(query, [
      userId,
      referralCode,
      referredBy,
    ]);
    return result.rows[0];
  }

  /**
   * Get referral info by user ID
   */
  static async getByUserId(userId, client = pool) {
    const query = "SELECT * FROM referrals WHERE user_id = $1";
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get referral info by referral code
   */
  static async getByCode(code, client = pool) {
    const query = "SELECT * FROM referrals WHERE referral_code = $1";
    const result = await client.query(query, [code]);
    return result.rows[0];
  }

  /**
   * Get Level 1 users (direct referrals)
   */
  static async getLevel1Users(userId, client = pool) {
    const query = `
      SELECT
        r.user_id,
        u.email,
        u.phone,
        r.referral_code,
        r.created_at
      FROM referrals r
      JOIN users u ON r.user_id = u.id
      WHERE r.referred_by = $1
      ORDER BY r.created_at DESC
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get Level 2 users (referrals of Level 1)
   */
  static async getLevel2Users(userId, client = pool) {
    const query = `
      SELECT
        r2.user_id,
        u2.email,
        u2.phone,
        r2.referral_code,
        r2.created_at
      FROM referrals r1
      JOIN referrals r2 ON r1.user_id = r2.referred_by
      JOIN users u2 ON r2.user_id = u2.id
      WHERE r1.referred_by = $1
      ORDER BY r2.created_at DESC
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get Level 3 users (referrals of Level 2)
   */
  static async getLevel3Users(userId, client = pool) {
    const query = `
      SELECT
        r3.user_id,
        u3.email,
        u3.phone,
        r3.referral_code,
        r3.created_at
      FROM referrals r1
      JOIN referrals r2 ON r1.user_id = r2.referred_by
      JOIN referrals r3 ON r2.user_id = r3.referred_by
      JOIN users u3 ON r3.user_id = u3.id
      WHERE r1.referred_by = $1
      ORDER BY r3.created_at DESC
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get count by level
   */
  static async getCountByLevel(userId, level, client = pool) {
    if (level === 1) {
      const query = `
        SELECT COUNT(*) as count
        FROM referrals
        WHERE referred_by = $1
      `;
      const result = await client.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } else if (level === 2) {
      const query = `
        SELECT COUNT(*) as count
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        WHERE r1.referred_by = $1
      `;
      const result = await client.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } else if (level === 3) {
      const query = `
        SELECT COUNT(*) as count
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        JOIN referrals r3 ON r2.user_id = r3.referred_by
        WHERE r1.referred_by = $1
      `;
      const result = await client.query(query, [userId]);
      return parseInt(result.rows[0].count);
    }
    return 0;
  }

  /**
   * Get total people invited across all levels (L1 + L2 + L3)
   */
  static async getTotalInvited(userId, client = pool) {
    const l1 = await this.getCountByLevel(userId, 1, client);
    const l2 = await this.getCountByLevel(userId, 2, client);
    const l3 = await this.getCountByLevel(userId, 3, client);
    return l1 + l2 + l3;
  }

  /**
   * Get all downline user IDs (L1 + L2 + L3)
   */
  static async getAllDownlineUserIds(userId, client = pool) {
    const query = `
      SELECT DISTINCT user_id FROM (
        -- Level 1
        SELECT r1.user_id
        FROM referrals r1
        WHERE r1.referred_by = $1

        UNION

        -- Level 2
        SELECT r2.user_id
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        WHERE r1.referred_by = $1

        UNION

        -- Level 3
        SELECT r3.user_id
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        JOIN referrals r3 ON r2.user_id = r3.referred_by
        WHERE r1.referred_by = $1
      ) downline
    `;
    const result = await client.query(query, [userId]);
    return result.rows.map((row) => row.user_id);
  }

  /**
   * Get total bet contribution from all downline users
   */
  static async getTotalContribution(userId, client = pool) {
    const query = `
      SELECT COALESCE(SUM(b.amount), 0) as total
      FROM bets b
      WHERE b.user_id IN (
        -- Level 1
        SELECT r1.user_id
        FROM referrals r1
        WHERE r1.referred_by = $1

        UNION

        -- Level 2
        SELECT r2.user_id
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        WHERE r1.referred_by = $1

        UNION

        -- Level 3
        SELECT r3.user_id
        FROM referrals r1
        JOIN referrals r2 ON r1.user_id = r2.referred_by
        JOIN referrals r3 ON r2.user_id = r3.referred_by
        WHERE r1.referred_by = $1
      )
    `;
    const result = await client.query(query, [userId]);
    return parseFloat(result.rows[0].total);
  }

  /**
   * Get bet contribution from a specific user
   */
  static async getContributionByUser(sourceUserId, client = pool) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bets
      WHERE user_id = $1
    `;
    const result = await client.query(query, [sourceUserId]);
    return parseFloat(result.rows[0].total);
  }

  /**
   * Get referrer chain (who invited this user up to 3 levels)
   */
  static async getReferrerChain(userId, client = pool) {
    const chain = [];

    // Level 1 referrer
    const l1Query = `
      SELECT referred_by FROM referrals WHERE user_id = $1
    `;
    const l1Result = await client.query(l1Query, [userId]);

    if (l1Result.rows.length === 0 || !l1Result.rows[0].referred_by) {
      return chain;
    }

    const level1 = l1Result.rows[0].referred_by;
    chain.push({ level: 1, user_id: level1 });

    // Level 2 referrer
    const l2Result = await client.query(l1Query, [level1]);
    if (l2Result.rows.length === 0 || !l2Result.rows[0].referred_by) {
      return chain;
    }

    const level2 = l2Result.rows[0].referred_by;
    chain.push({ level: 2, user_id: level2 });

    // Level 3 referrer
    const l3Result = await client.query(l1Query, [level2]);
    if (l3Result.rows.length === 0 || !l3Result.rows[0].referred_by) {
      return chain;
    }

    const level3 = l3Result.rows[0].referred_by;
    chain.push({ level: 3, user_id: level3 });

    return chain;
  }

  /**
   * Check if user has referral entry
   */
  static async exists(userId, client = pool) {
    const query = "SELECT 1 FROM referrals WHERE user_id = $1";
    const result = await client.query(query, [userId]);
    return result.rows.length > 0;
  }

  /**
   * Get all referrals (admin only)
   */
  static async getAll(limit = 100, offset = 0, client = pool) {
    const query = `
      SELECT
        r.*,
        u.email,
        u.phone,
        ref_by.email as referred_by_email
      FROM referrals r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users ref_by ON r.referred_by = ref_by.id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  }
}

module.exports = Referral;
