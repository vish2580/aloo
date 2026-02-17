const pool = require("../config/database");
const AuditService = require("../services/auditService");
const SecurityService = require("../services/securityService");

/**
 * ADMIN REFERRAL CONTROLLER
 * ============================================================
 * Handles referral fraud detection and team management
 * All actions follow CONTROL > SAFETY > CLARITY principle
 * ============================================================
 */

class AdminReferralController {
  /**
   * GET /api/admin/referrals/list
   * Get list of all inviters with team stats and risk analysis
   * REBUILT FROM SCRATCH - Uses only verified schema columns
   */
  static async getReferralList(req, res, next) {
    try {
      const { search, limit = 50, offset = 0 } = req.query;

      let searchCondition = "";
      let params = [];

      if (search) {
        searchCondition = `AND (u.email ILIKE $3 OR u.id::text ILIKE $3)`;
        params = [limit, offset, `%${search}%`];
      } else {
        params = [limit, offset];
      }

      // Clean query using ONLY existing columns
      const query = `
        WITH team_stats AS (
          SELECT
            r.referred_by as inviter_id,
            COUNT(DISTINCT r.user_id) as team_count,
            COALESCE(SUM(
              (SELECT COALESCE(SUM(t.amount), 0)
               FROM transactions t
               WHERE t.user_id = r.user_id
               AND t.type = 'deposit'
               AND t.status = 'completed')
            ), 0) as total_team_recharge
          FROM referrals r
          WHERE r.referred_by IS NOT NULL
          GROUP BY r.referred_by
        ),
        commission_totals AS (
          SELECT
            user_id,
            COALESCE(SUM(amount), 0) as total_commission
          FROM commissions
          GROUP BY user_id
        )
        SELECT
          u.id as inviter_uid,
          u.email as inviter_email,
          u.is_banned,
          u.created_at,
          u.main_balance as inviter_balance,
          COALESCE(ts.team_count, 0) as team_count,
          COALESCE(ts.total_team_recharge, 0) as team_recharge,
          COALESCE(ct.total_commission, 0) as total_commission
        FROM users u
        INNER JOIN team_stats ts ON ts.inviter_id = u.id
        LEFT JOIN commission_totals ct ON ct.user_id = u.id
        WHERE ts.team_count > 0
        ${searchCondition}
        ORDER BY ts.team_count DESC, u.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT r.referred_by) as total
        FROM referrals r
        INNER JOIN users u ON r.referred_by = u.id
        WHERE r.referred_by IS NOT NULL
        ${searchCondition}
      `;

      const countParams = search ? [`%${search}%`] : [];
      const countResult = await pool.query(countQuery, countParams);

      // Return clean JSON response with safe defaults
      res.json({
        success: true,
        data: result.rows.map(row => ({
          inviter_uid: row.inviter_uid,
          inviter_email: row.inviter_email,
          is_banned: row.is_banned,
          created_at: row.created_at,
          inviter_balance: parseFloat(row.inviter_balance || 0),
          team_count: parseInt(row.team_count || 0),
          team_recharge: parseFloat(row.team_recharge || 0),
          total_commission: parseFloat(row.total_commission || 0),
          // Safe defaults for missing schema fields
          risk_level: 'Low',
          same_ip_count: 0,
          same_device_count: 0,
          active_flags: 0
        })),
        total: parseInt(countResult.rows[0]?.total || 0),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('[ADMIN REFERRAL] Error in getReferralList:', error);
      next(error);
    }
  }

  /**
   * GET /api/admin/referrals/:inviterId/details
   * Get detailed team breakdown for specific inviter
   * FIXED - Removed non-existent referral_level column
   */
  static async getReferralDetails(req, res, next) {
    try {
      const { inviterId } = req.params;

      // Get inviter summary
      const inviterResult = await pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.is_banned,
          u.ban_reason,
          u.created_at,
          u.main_balance as balance
        FROM users u
        WHERE u.id = $1
      `,
        [inviterId]
      );

      if (inviterResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Inviter not found",
        });
      }

      const inviter = inviterResult.rows[0];

      // Get team overview stats
      const teamStatsResult = await pool.query(
        `
        SELECT
          COUNT(DISTINCT r.user_id) as total_team_members,
          COUNT(DISTINCT r.user_id) FILTER (WHERE u.is_banned = true) as banned_members,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(t.amount), 0)
             FROM transactions t
             WHERE t.user_id = r.user_id
             AND t.type = 'deposit'
             AND t.status = 'completed')
          ), 0) as total_team_recharge,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(w.amount), 0)
             FROM withdrawals w
             WHERE w.user_id = r.user_id
             AND w.status = 'approved')
          ), 0) as total_team_withdrawal,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(b.amount), 0)
             FROM bets b
             WHERE b.user_id = r.user_id)
          ), 0) as total_team_bets
        FROM referrals r
        JOIN users u ON r.user_id = u.id
        WHERE r.referred_by = $1
      `,
        [inviterId]
      );

      const teamStats = teamStatsResult.rows[0];

      // Get total commission earned from this team
      const commissionResult = await pool.query(
        `
        SELECT COALESCE(SUM(amount), 0) as total_commission
        FROM commissions
        WHERE user_id = $1
        AND source_user_id IN (
          SELECT user_id FROM referrals WHERE referred_by = $1
        )
      `,
        [inviterId]
      );

      const totalCommission = parseFloat(
        commissionResult.rows[0].total_commission
      );

      // Get team members - REMOVED referral_level column
      const teamMembersResult = await pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.is_banned,
          u.created_at,
          u.main_balance as balance,
          COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE user_id = u.id
            AND type = 'deposit'
            AND status = 'completed'
          ), 0) as total_deposits,
          COALESCE((
            SELECT SUM(amount)
            FROM bets
            WHERE user_id = u.id
          ), 0) as total_bets,
          COALESCE((
            SELECT SUM(amount)
            FROM commissions
            WHERE user_id = $1
            AND source_user_id = u.id
          ), 0) as commission_given,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM transactions WHERE user_id = u.id AND type = 'deposit') - u.created_at
          )) / 60 as signup_to_deposit_minutes
        FROM referrals r
        JOIN users u ON r.user_id = u.id
        WHERE r.referred_by = $1
        ORDER BY u.created_at DESC
      `,
        [inviterId]
      );

      // Security flags table doesn't exist yet, return empty array
      const flagsResult = { rows: [] };

      res.json({
        success: true,
        data: {
          inviter: {
            ...inviter,
            risk_level: 'Low',  // Default until security system is implemented
            risk_score: 0,      // Default until security system is implemented
            total_commission: totalCommission,
          },
          team_overview: teamStats,
          team_members: teamMembersResult.rows.map(member => ({
            ...member,
            risk_level: 'Low',  // Default until security system is implemented
            risk_score: 0,      // Default until security system is implemented
            active_flags: 0     // Default until security_flags table exists
          })),
          security_flags: flagsResult.rows,
        },
      });
    } catch (error) {
      console.error('[ADMIN REFERRAL] Error in getReferralDetails:', error);
      next(error);
    }
  }

  /**
   * POST /api/admin/referrals/:inviterId/ban
   * Ban inviter and optionally entire team
   * Body: { scope: 'inviter' | 'team', reason: string, revokeBonus: boolean }
   */
  static async banReferralTeam(req, res, next) {
    const client = await pool.connect();

    try {
      const { inviterId } = req.params;
      const { scope, reason, revokeBonus = false } = req.body;
      const adminId = req.admin.id;

      // Validate scope
      if (!["inviter", "team"].includes(scope)) {
        return res.status(400).json({
          success: false,
          message: "Invalid scope. Must be 'inviter' or 'team'",
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Reason is required",
        });
      }

      await client.query("BEGIN");

      let affectedUserIds = [inviterId];
      let bannedCount = 0;

      // Get team member IDs if banning entire team
      if (scope === "team") {
        const teamResult = await client.query(
          "SELECT user_id FROM referrals WHERE referred_by = $1",
          [inviterId]
        );
        const teamUserIds = teamResult.rows.map((row) => row.user_id);
        affectedUserIds = [inviterId, ...teamUserIds];
      }

      // Ban all affected users
      for (const userId of affectedUserIds) {
        await client.query(
          `
          UPDATE users
          SET is_banned = true,
        banned_by = $1,
        banned_at = CURRENT_TIMESTAMP,
        ban_reason = $2,
        ban_scope = $3,
        updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          AND is_banned = false
        `,
          [adminId, reason, scope, userId]
        );

        bannedCount++;
      }

      // Revoke referral bonuses if requested
      let revokedAmount = 0;
      if (revokeBonus) {
        // Get total commission earned
        const commissionResult = await client.query(
          `
          SELECT COALESCE(SUM(amount), 0) as total
          FROM commissions
          WHERE user_id = $1
        `,
          [inviterId]
        );

        revokedAmount = parseFloat(commissionResult.rows[0].total);

        if (revokedAmount > 0) {
          // Deduct from inviter's balance
          await client.query(
            `
            UPDATE users
            SET main_balance = GREATEST(main_balance - $1, 0)
            WHERE id = $2
        `,
            [revokedAmount, inviterId]
          );

          // Create transaction record
          await client.query(
            `
            INSERT INTO transactions(user_id, type, amount, status, description)
      VALUES($1, 'commission_revoke', $2, 'completed', $3)
          `,
            [
              inviterId,
              -revokedAmount,
              `Referral bonus revoked by admin: ${reason} `,
            ]
          );
        }
      }

      await client.query("COMMIT");

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        actionType: scope === "team" ? "team_ban" : "user_ban",
        targetUserId: inviterId,
        targetEntityType: "referral",
        targetEntityId: inviterId,
        actionData: {
          scope,
          affected_users: affectedUserIds.length,
          revoked_bonus: revokeBonus,
          revoked_amount: revokedAmount,
        },
        reason,
        req,
      });

      res.json({
        success: true,
        message: `Successfully banned ${bannedCount} account(s)`,
        data: {
          banned_count: bannedCount,
          revoked_amount: revokedAmount,
          affected_user_ids: affectedUserIds,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/admin/referrals/:inviterId/unban
   * Unban inviter and optionally entire team
   */
  static async unbanReferralTeam(req, res, next) {
    const client = await pool.connect();

    try {
      const { inviterId } = req.params;
      const { scope, reason } = req.body;
      const adminId = req.admin.id;

      if (!["inviter", "team"].includes(scope)) {
        return res.status(400).json({
          success: false,
          message: "Invalid scope. Must be 'inviter' or 'team'",
        });
      }

      await client.query("BEGIN");

      let affectedUserIds = [inviterId];

      // Get team member IDs if unbanning entire team
      if (scope === "team") {
        const teamResult = await client.query(
          "SELECT user_id FROM referrals WHERE referred_by = $1",
          [inviterId]
        );
        const teamUserIds = teamResult.rows.map((row) => row.user_id);
        affectedUserIds = [inviterId, ...teamUserIds];
      }

      let unbannedCount = 0;

      // Unban all affected users
      for (const userId of affectedUserIds) {
        await client.query(
          `
          UPDATE users
          SET is_banned = false,
        banned_by = NULL,
        banned_at = NULL,
        ban_reason = NULL,
        ban_scope = NULL,
        updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          AND is_banned = true
        `,
          [userId]
        );

        unbannedCount++;

        // Unhold wallet
        await client.query(
          `
          UPDATE wallets
          SET is_held = false,
        held_by = NULL,
        held_at = NULL,
        hold_reason = NULL
          WHERE user_id = $1
        `,
          [userId]
        );
      }

      await client.query("COMMIT");

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        actionType: "user_unban",
        targetUserId: inviterId,
        targetEntityType: "referral",
        targetEntityId: inviterId,
        actionData: {
          scope,
          affected_users: affectedUserIds.length,
        },
        reason: reason || "Unbanned by admin",
        req,
      });

      res.json({
        success: true,
        message: `Successfully unbanned ${unbannedCount} account(s)`,
        data: {
          unbanned_count: unbannedCount,
          affected_user_ids: affectedUserIds,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/admin/referrals/stats
   * Get referral system overview stats
   */
  static async getReferralStats(req, res, next) {
    try {
      const stats = await pool.query(`
      SELECT
      COUNT(DISTINCT referred_by) as total_inviters,
        COUNT(*) as total_referrals,
        COUNT(*) FILTER(WHERE referral_level = 1) as level_1_count,
          COUNT(*) FILTER(WHERE referral_level = 2) as level_2_count,
            COUNT(*) FILTER(WHERE referral_level = 3) as level_3_count,
              COALESCE((
                SELECT SUM(amount)
            FROM commissions
              ), 0) as total_commission_paid,
                COALESCE((
                  SELECT COUNT(DISTINCT user_id)
            FROM commissions
                ), 0) as active_earners
        FROM referrals
        WHERE referred_by IS NOT NULL
        `);

      const riskStats = await pool.query(`
      SELECT
      COUNT(*) FILTER(WHERE risk_level = 'red') as red_inviters,
        COUNT(*) FILTER(WHERE risk_level = 'yellow') as yellow_inviters,
          COUNT(*) FILTER(WHERE risk_level = 'green') as green_inviters
        FROM users
        WHERE id IN(SELECT DISTINCT referred_by FROM referrals WHERE referred_by IS NOT NULL)
        `);

      res.json({
        success: true,
        data: {
          ...stats.rows[0],
          ...riskStats.rows[0],
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminReferralController;
