const RedEnvelope = require("../models/RedEnvelope");
const RedEnvelopeClaim = require("../models/RedEnvelopeClaim");
const PromotionConfig = require("../models/PromotionConfig");
const FirstReward = require("../models/FirstReward");
const Referral = require("../models/Referral");
const ReferralService = require("../services/referralService");
const AuditService = require("../services/auditService");
const { generateRedEnvelopeCode } = require("../utils/promotions");

class AdminPromotionController {
  // Create red envelope
  static async createRedEnvelope(req, res, next) {
    try {
      const adminId = req.user.userId;
      const { amount, max_claims, expires_in_hours, eligibility_rule, target_uid } = req.body;

      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid amount is required",
        });
      }

      // Validate specific_user eligibility
      if (eligibility_rule === 'specific_user') {
        if (!target_uid || target_uid.trim() === '') {
          return res.status(400).json({
            success: false,
            message: "Target User UID is required for specific user eligibility",
          });
        }

        // Verify that the UID exists in the database
        const pool = require('../config/database');
        const userCheck = await pool.query('SELECT id FROM users WHERE uid = $1', [target_uid]);
        if (userCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            message: "User with specified UID not found",
          });
        }
      }

      // Generate unique code
      const code = generateRedEnvelopeCode();

      // Calculate expiry
      let expiresAt = null;
      if (expires_in_hours && expires_in_hours > 0) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expires_in_hours);
      }

      const envelope = await RedEnvelope.create({
        code,
        amount,
        maxClaims: max_claims || 1,
        expiresAt,
        createdBy: adminId,
        eligibilityRule: eligibility_rule || 'all',
        targetUid: eligibility_rule === 'specific_user' ? target_uid : null,
      });

      await AuditService.logAdminAction({
        adminId,
        action: "CREATE_RED_ENVELOPE",
        resourceType: "red_envelope",
        resourceId: envelope.id.toString(),
        payload: { code, amount, max_claims, expires_in_hours, eligibility_rule, target_uid },
        req,
      });

      res.status(201).json({
        success: true,
        message: "Red envelope created successfully",
        data: {
          id: envelope.id,
          code: envelope.code,
          amount: parseFloat(envelope.amount),
          max_claims: envelope.max_claims,
          expires_at: envelope.expires_at,
          eligibility_rule: envelope.eligibility_rule,
          target_uid: envelope.target_uid,
          claim_link: `${process.env.APP_BASE_URL || "https://luxwin.app"}/claim/${envelope.code}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // List all red envelopes
  static async listRedEnvelopes(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const envelopes = await RedEnvelope.getAll(limit, offset);

      res.json({
        success: true,
        data: envelopes.map((env) => ({
          id: env.id,
          code: env.code,
          claim_link: `${process.env.APP_BASE_URL || "http://localhost:3000"}/claim.html?code=${env.code}`,
          amount: parseFloat(env.amount),
          max_claims: env.max_claims,
          current_claims: env.current_claims,
          is_active: env.is_active,
          expires_at: env.expires_at,
          created_by: env.creator_email,
          created_at: env.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get red envelope claims
  static async getEnvelopeClaims(req, res, next) {
    try {
      const { envelope_id } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const claims = await RedEnvelopeClaim.getByEnvelopeId(envelope_id, limit);

      res.json({
        success: true,
        data: claims.map((claim) => ({
          id: claim.id,
          claimed_by: claim.claimer_email,
          amount: parseFloat(claim.amount),
          claimed_at: claim.claimed_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get promotion configuration
  static async getPromotionConfig(req, res, next) {
    try {
      const configs = await PromotionConfig.getAll();

      const configObj = {};
      configs.forEach((conf) => {
        configObj[conf.key] = {
          value: conf.value,
          description: conf.description,
        };
      });

      res.json({
        success: true,
        data: configObj,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update promotion configuration
  static async updatePromotionConfig(req, res, next) {
    try {
      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: "Key and value are required",
        });
      }

      const config = await PromotionConfig.set(key, value, description);

      await AuditService.logAdminAction({
        adminId: req.user.userId,
        action: "UPDATE_PROMOTION_CONFIG",
        resourceType: "config",
        resourceId: key,
        payload: { key, value, description },
        req,
      });

      res.json({
        success: true,
        message: "Configuration updated successfully",
        data: {
          key: config.key,
          value: config.value,
          description: config.description,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update commission rates
  static async updateCommissionRates(req, res, next) {
    try {
      const { level_1, level_2, level_3 } = req.body;

      const updates = [];

      if (level_1 !== undefined) {
        await PromotionConfig.set(
          "commission_l1_percent",
          level_1.toString(),
          "Level 1 commission percentage",
        );
        updates.push({ level: 1, rate: level_1 });
      }

      if (level_2 !== undefined) {
        await PromotionConfig.set(
          "commission_l2_percent",
          level_2.toString(),
          "Level 2 commission percentage",
        );
        updates.push({ level: 2, rate: level_2 });
      }

      if (level_3 !== undefined) {
        await PromotionConfig.set(
          "commission_l3_percent",
          level_3.toString(),
          "Level 3 commission percentage",
        );
        updates.push({ level: 3, rate: level_3 });
      }

      await AuditService.logAdminAction({
        adminId: req.user.userId,
        action: "UPDATE_COMMISSION_RATES",
        resourceType: "config",
        resourceId: "commission_rates",
        payload: { level_1, level_2, level_3 },
        req,
      });

      res.json({
        success: true,
        message: "Commission rates updated successfully",
        data: updates,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update first recharge bonus
  static async updateFirstRechargeBonus(req, res, next) {
    try {
      const { enabled, bonus_percent } = req.body;

      if (enabled !== undefined) {
        await PromotionConfig.set(
          "first_recharge_bonus_enabled",
          enabled.toString(),
          "Enable first recharge bonus",
        );
      }

      if (bonus_percent !== undefined) {
        await PromotionConfig.set(
          "first_recharge_bonus_percent",
          bonus_percent.toString(),
          "First recharge bonus percentage",
        );
      }

      await AuditService.logAdminAction({
        adminId: req.user.userId,
        action: "UPDATE_FIRST_RECHARGE_BONUS",
        resourceType: "config",
        resourceId: "first_recharge_bonus",
        payload: { enabled, bonus_percent },
        req,
      });

      res.json({
        success: true,
        message: "First recharge bonus settings updated",
        data: {
          enabled,
          bonus_percent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get bet tax configuration
  static async getBetTaxConfig(req, res, next) {
    try {
      const taxPercent = await PromotionConfig.get("bet_tax_percent");

      res.json({
        success: true,
        data: {
          bet_tax_percent: parseFloat(
            taxPercent || process.env.BET_TAX_PERCENT || 10,
          ),
          description: "Platform tax percentage applied to all bets",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update bet tax configuration
  static async updateBetTaxConfig(req, res, next) {
    try {
      const { tax_percent } = req.body;

      if (tax_percent === undefined || tax_percent < 0 || tax_percent > 50) {
        return res.status(400).json({
          success: false,
          message: "Tax percent must be between 0 and 50",
        });
      }

      await PromotionConfig.set(
        "bet_tax_percent",
        tax_percent.toString(),
        "Platform tax percentage on bets",
      );

      await AuditService.logAdminAction({
        adminId: req.user.userId,
        action: "UPDATE_BET_TAX",
        resourceType: "config",
        resourceId: "bet_tax_percent",
        payload: { tax_percent },
        req,
      });

      res.json({
        success: true,
        message: "Bet tax configuration updated",
        data: {
          bet_tax_percent: tax_percent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Deactivate red envelope
  static async deactivateRedEnvelope(req, res, next) {
    try {
      const { envelope_id } = req.params;
      const adminId = req.user.userId;

      const envelope = await RedEnvelope.deactivate(envelope_id);

      if (!envelope) {
        return res.status(404).json({
          success: false,
          message: "Red envelope not found",
        });
      }

      await AuditService.logAdminAction({
        adminId,
        action: "DEACTIVATE_RED_ENVELOPE",
        resourceType: "red_envelope",
        resourceId: envelope_id.toString(),
        payload: { envelope_id },
        req,
      });

      res.json({
        success: true,
        message: "Red envelope deactivated successfully",
        data: { id: envelope_id, is_active: false },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // FIRST REWARD MANAGEMENT (MANUAL - ADMIN ONLY)
  // ============================================================

  /**
   * Get users eligible for first reward
   * GET /api/admin/promotion/first-reward/eligible
   *
   * Returns users who:
   * - Have a referrer
   * - Have made at least one approved recharge
   * - Have NOT received first reward yet
   */
  static async getEligibleForFirstReward(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const eligibleUsers = await FirstReward.getEligibleUsers(limit, offset);
      const totalEligible = await FirstReward.getEligibleCount();

      res.json({
        success: true,
        data: {
          total_eligible: totalEligible,
          count: eligibleUsers.length,
          users: eligibleUsers.map((user) => ({
            user_id: user.user_id,
            email: user.email,
            phone: user.phone || "",
            invited_by: user.referred_by,
            invited_by_email: user.referrer_email,
            first_recharge_date: user.first_recharge_date,
            first_recharge_amount: parseFloat(user.recharge_amount),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Credit first reward manually
   * POST /api/admin/promotion/first-reward/credit
   *
   * Body: {
   *   user_id: UUID (invited user who made first recharge),
   *   reward_amount: number
   * }
   *
   * This credits the reward to the REFERRER (not the user who recharged)
   */
  static async creditFirstReward(req, res, next) {
    try {
      const { user_id, reward_amount } = req.body;
      const adminId = req.user.userId;

      // Validate input
      if (!user_id || !reward_amount) {
        return res.status(400).json({
          success: false,
          message: "user_id and reward_amount are required",
        });
      }

      if (reward_amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "reward_amount must be greater than 0",
        });
      }

      // Check if already given
      const alreadyGiven = await FirstReward.hasReceived(user_id);
      if (alreadyGiven) {
        return res.status(400).json({
          success: false,
          message: "First reward already given to this user",
          error_code: "ALREADY_GIVEN",
        });
      }

      // Get referral info
      const referral = await Referral.getByUserId(user_id);
      if (!referral || !referral.referred_by) {
        return res.status(400).json({
          success: false,
          message: "User has no referrer",
          error_code: "NO_REFERRER",
        });
      }

      // Credit first reward via ReferralService
      const result = await ReferralService.creditFirstReward(
        user_id,
        parseFloat(reward_amount),
        adminId,
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      // Log admin action
      await AuditService.logAdminAction({
        adminId,
        action: "CREDIT_FIRST_REWARD",
        resourceType: "first_reward",
        resourceId: user_id,
        payload: {
          user_id,
          referrer_id: referral.referred_by,
          reward_amount: parseFloat(reward_amount),
        },
        req,
      });

      res.json({
        success: true,
        message: "First reward credited successfully",
        data: {
          user_id,
          referrer_id: result.data.referrer_id,
          reward_amount: parseFloat(reward_amount),
          commission_id: result.data.commission_id,
          transaction_id: result.data.transaction_id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get first reward history
   * GET /api/admin/promotion/first-reward/history
   */
  static async getFirstRewardHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const rewards = await FirstReward.getAll(limit, offset);
      const stats = await FirstReward.getGlobalStats();

      res.json({
        success: true,
        data: {
          statistics: {
            total_rewards_given: stats.total_rewards,
            total_amount: parseFloat(stats.total_amount),
            average_amount: parseFloat(stats.average_amount),
          },
          history: rewards.map((reward) => ({
            id: reward.id,
            user_id: reward.user_id,
            user_email: reward.user_email,
            user_phone: reward.user_phone || "",
            referrer_id: reward.referred_by,
            referrer_email: reward.referrer_email,
            reward_amount: parseFloat(reward.reward_amount),
            given_by_admin: reward.given_by_admin,
            admin_email: reward.admin_email,
            given_at: reward.given_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get first reward statistics
   * GET /api/admin/promotion/first-reward/stats
   */
  static async getFirstRewardStats(req, res, next) {
    try {
      const stats = await FirstReward.getGlobalStats();
      const eligibleCount = await FirstReward.getEligibleCount();

      res.json({
        success: true,
        data: {
          total_rewards_given: stats.total_rewards,
          total_amount_distributed: parseFloat(stats.total_amount),
          average_reward_amount: parseFloat(stats.average_amount),
          eligible_users_count: eligibleCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminPromotionController;
