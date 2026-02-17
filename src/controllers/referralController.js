const ReferralService = require("../services/referralService");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");

/**
 * ReferralController - Promotion Page APIs
 *
 * RULES:
 * - All endpoints are READ-ONLY (promotion page mirrors data)
 * - Data comes from: commissions table, referrals table, bets table
 * - Real-time commission already credited to wallet
 * - First reward is admin-only (not handled here)
 */
class ReferralController {
  /**
   * Get user's referral info (code & link)
   * GET /api/referral/info
   */
  static async getReferralInfo(req, res, next) {
    try {
      const userId = req.user.userId;

      const referral = await Referral.getByUserId(userId);

      if (!referral) {
        return res.status(404).json({
          success: false,
          message: "Referral info not found",
        });
      }

      const baseUrl = process.env.APP_BASE_URL || "https://luxwin.app";
      const referralLink = `${baseUrl}/register?ref=${referral.referral_code}`;

      res.json({
        success: true,
        data: {
          referral_code: referral.referral_code,
          referral_link: referralLink,
          created_at: referral.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get promotion statistics (for promotion page summary)
   * GET /api/referral/stats
   *
   * Returns:
   * - Actual Commission (total earned)
   * - Total Contribution (total bets from L1+L2+L3)
   * - Total People Invited (L1+L2+L3 count)
   * - Level-wise breakdown
   */
  static async getPromotionStats(req, res, next) {
    try {
      const userId = req.user.userId;

      const stats = await ReferralService.getPromotionStats(userId);

      res.json({
        success: true,
        data: {
          actual_commission: stats.total_commission,
          bet_commission: stats.bet_commission,
          first_reward: stats.first_reward,
          total_contribution: stats.total_contribution,
          total_people_invited: stats.total_invited,
          level_counts: {
            level_1: stats.level_counts.level1,
            level_2: stats.level_counts.level2,
            level_3: stats.level_counts.level3,
          },
          commission_breakdown: {
            level_1: stats.commission_breakdown.level_1,
            level_2: stats.commission_breakdown.level_2,
            level_3: stats.commission_breakdown.level_3,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get users at specific level (for Level 1/2/3 tabs)
   * GET /api/referral/users/:level
   *
   * Returns array of users with:
   * - UID (formatted)
   * - Phone (if available)
   * - Water Reward (commission from this user)
   * - First Reward (if given)
   */
  static async getUsersByLevel(req, res, next) {
    try {
      const userId = req.user.userId;
      const level = parseInt(req.params.level);

      if (![1, 2, 3].includes(level)) {
        return res.status(400).json({
          success: false,
          message: "Invalid level. Must be 1, 2, or 3",
        });
      }

      const users = await ReferralService.getUsersByLevel(userId, level);

      res.json({
        success: true,
        data: {
          level,
          count: users.length,
          users: users.map((user) => ({
            uid: user.uid,
            phone: user.phone,
            water_reward: parseFloat(user.water_reward),
            first_reward: parseFloat(user.first_reward),
            joined_at: user.joined_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get commission history (all commissions earned)
   * GET /api/referral/commissions
   *
   * Query params:
   * - type: 'bet_commission' or 'first_reward' (optional)
   * - level: 1, 2, or 3 (optional)
   * - limit: default 50
   * - offset: default 0
   */
  static async getCommissionHistory(req, res, next) {
    try {
      const userId = req.user.userId;
      const type = req.query.type || null;
      const level = req.query.level ? parseInt(req.query.level) : null;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Validate filters
      if (type && !["bet_commission", "first_reward"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid type. Must be 'bet_commission' or 'first_reward'",
        });
      }

      if (level && ![1, 2, 3].includes(level)) {
        return res.status(400).json({
          success: false,
          message: "Invalid level. Must be 1, 2, or 3",
        });
      }

      const commissions = await Commission.getHistory({
        userId,
        type,
        level,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: {
          count: commissions.length,
          commissions: commissions.map((comm) => ({
            id: comm.id,
            source_user_id: comm.source_user_id,
            source_email: comm.source_email,
            source_phone: comm.source_phone,
            level: comm.level,
            amount: parseFloat(comm.amount),
            type: comm.type,
            description: comm.description,
            created_at: comm.created_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get referral tree summary (who invited whom)
   * GET /api/referral/tree
   */
  static async getReferralTree(req, res, next) {
    try {
      const userId = req.user.userId;

      // Get current user's referral info
      const myReferral = await Referral.getByUserId(userId);

      if (!myReferral) {
        return res.status(404).json({
          success: false,
          message: "Referral info not found",
        });
      }

      // Get who invited me (upline)
      let invitedBy = null;
      if (myReferral.referred_by) {
        const referrerInfo = await Referral.getByUserId(myReferral.referred_by);
        if (referrerInfo) {
          invitedBy = {
            user_id: myReferral.referred_by,
            referral_code: referrerInfo.referral_code,
          };
        }
      }

      // Get my downline counts
      const level1Count = await Referral.getCountByLevel(userId, 1);
      const level2Count = await Referral.getCountByLevel(userId, 2);
      const level3Count = await Referral.getCountByLevel(userId, 3);

      res.json({
        success: true,
        data: {
          my_referral_code: myReferral.referral_code,
          invited_by: invitedBy,
          my_downline: {
            level_1: level1Count,
            level_2: level2Count,
            level_3: level3Count,
            total: level1Count + level2Count + level3Count,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate referral code (public endpoint for signup)
   * GET /api/referral/validate/:code
   */
  static async validateReferralCode(req, res, next) {
    try {
      const { code } = req.params;

      const referral = await Referral.getByCode(code);

      if (!referral) {
        return res.json({
          success: false,
          valid: false,
          message: "Invalid referral code",
        });
      }

      res.json({
        success: true,
        valid: true,
        message: "Valid referral code",
        data: {
          referral_code: referral.referral_code,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get commission statistics summary
   * GET /api/referral/commission-stats
   */
  static async getCommissionStats(req, res, next) {
    try {
      const userId = req.user.userId;

      const totals = await Commission.getTotalByUser(userId);
      const breakdown = await Commission.getBreakdownByLevel(userId);

      res.json({
        success: true,
        data: {
          total_commission: totals.total_commission,
          total_count: totals.total_count,
          bet_commission: totals.bet_commission_total,
          first_reward: totals.first_reward_total,
          by_level: {
            level_1: breakdown.level_1,
            level_2: breakdown.level_2,
            level_3: breakdown.level_3,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReferralController;
