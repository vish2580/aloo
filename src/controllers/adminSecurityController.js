const pool = require("../config/database");
const AuditService = require("../services/auditService");
const SecurityService = require("../services/securityService");

/**
 * ADMIN SECURITY CONTROLLER
 * ============================================================
 * Handles security flags, fraud detection, and risk management
 * READ → ANALYZE → DECIDE → ACT flow
 * ============================================================
 */

class AdminSecurityController {
  /**
   * GET /api/admin/security/flags
   * Get list of all flagged users with security issues
   */
  static async getFlaggedUsers(req, res, next) {
    try {
      const {
        severity,
        flag_type,
        risk_level,
        limit = 50,
        offset = 0,
      } = req.query;

      // Check if security_flags table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'security_flags'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        return res.json({
          success: true,
          data: {
            flagged_users: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        });
      }

      const filters = {
        severity,
        flag_type,
        risk_level,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const flaggedUsers = await SecurityService.getFlaggedUsers(filters);

      // Get total count
      let whereConditions = ["sf.is_resolved = false"];
      let params = [];
      let paramCount = 0;

      if (severity) {
        paramCount++;
        whereConditions.push(`sf.severity = $${paramCount}`);
        params.push(severity);
      }

      if (flag_type) {
        paramCount++;
        whereConditions.push(`sf.flag_type = $${paramCount}`);
        params.push(flag_type);
      }

      if (risk_level) {
        paramCount++;
        whereConditions.push(`u.risk_level = $${paramCount}`);
        params.push(risk_level);
      }

      const countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        JOIN security_flags sf ON sf.user_id = u.id
        WHERE ${whereConditions.join(" AND ")}
      `;

      const countResult = await pool.query(countQuery, params);

      res.json({
        success: true,
        data: {
          flagged_users: flaggedUsers,
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      console.error('[ADMIN SECURITY] Error in getFlaggedUsers:', error);
      res.json({
        success: true,
        data: {
          flagged_users: [],
          total: 0,
          limit: parseInt(limit || 50),
          offset: parseInt(offset || 0),
        },
      });
    }
  }

  /**
   * GET /api/admin/security/users/:userId/flags
   * Get detailed security analysis for specific user
   */
  static async getUserSecurityDetails(req, res, next) {
    try {
      const { userId } = req.params;

      // Get user basic info
      const userResult = await pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.risk_level,
          u.risk_score,
          u.is_banned,
          u.ban_reason,
          u.signup_ip,
          u.last_login_ip,
          u.device_id,
          u.phone,
          u.created_at,
          u.last_login_at,
          u.main_balance as balance,
          false as wallet_held
        FROM users u
        WHERE u.id = $1
      `,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = userResult.rows[0];

      // Get all security flags for this user
      const flags = await SecurityService.getUserFlags(userId);

      // Get related users (same IP, device, phone)
      const relatedUsersResult = await pool.query(
        `
        SELECT DISTINCT
          u.id,
          u.email,
          u.risk_level,
          u.is_banned,
          u.created_at,
          CASE
            WHEN u.signup_ip = $2 THEN 'same_ip'
            WHEN u.device_id = $3 THEN 'same_device'
            WHEN u.phone = $4 THEN 'same_phone'
          END as relation_type
        FROM users u
        WHERE u.id != $1
        AND (
          (u.signup_ip = $2 AND $2 IS NOT NULL)
          OR (u.device_id = $3 AND $3 IS NOT NULL)
          OR (u.phone = $4 AND $4 IS NOT NULL)
        )
        ORDER BY u.created_at DESC
        LIMIT 20
      `,
        [userId, user.signup_ip, user.device_id, user.phone]
      );

      // Get user activity stats
      const activityResult = await pool.query(
        `
        SELECT
          COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = $1 AND type = 'deposit' AND status = 'completed'), 0) as total_deposits,
          COALESCE((SELECT SUM(amount) FROM withdrawals WHERE user_id = $1 AND status = 'approved'), 0) as total_withdrawals,
          COALESCE((SELECT SUM(amount) FROM bets WHERE user_id = $1), 0) as total_bets,
          COALESCE((SELECT COUNT(*) FROM bets WHERE user_id = $1), 0) as bet_count,
          COALESCE((SELECT COUNT(*) FILTER (WHERE result = 'win') FROM bets WHERE user_id = $1), 0) as win_count,
          (SELECT created_at FROM transactions WHERE user_id = $1 AND type = 'deposit' ORDER BY created_at ASC LIMIT 1) as first_deposit_at,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM transactions WHERE user_id = $1 AND type = 'deposit') - $2
          )) / 60 as signup_to_deposit_minutes
      `,
        [userId, user.created_at]
      );

      const activity = activityResult.rows[0];

      // Calculate win rate
      const betCount = parseInt(activity.bet_count);
      const winCount = parseInt(activity.win_count);
      const winRate = betCount > 0 ? (winCount / betCount) * 100 : 0;

      // Get referral info if user is inviter
      const referralResult = await pool.query(
        `
        SELECT
          COUNT(*) as team_count,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(amount), 0)
             FROM commissions
             WHERE user_id = $1
             AND from_user_id = r.user_id)
          ), 0) as total_commission
        FROM referrals r
        WHERE r.referred_by = $1
      `,
        [userId]
      );

      const referralInfo = referralResult.rows[0];

      res.json({
        success: true,
        data: {
          user,
          security_flags: flags,
          related_users: relatedUsersResult.rows,
          activity: {
            ...activity,
            win_rate: winRate.toFixed(2),
          },
          referral_info: referralInfo,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/security/flags/:flagId/resolve
   * Resolve a security flag
   * Body: { resolution_notes: string }
   */
  static async resolveFlag(req, res, next) {
    try {
      const { flagId } = req.params;
      const { resolution_notes } = req.body;
      const adminId = req.admin.id;

      if (!resolution_notes || resolution_notes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Resolution notes are required",
        });
      }

      // Resolve the flag
      const resolvedFlag = await SecurityService.resolveFlag(
        flagId,
        adminId,
        resolution_notes
      );

      if (!resolvedFlag) {
        return res.status(404).json({
          success: false,
          message: "Flag not found",
        });
      }

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        actionType: "flag_resolve",
        targetUserId: resolvedFlag.user_id,
        targetEntityType: "security_flag",
        targetEntityId: flagId.toString(),
        actionData: {
          flag_type: resolvedFlag.flag_type,
          severity: resolvedFlag.severity,
        },
        reason: resolution_notes,
        req,
      });

      res.json({
        success: true,
        message: "Flag resolved successfully",
        data: resolvedFlag,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/security/users/:userId/analyze
   * Manually trigger security analysis for a user
   */
  static async analyzeUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.admin.id;

      // Check if user exists
      const userCheck = await pool.query(
        "SELECT id, email FROM users WHERE id = $1",
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Run security detection
      const detectionResult = await SecurityService.detectSuspiciousActivity(
        userId
      );

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        actionType: "security_analysis",
        targetUserId: userId,
        targetEntityType: "user",
        targetEntityId: userId,
        actionData: {
          flags_created: detectionResult.flags_created,
        },
        reason: "Manual security analysis triggered by admin",
        req,
      });

      res.json({
        success: true,
        message: `Security analysis complete. ${detectionResult.flags_created} flag(s) created.`,
        data: detectionResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/security/overview
   * Get security system overview and statistics
   */
  static async getSecurityOverview(req, res, next) {
    try {
      // Get security stats from service
      const securityStats = await SecurityService.getSecurityStats();

      // Get recent high-priority flags
      const recentFlagsResult = await pool.query(
        `
        SELECT
          sf.id,
          sf.flag_type,
          sf.severity,
          sf.description,
          sf.created_at,
          u.id as user_id,
          u.email as user_email,
          u.risk_level
        FROM security_flags sf
        JOIN users u ON sf.user_id = u.id
        WHERE sf.is_resolved = false
        AND sf.severity IN ('critical', 'high')
        ORDER BY
          CASE sf.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            ELSE 3
          END,
          sf.created_at DESC
        LIMIT 10
      `
      );

      // Get top risk users
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'security_flags'
        )
      `);

      let topRiskUsersResult;
      if (tableCheck.rows[0].exists) {
        topRiskUsersResult = await pool.query(
          `
          SELECT
            u.id,
            u.email,
            u.risk_score,
            u.risk_level,
            u.is_banned,
            u.main_balance as balance,
            COUNT(DISTINCT sf.id) FILTER (WHERE sf.is_resolved = false) as active_flags
          FROM users u
          LEFT JOIN security_flags sf ON sf.user_id = u.id
          WHERE u.risk_score > 0
          GROUP BY u.id
          ORDER BY u.risk_score DESC
          LIMIT 10
        `
        );
      } else {
        topRiskUsersResult = await pool.query(
          `
          SELECT
            u.id,
            u.email,
            u.risk_score,
            u.risk_level,
            u.is_banned,
            u.main_balance as balance,
            0 as active_flags
          FROM users u
          WHERE u.risk_score > 0
          ORDER BY u.risk_score DESC
          LIMIT 10
        `
        );
      }

      // Get flag resolution stats (last 30 days)
      const resolutionStatsResult = await pool.query(
        `
        SELECT
          COUNT(*) as total_resolved,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as resolved_last_7_days,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as resolved_last_30_days
        FROM security_flags
        WHERE is_resolved = true
      `
      );

      res.json({
        success: true,
        data: {
          stats: securityStats,
          recent_critical_flags: recentFlagsResult.rows,
          top_risk_users: topRiskUsersResult.rows,
          resolution_stats: resolutionStatsResult.rows[0],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/security/same-ip/:ip
   * Get all users sharing the same IP address
   */
  static async getUsersBySameIP(req, res, next) {
    try {
      const { ip } = req.params;

      if (!ip || ip === "null" || ip === "undefined") {
        return res.status(400).json({
          success: false,
          message: "Valid IP address required",
        });
      }

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.risk_level,
          u.risk_score,
          u.is_banned,
          u.created_at,
          u.signup_ip,
          u.last_login_ip,
          u.main_balance as balance,
          COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'completed'), 0) as total_deposits,
          COALESCE((SELECT COUNT(*) FROM referrals WHERE referred_by = u.id), 0) as referral_count
        FROM users u
        WHERE u.signup_ip = $1 OR u.last_login_ip = $1
        ORDER BY u.created_at DESC
      `,
        [ip]
      );

      res.json({
        success: true,
        data: {
          ip_address: ip,
          user_count: result.rows.length,
          users: result.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/security/same-device/:deviceId
   * Get all users sharing the same device ID
   */
  static async getUsersBySameDevice(req, res, next) {
    try {
      const { deviceId } = req.params;

      if (!deviceId || deviceId === "null" || deviceId === "undefined") {
        return res.status(400).json({
          success: false,
          message: "Valid device ID required",
        });
      }

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.risk_level,
          u.risk_score,
          u.is_banned,
          u.created_at,
          u.device_id,
          u.main_balance as balance,
          COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = u.id AND type = 'deposit' AND status = 'completed'), 0) as total_deposits,
          COALESCE((SELECT COUNT(*) FROM referrals WHERE referred_by = u.id), 0) as referral_count
        FROM users u
        WHERE u.device_id = $1
        ORDER BY u.created_at DESC
      `,
        [deviceId]
      );

      res.json({
        success: true,
        data: {
          device_id: deviceId,
          user_count: result.rows.length,
          users: result.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/security/batch-analyze
   * Run security analysis on all users (or filtered subset)
   * Body: { risk_level: 'red' | 'yellow' | 'all', limit: number }
   */
  static async batchAnalyze(req, res, next) {
    try {
      const { risk_level = "all", limit = 100 } = req.body;
      const adminId = req.admin.id;

      let whereClause = "";
      const params = [];

      if (risk_level !== "all") {
        whereClause = "WHERE risk_level = $1";
        params.push(risk_level);
      }

      // Get users to analyze
      const usersResult = await pool.query(
        `
        SELECT id FROM users
        ${whereClause}
        ORDER BY risk_score DESC
        LIMIT $${params.length + 1}
      `,
        [...params, limit]
      );

      const userIds = usersResult.rows.map((row) => row.id);
      let totalFlagsCreated = 0;

      // Analyze each user
      for (const userId of userIds) {
        try {
          const result = await SecurityService.detectSuspiciousActivity(userId);
          totalFlagsCreated += result.flags_created;
        } catch (error) {
          console.error(`Failed to analyze user ${userId}:`, error);
        }
      }

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        actionType: "batch_security_analysis",
        targetEntityType: "system",
        targetEntityId: "security",
        actionData: {
          users_analyzed: userIds.length,
          flags_created: totalFlagsCreated,
          risk_level_filter: risk_level,
        },
        reason: "Batch security analysis triggered by admin",
        req,
      });

      res.json({
        success: true,
        message: `Analyzed ${userIds.length} users. Created ${totalFlagsCreated} security flag(s).`,
        data: {
          users_analyzed: userIds.length,
          flags_created: totalFlagsCreated,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminSecurityController;
