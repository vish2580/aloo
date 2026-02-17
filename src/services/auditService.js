const pool = require("../config/database");

/**
 * AUDIT SERVICE
 * ============================================================
 * Logs all admin actions to admin_actions table
 * Every destructive action MUST be logged
 * ============================================================
 */

class AuditService {
  /**
   * Log admin action to admin_actions table
   * @param {Object} params
   * @param {UUID} params.adminId - Admin performing the action
   * @param {string} params.actionType - Type of action (user_ban, balance_adjust, etc.)
   * @param {UUID} params.targetUserId - User being affected (optional)
   * @param {string} params.targetEntityType - Type of entity (user, withdrawal, etc.)
   * @param {string} params.targetEntityId - ID of entity being affected
   * @param {Object} params.actionData - Additional data about the action
   * @param {string} params.reason - Reason for the action
   * @param {Object} params.req - Express request object for IP/user-agent
   */
  static async logAdminAction({
    adminId,
    actionType,
    targetUserId = null,
    targetEntityType = null,
    targetEntityId = null,
    actionData = {},
    reason = null,
    req = null,
  }) {
    try {
      const ipAddress = req
        ? req.headers["x-forwarded-for"] || req.connection.remoteAddress
        : null;
      const userAgent = req ? req.headers["user-agent"] : null;

      const result = await pool.query(
        `
        INSERT INTO admin_actions (
          admin_id,
          action_type,
          target_user_id,
          target_entity_type,
          target_entity_id,
          action_data,
          reason,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
        [
          adminId,
          actionType,
          targetUserId,
          targetEntityType,
          targetEntityId,
          JSON.stringify(actionData),
          reason,
          ipAddress,
          userAgent,
        ],
      );

      console.log(
        `[AUDIT] Admin ${adminId} performed ${actionType} on ${targetEntityType} ${targetEntityId}`,
      );
      return result.rows[0];
    } catch (error) {
      console.error("[AuditService] logAdminAction error:", error);
      // Don't throw - audit failures shouldn't break the main action
    }
  }

  /**
   * Get admin action history
   * @param {Object} filters - Filter criteria
   * @returns {Array} - List of admin actions
   */
  static async getAdminActionHistory(filters = {}) {
    try {
      let whereConditions = [];
      let params = [];
      let paramCount = 0;

      if (filters.adminId) {
        paramCount++;
        whereConditions.push(`aa.admin_id = $${paramCount}`);
        params.push(filters.adminId);
      }

      if (filters.actionType) {
        paramCount++;
        whereConditions.push(`aa.action_type = $${paramCount}`);
        params.push(filters.actionType);
      }

      if (filters.targetUserId) {
        paramCount++;
        whereConditions.push(`aa.target_user_id = $${paramCount}`);
        params.push(filters.targetUserId);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const query = `
        SELECT
          aa.*,
          u.email as admin_email,
          tu.email as target_user_email
        FROM admin_actions aa
        JOIN users u ON aa.admin_id = u.id
        LEFT JOIN users tu ON aa.target_user_id = tu.id
        ${whereClause}
        ORDER BY aa.created_at DESC
        LIMIT ${filters.limit || 100}
        OFFSET ${filters.offset || 0}
      `;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("[AuditService] getAdminActionHistory error:", error);
      throw error;
    }
  }

  /**
   * Get recent admin activity for dashboard
   */
  static async getRecentActivity(limit = 10) {
    try {
      const result = await pool.query(
        `
        SELECT
          aa.action_type,
          aa.target_entity_type,
          aa.target_entity_id,
          aa.reason,
          aa.created_at,
          u.email as admin_email
        FROM admin_actions aa
        JOIN users u ON aa.admin_id = u.id
        ORDER BY aa.created_at DESC
        LIMIT $1
      `,
        [limit],
      );

      return result.rows;
    } catch (error) {
      console.error("[AuditService] getRecentActivity error:", error);
      return [];
    }
  }

  /**
   * Get admin action statistics
   */
  static async getAdminStats(adminId, days = 30) {
    try {
      const result = await pool.query(
        `
        SELECT
          COUNT(*) as total_actions,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(*) FILTER (WHERE action_type = 'user_ban') as bans,
          COUNT(*) FILTER (WHERE action_type = 'user_unban') as unbans,
          COUNT(*) FILTER (WHERE action_type = 'balance_adjust') as balance_adjustments,
          COUNT(*) FILTER (WHERE action_type = 'withdrawal_approve') as approvals,
          COUNT(*) FILTER (WHERE action_type = 'withdrawal_reject') as rejections
        FROM admin_actions
        WHERE admin_id = $1
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      `,
        [adminId],
      );

      return result.rows[0];
    } catch (error) {
      console.error("[AuditService] getAdminStats error:", error);
      throw error;
    }
  }
}

module.exports = AuditService;
