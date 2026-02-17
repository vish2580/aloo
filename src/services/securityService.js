const pool = require("../config/database");

/**
 * SECURITY SERVICE
 * ============================================================
 * Handles fraud detection, security flags, and risk analysis
 * ============================================================
 */

class SecurityService {
  /**
   * Detect and flag suspicious users based on multiple criteria
   * @param {UUID} userId - User to analyze
   * @returns {Object} - Detection results with flags created
   */
  static async detectSuspiciousActivity(userId) {
    const flags = [];

    try {
      // Run all detection checks in parallel
      const [
        sameIpUsers,
        sameDeviceUsers,
        samePhoneUsers,
        fastRecharge,
        referralAbuse,
        suspiciousPattern,
      ] = await Promise.all([
        this.checkSameIP(userId),
        this.checkSameDevice(userId),
        this.checkSamePhone(userId),
        this.checkFastSignupRecharge(userId),
        this.checkReferralAbuse(userId),
        this.checkSuspiciousPattern(userId),
      ]);

      // Create flags based on detection results
      if (sameIpUsers.length > 0) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "same_ip",
          severity: sameIpUsers.length > 3 ? "critical" : "high",
          description: `User shares IP with ${sameIpUsers.length} other accounts`,
          metadata: { related_users: sameIpUsers },
          related_user_ids: sameIpUsers,
        });
        flags.push(flag);
      }

      if (sameDeviceUsers.length > 0) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "same_device",
          severity: sameDeviceUsers.length > 2 ? "critical" : "high",
          description: `User shares device with ${sameDeviceUsers.length} other accounts`,
          metadata: { related_users: sameDeviceUsers },
          related_user_ids: sameDeviceUsers,
        });
        flags.push(flag);
      }

      if (samePhoneUsers.length > 0) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "same_phone",
          severity: "critical",
          description: `User shares phone number with ${samePhoneUsers.length} other accounts`,
          metadata: { related_users: samePhoneUsers },
          related_user_ids: samePhoneUsers,
        });
        flags.push(flag);
      }

      if (fastRecharge.detected) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "fast_signup_recharge",
          severity: "medium",
          description: `User deposited within ${fastRecharge.minutes} minutes of signup`,
          metadata: { signup_to_deposit_minutes: fastRecharge.minutes },
        });
        flags.push(flag);
      }

      if (referralAbuse.detected) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "referral_abuse",
          severity: "high",
          description: referralAbuse.description,
          metadata: referralAbuse.data,
        });
        flags.push(flag);
      }

      if (suspiciousPattern.detected) {
        const flag = await this.createSecurityFlag({
          user_id: userId,
          flag_type: "suspicious_pattern",
          severity: "medium",
          description: suspiciousPattern.description,
          metadata: suspiciousPattern.data,
        });
        flags.push(flag);
      }

      // Update user risk level
      await this.updateUserRiskLevel(userId);

      return {
        success: true,
        flags_created: flags.length,
        flags,
      };
    } catch (error) {
      console.error("[SecurityService] Detection error:", error);
      throw error;
    }
  }

  /**
   * Check for users sharing the same IP address
   */
  static async checkSameIP(userId) {
    try {
      const result = await pool.query(
        `
        SELECT u2.id
        FROM users u1
        JOIN users u2 ON u1.signup_ip = u2.signup_ip
        WHERE u1.id = $1
        AND u2.id != $1
        AND u1.signup_ip IS NOT NULL
        AND u1.signup_ip != ''
      `,
        [userId]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      console.error("[SecurityService] checkSameIP error:", error);
      return [];
    }
  }

  /**
   * Check for users sharing the same device ID
   */
  static async checkSameDevice(userId) {
    try {
      const result = await pool.query(
        `
        SELECT u2.id
        FROM users u1
        JOIN users u2 ON u1.device_id = u2.device_id
        WHERE u1.id = $1
        AND u2.id != $1
        AND u1.device_id IS NOT NULL
        AND u1.device_id != ''
      `,
        [userId]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      console.error("[SecurityService] checkSameDevice error:", error);
      return [];
    }
  }

  /**
   * Check for users sharing the same phone number
   */
  static async checkSamePhone(userId) {
    try {
      const result = await pool.query(
        `
        SELECT u2.id
        FROM users u1
        JOIN users u2 ON u1.phone = u2.phone
        WHERE u1.id = $1
        AND u2.id != $1
        AND u1.phone IS NOT NULL
        AND u1.phone != ''
      `,
        [userId]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      console.error("[SecurityService] checkSamePhone error:", error);
      return [];
    }
  }

  /**
   * Check if user deposited too quickly after signup (< 5 minutes = suspicious)
   */
  static async checkFastSignupRecharge(userId) {
    try {
      const result = await pool.query(
        `
        SELECT
          u.created_at,
          t.created_at as first_deposit_at,
          EXTRACT(EPOCH FROM (t.created_at - u.created_at)) / 60 as minutes_diff
        FROM users u
        JOIN transactions t ON t.user_id = u.id
        WHERE u.id = $1
        AND t.type = 'deposit'
        AND t.status = 'completed'
        ORDER BY t.created_at ASC
        LIMIT 1
      `,
        [userId]
      );

      if (result.rows.length === 0) {
        return { detected: false };
      }

      const minutesDiff = parseFloat(result.rows[0].minutes_diff);

      if (minutesDiff < 5) {
        return {
          detected: true,
          minutes: minutesDiff.toFixed(2),
        };
      }

      return { detected: false };
    } catch (error) {
      console.error("[SecurityService] checkFastSignupRecharge error:", error);
      return { detected: false };
    }
  }

  /**
   * Check for referral abuse patterns
   */
  static async checkReferralAbuse(userId) {
    try {
      // Check if user is a referrer
      const referralStats = await pool.query(
        `
        SELECT
          COUNT(DISTINCT r.user_id) as total_referrals,
          COUNT(DISTINCT CASE WHEN u2.signup_ip = u1.signup_ip THEN r.user_id END) as same_ip_referrals,
          COUNT(DISTINCT CASE WHEN u2.device_id = u1.device_id THEN r.user_id END) as same_device_referrals
        FROM referrals r
        JOIN users u1 ON r.referred_by = u1.id
        JOIN users u2 ON r.user_id = u2.id
        WHERE r.referred_by = $1
      `,
        [userId]
      );

      if (referralStats.rows.length === 0) {
        return { detected: false };
      }

      const stats = referralStats.rows[0];
      const totalReferrals = parseInt(stats.total_referrals);
      const sameIpReferrals = parseInt(stats.same_ip_referrals);
      const sameDeviceReferrals = parseInt(stats.same_device_referrals);

      // Flag if more than 30% of referrals share same IP/device
      const suspiciousRatio = totalReferrals > 0
        ? (sameIpReferrals + sameDeviceReferrals) / totalReferrals
        : 0;

      if (suspiciousRatio > 0.3 && totalReferrals >= 3) {
        return {
          detected: true,
          description: `${Math.round(suspiciousRatio * 100)}% of referrals share same IP/device`,
          data: {
            total_referrals: totalReferrals,
            same_ip_referrals: sameIpReferrals,
            same_device_referrals: sameDeviceReferrals,
            suspicious_ratio: suspiciousRatio,
          },
        };
      }

      return { detected: false };
    } catch (error) {
      console.error("[SecurityService] checkReferralAbuse error:", error);
      return { detected: false };
    }
  }

  /**
   * Check for suspicious betting patterns
   */
  static async checkSuspiciousPattern(userId) {
    try {
      // Check win rate and unusual patterns
      const stats = await pool.query(
        `
        SELECT
          COUNT(*) as total_bets,
          COUNT(*) FILTER (WHERE result = 'win') as wins,
          COALESCE(SUM(amount) FILTER (WHERE result = 'win'), 0) as total_winnings,
          COALESCE(SUM(amount), 0) as total_wagered
        FROM bets
        WHERE user_id = $1
      `,
        [userId]
      );

      if (stats.rows.length === 0 || parseInt(stats.rows[0].total_bets) < 10) {
        return { detected: false };
      }

      const data = stats.rows[0];
      const winRate = parseInt(data.wins) / parseInt(data.total_bets);
      const profitRatio = parseFloat(data.total_winnings) / parseFloat(data.total_wagered);

      // Flag if win rate > 70% or profit ratio > 2x (unusual)
      if (winRate > 0.7 || profitRatio > 2) {
        return {
          detected: true,
          description: `Unusual betting pattern: ${Math.round(winRate * 100)}% win rate`,
          data: {
            total_bets: parseInt(data.total_bets),
            win_rate: winRate,
            profit_ratio: profitRatio,
          },
        };
      }

      return { detected: false };
    } catch (error) {
      console.error("[SecurityService] checkSuspiciousPattern error:", error);
      return { detected: false };
    }
  }

  /**
   * Create a security flag
   */
  static async createSecurityFlag(flagData) {
    try {
      // Check if similar flag already exists (not resolved)
      const existingFlag = await pool.query(
        `
        SELECT id FROM security_flags
        WHERE user_id = $1
        AND flag_type = $2
        AND is_resolved = false
      `,
        [flagData.user_id, flagData.flag_type]
      );

      // Don't create duplicate flags
      if (existingFlag.rows.length > 0) {
        return existingFlag.rows[0];
      }

      const result = await pool.query(
        `
        INSERT INTO security_flags (
          user_id,
          flag_type,
          severity,
          description,
          metadata,
          related_user_ids
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
        [
          flagData.user_id,
          flagData.flag_type,
          flagData.severity,
          flagData.description,
          JSON.stringify(flagData.metadata || {}),
          flagData.related_user_ids || [],
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error("[SecurityService] createSecurityFlag error:", error);
      throw error;
    }
  }

  /**
   * Update user risk level based on flags and patterns
   */
  static async updateUserRiskLevel(userId) {
    try {
      await pool.query("SELECT update_user_risk_level($1)", [userId]);
    } catch (error) {
      console.error("[SecurityService] updateUserRiskLevel error:", error);
    }
  }

  /**
   * Get all flagged users with details
   */
  static async getFlaggedUsers(filters = {}) {
    try {
      let whereConditions = ["sf.is_resolved = false"];
      let params = [];
      let paramCount = 0;

      if (filters.severity) {
        paramCount++;
        whereConditions.push(`sf.severity = $${paramCount}`);
        params.push(filters.severity);
      }

      if (filters.flag_type) {
        paramCount++;
        whereConditions.push(`sf.flag_type = $${paramCount}`);
        params.push(filters.flag_type);
      }

      if (filters.risk_level) {
        paramCount++;
        whereConditions.push(`u.risk_level = $${paramCount}`);
        params.push(filters.risk_level);
      }

      const query = `
        SELECT
          u.id,
          u.email,
          u.risk_score,
          u.risk_level,
          u.is_banned,
          u.created_at,
          w.balance,
          COUNT(DISTINCT sf.id) as flag_count,
          ARRAY_AGG(DISTINCT sf.flag_type) as flag_types,
          MAX(sf.severity) as highest_severity
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        JOIN security_flags sf ON sf.user_id = u.id
        WHERE ${whereConditions.join(" AND ")}
        GROUP BY u.id, w.balance
        ORDER BY u.risk_score DESC, sf.created_at DESC
        LIMIT ${filters.limit || 100}
        OFFSET ${filters.offset || 0}
      `;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("[SecurityService] getFlaggedUsers error:", error);
      throw error;
    }
  }

  /**
   * Get flag details for a specific user
   */
  static async getUserFlags(userId) {
    try {
      const result = await pool.query(
        `
        SELECT
          sf.*,
          u.email as resolved_by_email
        FROM security_flags sf
        LEFT JOIN users u ON sf.resolved_by = u.id
        WHERE sf.user_id = $1
        ORDER BY sf.is_resolved ASC, sf.created_at DESC
      `,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error("[SecurityService] getUserFlags error:", error);
      throw error;
    }
  }

  /**
   * Resolve a security flag
   */
  static async resolveFlag(flagId, adminId, resolutionNotes) {
    try {
      const result = await pool.query(
        `
        UPDATE security_flags
        SET is_resolved = true,
            resolved_by = $2,
            resolved_at = CURRENT_TIMESTAMP,
            resolution_notes = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
        [flagId, adminId, resolutionNotes]
      );

      // Update user risk level after resolving flag
      if (result.rows.length > 0) {
        await this.updateUserRiskLevel(result.rows[0].user_id);
      }

      return result.rows[0];
    } catch (error) {
      console.error("[SecurityService] resolveFlag error:", error);
      throw error;
    }
  }

  /**
   * Get security overview stats
   */
  static async getSecurityStats() {
    try {
      const stats = await pool.query(`
        SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE is_resolved = false) as flagged_users,
          COUNT(*) FILTER (WHERE is_resolved = false AND severity = 'critical') as critical_flags,
          COUNT(*) FILTER (WHERE is_resolved = false AND severity = 'high') as high_flags,
          COUNT(*) FILTER (WHERE is_resolved = false AND severity = 'medium') as medium_flags,
          COUNT(*) FILTER (WHERE is_resolved = false AND flag_type = 'same_ip') as same_ip_flags,
          COUNT(*) FILTER (WHERE is_resolved = false AND flag_type = 'same_device') as same_device_flags,
          COUNT(*) FILTER (WHERE is_resolved = false AND flag_type = 'referral_abuse') as referral_abuse_flags
        FROM security_flags
      `);

      const riskStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE risk_level = 'red') as red_users,
          COUNT(*) FILTER (WHERE risk_level = 'yellow') as yellow_users,
          COUNT(*) FILTER (WHERE risk_level = 'green') as green_users
        FROM users
      `);

      return {
        flags: stats.rows[0],
        risk_distribution: riskStats.rows[0],
      };
    } catch (error) {
      console.error("[SecurityService] getSecurityStats error:", error);
      throw error;
    }
  }
}

module.exports = SecurityService;
