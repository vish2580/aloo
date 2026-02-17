const pool = require("../config/database");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/**
 * ReferralService - Production-Grade 3-Level Referral System
 *
 * STRICT RULES:
 * 1. Only 3 levels supported (Level 1, 2, 3)
 * 2. Real-time commission AUTO-CREDITED to main wallet
 * 3. Commission creates: wallet credit + transaction + commission record
 * 4. First Reward is MANUAL (admin only) - NOT handled here
 * 5. All operations are ATOMIC (transaction-based)
 * 6. Promotion page is READ-ONLY (mirrors this data)
 */
class ReferralService {
  /**
   * Process bet commission in real-time
   * Called automatically when user places a bet
   *
   * @param {UUID} userId - User who placed the bet
   * @param {number} betAmount - Total bet amount
   * @param {string} betId - Bet reference ID
   * @param {object} client - Optional DB client (for transaction)
   */
  static async processBetCommission(userId, betAmount, betId = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get user's referral info
      const referral = await Referral.getByUserId(userId, client);

      // No referrer = no commission to process
      if (!referral || !referral.referred_by) {
        await client.query("COMMIT");
        return {
          processed: false,
          reason: "No referrer found",
        };
      }

      // Get commission rates from config
      const ratesQuery = `
        SELECT key, value FROM promotion_config
        WHERE key IN ('commission_l1_percent', 'commission_l2_percent', 'commission_l3_percent')
      `;
      const ratesResult = await client.query(ratesQuery);

      const rates = {};
      ratesResult.rows.forEach((row) => {
        rates[row.key] = parseFloat(row.value);
      });

      const l1Rate = rates.commission_l1_percent || 5;
      const l2Rate = rates.commission_l2_percent || 3;
      const l3Rate = rates.commission_l3_percent || 1;

      const commissions = [];

      // ============================================================
      // LEVEL 1 - Direct Referrer
      // ============================================================
      const level1UserId = referral.referred_by;
      const level1Amount = (betAmount * l1Rate) / 100;

      if (level1Amount > 0) {
        const comm1 = await this._creditCommission({
          userId: level1UserId,
          sourceUserId: userId,
          level: 1,
          amount: level1Amount,
          type: "bet_commission",
          referenceId: betId,
          description: `Level 1 commission from bet`,
          client,
        });
        commissions.push(comm1);
      }

      // ============================================================
      // LEVEL 2 - Referrer of Level 1
      // ============================================================
      const level1Referral = await Referral.getByUserId(level1UserId, client);

      if (level1Referral && level1Referral.referred_by) {
        const level2UserId = level1Referral.referred_by;
        const level2Amount = (betAmount * l2Rate) / 100;

        if (level2Amount > 0) {
          const comm2 = await this._creditCommission({
            userId: level2UserId,
            sourceUserId: userId,
            level: 2,
            amount: level2Amount,
            type: "bet_commission",
            referenceId: betId,
            description: `Level 2 commission from bet`,
            client,
          });
          commissions.push(comm2);
        }

        // ============================================================
        // LEVEL 3 - Referrer of Level 2
        // ============================================================
        const level2Referral = await Referral.getByUserId(level2UserId, client);

        if (level2Referral && level2Referral.referred_by) {
          const level3UserId = level2Referral.referred_by;
          const level3Amount = (betAmount * l3Rate) / 100;

          if (level3Amount > 0) {
            const comm3 = await this._creditCommission({
              userId: level3UserId,
              sourceUserId: userId,
              level: 3,
              amount: level3Amount,
              type: "bet_commission",
              referenceId: betId,
              description: `Level 3 commission from bet`,
              client,
            });
            commissions.push(comm3);
          }
        }
      }

      await client.query("COMMIT");

      return {
        processed: true,
        commissions,
        total_distributed: commissions.reduce(
          (sum, c) => sum + parseFloat(c.amount),
          0,
        ),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Error processing bet commission:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * INTERNAL METHOD - Credit commission atomically
   *
   * CRITICAL: This performs 3 operations in sequence:
   * 1. Lock user row and get current balance
   * 2. Update users.main_balance (wallet credit)
   * 3. Create transaction record
   * 4. Create commission record
   *
   * All within same transaction (ATOMIC)
   */
  static async _creditCommission({
    userId,
    sourceUserId,
    level,
    amount,
    type,
    referenceId,
    description,
    client,
  }) {
    // STEP 1: Lock user row and get current balance
    const user = await User.getForUpdate(userId, client);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (user.is_banned) {
      throw new Error(`User ${userId} is banned, cannot credit commission`);
    }

    const balanceBefore = parseFloat(user.main_balance);
    const balanceAfter = balanceBefore + amount;

    // STEP 2: Update users.main_balance (WALLET CREDIT - SINGLE SOURCE OF TRUTH)
    await User.updateBalance(userId, amount, client);

    // STEP 3: Create transaction record (for wallet history)
    const transaction = await Transaction.create(
      {
        userId,
        type: "commission",
        amount,
        balanceBefore,
        balanceAfter,
        status: "completed",
        referenceId: referenceId || `COMM-${Date.now()}-${level}`,
        description: `${description} (L${level})`,
      },
      client,
    );

    // STEP 4: Create commission record (for promotion page)
    const commission = await Commission.create(
      {
        userId,
        sourceUserId,
        level,
        amount,
        type,
        referenceId: transaction.id.toString(),
        description,
      },
      client,
    );

    return {
      commission_id: commission.id,
      transaction_id: transaction.id,
      user_id: userId,
      level,
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    };
  }

  /**
   * Manual First Reward Credit (ADMIN ONLY)
   *
   * Called by admin panel when giving first reward manually
   * This is the ONLY way to give first reward
   *
   * @param {UUID} userId - User who made first recharge (invited user)
   * @param {number} rewardAmount - Reward amount set by admin
   * @param {UUID} adminId - Admin who is giving the reward
   */
  static async creditFirstReward(userId, rewardAmount, adminId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get user's referral info
      const referral = await Referral.getByUserId(userId, client);

      if (!referral || !referral.referred_by) {
        await client.query("ROLLBACK");
        return {
          success: false,
          message: "User has no referrer",
        };
      }

      const referrerId = referral.referred_by;

      // Check if first reward already given
      const FirstReward = require("../models/FirstReward");
      const alreadyGiven = await FirstReward.hasReceived(userId, client);

      if (alreadyGiven) {
        await client.query("ROLLBACK");
        return {
          success: false,
          message: "First reward already given to this user",
        };
      }

      // Credit commission to referrer (Level 1 only)
      const creditResult = await this._creditCommission({
        userId: referrerId,
        sourceUserId: userId,
        level: 1,
        amount: rewardAmount,
        type: "first_reward",
        referenceId: `FIRST-REWARD-${userId}`,
        description: `First recharge reward (manual by admin)`,
        client,
      });

      // Record first reward tracking
      await FirstReward.create(
        {
          userId,
          referredBy: referrerId,
          rewardAmount,
          givenByAdmin: adminId,
        },
        client,
      );

      await client.query("COMMIT");

      return {
        success: true,
        message: "First reward credited successfully",
        data: {
          referrer_id: referrerId,
          reward_amount: rewardAmount,
          commission_id: creditResult.commission_id,
          transaction_id: creditResult.transaction_id,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Error crediting first reward:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get complete promotion statistics for a user
   * Used by promotion page
   */
  static async getPromotionStats(userId) {
    const client = await pool.connect();

    try {
      // Get commission totals
      const commissionTotals = await Commission.getTotalByUser(userId, client);

      // Get total people invited (L1 + L2 + L3)
      const totalInvited = await Referral.getTotalInvited(userId, client);

      // Get total contribution (all bets from L1 + L2 + L3)
      const totalContribution = await Referral.getTotalContribution(
        userId,
        client,
      );

      // Get level counts
      const level1Count = await Referral.getCountByLevel(userId, 1, client);
      const level2Count = await Referral.getCountByLevel(userId, 2, client);
      const level3Count = await Referral.getCountByLevel(userId, 3, client);

      // Get level-wise commission breakdown
      const commissionBreakdown = await Commission.getBreakdownByLevel(
        userId,
        client,
      );

      return {
        total_commission: commissionTotals.total_commission,
        bet_commission: commissionTotals.bet_commission_total,
        first_reward: commissionTotals.first_reward_total,
        total_invited: totalInvited,
        total_contribution: totalContribution,
        level_counts: {
          level1: level1Count,
          level2: level2Count,
          level3: level3Count,
        },
        commission_breakdown: commissionBreakdown,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get users at specific level with their stats
   * Used by promotion page tabs (Level 1, 2, 3)
   */
  static async getUsersByLevel(userId, level) {
    const client = await pool.connect();

    try {
      let users = [];

      if (level === 1) {
        users = await Referral.getLevel1Users(userId, client);
      } else if (level === 2) {
        users = await Referral.getLevel2Users(userId, client);
      } else if (level === 3) {
        users = await Referral.getLevel3Users(userId, client);
      } else {
        throw new Error("Invalid level. Must be 1, 2, or 3");
      }

      // Enrich each user with their commission data
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          // Get water reward (bet commission from this user)
          const commData = await Commission.getFromSourceUser(
            userId,
            user.user_id,
            client,
          );

          return {
            user_id: user.user_id,
            uid: `UID${user.user_id.toString().replace(/-/g, "").substring(0, 6).toUpperCase()}`,
            phone: user.phone || "",
            email: user.email,
            water_reward: commData.water_reward,
            first_reward: commData.first_reward,
            joined_at: user.created_at,
          };
        }),
      );

      return enrichedUsers;
    } finally {
      client.release();
    }
  }

  /**
   * Validate referral code and return referrer user ID
   */
  static async validateReferralCode(code) {
    const referral = await Referral.getByCode(code);

    if (!referral) {
      return null;
    }

    return referral.user_id;
  }

  /**
   * Generate unique referral code for user
   */
  static generateReferralCode(userId) {
    // Format: LUX + 6 random alphanumeric
    const randomPart = userId
      .toString()
      .replace(/-/g, "")
      .substring(0, 6)
      .toUpperCase();
    return `LUX${randomPart}`;
  }
}

module.exports = ReferralService;
