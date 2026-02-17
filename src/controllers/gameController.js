const pool = require("../config/database");
const GameRound = require("../models/GameRound");
const Bet = require("../models/Bet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const PromotionConfig = require("../models/PromotionConfig");
const ReferralService = require("../services/referralService");
const AuditService = require("../services/auditService");
const VIPController = require("./vipController");

class GameController {
  // Get Current Round
  static async getCurrentRound(req, res, next) {
    try {
      const currentRound = await GameRound.getCurrent();

      if (!currentRound) {
        return res.json({
          success: true,
          data: null,
          message: "No active round. New round will start soon.",
        });
      }

      const now = new Date();
      const lockTime = new Date(currentRound.lock_time);
      const endTime = new Date(currentRound.end_time);

      const timeUntilLock = Math.max(0, Math.floor((lockTime - now) / 1000));
      const timeUntilEnd = Math.max(0, Math.floor((endTime - now) / 1000));

      // Add 2 second buffer to prevent last-second exploit due to network lag
      const serverBuffer = 2;
      const canBet =
        currentRound.status === "betting" && timeUntilLock > serverBuffer;

      res.json({
        success: true,
        data: {
          round_id: currentRound.id,
          round_number: currentRound.round_number,
          status: currentRound.status,
          time_until_lock: timeUntilLock,
          time_until_end: timeUntilEnd,
          timeRemaining: timeUntilEnd, // For frontend compatibility
          can_bet: canBet,
          lock_time: currentRound.lock_time,
          end_time: currentRound.end_time,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Place Bet
  static async placeBet(req, res, next) {
    console.log("🎯 [BET] Starting placeBet...");
    console.log("🎯 [BET] req.user:", req.user);
    console.log("🎯 [BET] req.body:", req.body);

    const client = await pool.connect();
    console.log("🎯 [BET] DB client connected");

    try {
      const userId = req.user.userId;
      const { choice, amount } = req.body;
      console.log(
        "🎯 [BET] userId:",
        userId,
        "| choice:",
        choice,
        "| amount:",
        amount,
      );

      // Validate choice
      const validChoices = ["red", "green", "purple"];
      if (!validChoices.includes(choice.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid choice. Must be red, green, or purple.",
        });
      }

      // Check if user is banned
      const userCheck = await User.findById(userId);
      if (userCheck.is_banned) {
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended. Please contact support.",
          error_code: "ACCOUNT_BANNED",
        });
      }

      // Validate amount
      const minBet = parseFloat(process.env.MIN_BET_AMOUNT || 10);
      const maxBet = parseFloat(process.env.MAX_BET_AMOUNT || 10000);

      if (amount < minBet || amount > maxBet) {
        return res.status(400).json({
          success: false,
          message: `Bet amount must be between ${minBet} and ${maxBet} USD`,
          error_code: "INVALID_BET_AMOUNT",
        });
      }

      // Get current round
      const currentRound = await GameRound.getCurrent();
      if (!currentRound) {
        return res.status(400).json({
          success: false,
          message: "No active round available",
          error_code: "NO_ACTIVE_ROUND",
        });
      }

      // Check for duplicate bet in same round
      const existingBets = await Bet.getUserBetsForRound(
        userId,
        currentRound.id,
      );
      const duplicateBet = existingBets.find(
        (bet) =>
          bet.choice.toLowerCase() === choice.toLowerCase() &&
          parseFloat(bet.amount) === amount,
      );

      if (duplicateBet && existingBets.length > 0) {
        const timeDiff =
          Date.now() - new Date(duplicateBet.created_at).getTime();
        if (timeDiff < 2000) {
          await AuditService.logSecurityEvent({
            userId,
            event: "DUPLICATE_BET_ATTEMPT",
            details: { round_id: currentRound.id, choice, amount },
            req,
            status: "blocked",
          });
          return res.status(400).json({
            success: false,
            message: "Duplicate bet detected",
            error_code: "DUPLICATE_BET",
          });
        }
      }

      // Check if betting is allowed (with 2 second buffer for network lag)
      const now = new Date();
      const lockTime = new Date(currentRound.lock_time);
      const serverBuffer = 2000; // 2 second buffer to prevent last-second exploits

      if (
        now.getTime() >= lockTime.getTime() - serverBuffer ||
        currentRound.status !== "betting"
      ) {
        await AuditService.logSecurityEvent({
          userId,
          event: "LATE_BET_ATTEMPT",
          details: {
            round_id: currentRound.id,
            choice,
            amount,
            time_until_lock: (lockTime.getTime() - now.getTime()) / 1000,
          },
          req,
          status: "blocked",
        });
        return res.status(400).json({
          success: false,
          message: "Betting is closed for this round",
          error_code: "BETTING_CLOSED",
        });
      }

      await client.query("BEGIN");

      // Calculate platform tax (configurable from admin panel, fallback to env, default 10%)
      // CRITICAL: Tax is INSIDE the bet amount, NOT extra
      // User bets $X → Wallet deducts $X → Tax = 10% of $X → Stake = $X - tax
      let taxPercent = parseFloat(process.env.BET_TAX_PERCENT || 10);
      try {
        const configTax = await PromotionConfig.get("bet_tax_percent");
        if (configTax !== null && configTax !== undefined) {
          taxPercent = parseFloat(configTax);
        }
      } catch (e) {
        // Use env/default if config fails
      }

      // Tax is cut FROM the bet amount (not added on top)
      const taxAmount = (amount * taxPercent) / 100;
      const stakeAmount = amount - taxAmount; // Actual money going into the game
      const walletDeduction = amount; // ONLY the bet amount is deducted

      // Check balance with row-level locking (ATOMIC - prevents race conditions)
      const user = await User.getForUpdate(userId, client);
      console.log("🎯 [BET] user locked for update");
      const currentBalance = parseFloat(user.main_balance);
      console.log("🎯 [BET] currentBalance:", currentBalance);

      if (currentBalance < walletDeduction) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Required: $${walletDeduction.toFixed(2)}`,
          error_code: "INSUFFICIENT_BALANCE",
          details: {
            bet_amount: amount,
            current_balance: currentBalance,
          },
        });
      }

      // Prevent negative balance
      if (currentBalance - walletDeduction < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Transaction would result in negative balance",
          error_code: "NEGATIVE_BALANCE_PREVENTED",
        });
      }

      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - walletDeduction;
      console.log(
        "🎯 [BET] balanceBefore:",
        balanceBefore,
        "| balanceAfter:",
        balanceAfter,
      );

      // Deduct bet amount from users.main_balance (SINGLE SOURCE OF TRUTH with row lock)
      console.log("🎯 [BET] Updating users.main_balance atomically...");
      const updatedUser = await User.updateBalance(
        userId,
        -walletDeduction,
        client,
      );
      console.log(
        "🎯 [BET] Balance updated, new main_balance:",
        updatedUser.main_balance,
      );

      // Create bet record with full accounting breakdown
      console.log("🎯 [BET] Creating bet record...");
      const bet = await Bet.create(
        {
          userId,
          roundId: currentRound.id,
          roundNumber: currentRound.round_number,
          choice: choice.toLowerCase(),
          amount, // Original bet amount
          taxAmount, // Tax cut from bet
          stakeAmount, // Actual stake = bet - tax (used for payout calculation)
        },
        client,
      );
      console.log("🎯 [BET] Bet record created:", bet);

      // Record SINGLE bet transaction (shows bet amount with tax breakdown)
      console.log("🎯 [BET] Creating transaction record...");
      await Transaction.create(
        {
          userId,
          type: "game_bet",
          amount: -walletDeduction,
          balanceBefore,
          balanceAfter,
          status: "completed",
          referenceId: `BET-${bet.id}`,
          description: `Bet $${amount.toFixed(2)} on ${choice} (Tax: $${taxAmount.toFixed(2)}, Stake: $${stakeAmount.toFixed(2)}) - Round ${currentRound.round_number}`,
        },
        client,
      );
      console.log("🎯 [BET] Transaction created");

      // Update total wager for VIP system
      console.log("🎯 [BET] Updating total wager for VIP system...");
      await User.updateTotalWager(userId, amount, client);

      // Check and upgrade VIP level if threshold crossed
      console.log("🎯 [BET] Checking VIP upgrade...");
      const vipResult = await VIPController.checkAndUpgrade(userId, client);
      if (vipResult.upgraded) {
        console.log(
          `🎖️ [VIP] User upgraded from VIP ${vipResult.old_level} to VIP ${vipResult.new_level}, bonus: $${vipResult.bonus_credited}`,
        );
      }

      console.log("🎯 [BET] COMMITTING transaction...");
      await client.query("COMMIT");
      console.log("🎯 [BET] COMMITTED successfully");

      // Process referral commission (async, non-blocking)
      ReferralService.processBetCommission(userId, amount, bet.id).catch(
        (err) => {
          console.error("Error processing bet commission:", err);
        },
      );

      console.log("🎯 [BET] Sending success response");
      res.json({
        success: true,
        message: "Bet placed successfully",
        data: {
          bet_id: bet.id,
          round_number: currentRound.round_number,
          choice: bet.choice,
          bet_amount: parseFloat(bet.amount), // What user bet
          tax_amount: taxAmount, // Platform fee (inside bet)
          tax_percent: taxPercent,
          stake_amount: stakeAmount, // Actual stake for payout
          wallet_deducted: walletDeduction, // ONLY bet amount deducted
          new_balance: balanceAfter,
        },
      });
    } catch (error) {
      console.error("🎯 [BET] ERROR:", error);

      // Rollback transaction if it was started
      try {
        await client.query("ROLLBACK");
        console.log("🎯 [BET] Transaction rolled back");
      } catch (rollbackError) {
        console.error("🎯 [BET] Rollback error:", rollbackError);
      }

      // CRITICAL: Always send a response, never leave request hanging
      // Don't rely on error middleware - send response directly
      if (!res.headersSent) {
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || "An error occurred while placing bet";

        console.log(`🎯 [BET] Sending error response: ${statusCode} - ${errorMessage}`);

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
          error_code: error.errorCode || "BET_PLACEMENT_ERROR",
        });
      } else {
        console.error("🎯 [BET] Headers already sent, cannot send error response");
      }
    } finally {
      console.log("🎯 [BET] Releasing DB client");
      client.release();
    }
  }

  // Get Recent Results
  static async getRecentResults(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const recentRounds = await GameRound.getRecent(limit);

      res.json({
        success: true,
        data: recentRounds.map((round) => ({
          round_number: round.round_number,
          result: round.result,
          result_number: round.result_number,
          end_time: round.end_time,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get User's Bet History with Pagination
  static async getCurrentRoundBets(req, res, next) {
    try {
      const userId = req.user.userId;

      // Get pagination parameters from query string
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated bets with total count
      const { bets, total } = await Bet.getUserBetHistoryWithCount(userId, limit, offset);

      // Calculate total pages
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: bets.map((bet) => ({
          bet_id: bet.id,
          round_number: bet.round_number,
          choice: bet.choice,
          amount: parseFloat(bet.amount),
          result: bet.result,
          payout: bet.payout ? parseFloat(bet.payout) : 0,
          created_at: bet.created_at,
          round_result: bet.round_result,
          result_number: bet.result_number
        })),
        total: total,
        page: page,
        totalPages: totalPages
      });
    } catch (error) {
      next(error);
    }
  }

  // Get Top Winners (Real data from database)
  static async getTopWinners(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 3;

      // Get top winners by total winnings from completed bets
      const result = await pool.query(
        `SELECT
          u.email,
          SUM(b.payout) as total_winnings
        FROM bets b
        JOIN users u ON b.user_id = u.id
        WHERE b.result = 'win' AND b.payout > 0
        GROUP BY u.id, u.email
        ORDER BY total_winnings DESC
        LIMIT $1`,
        [limit],
      );

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          email: row.email,
          total_winnings: parseFloat(row.total_winnings || 0),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get Recent Winners (Real data for live feed)
  static async getRecentWinners(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 5;

      // Get recent winning bets with user email
      const result = await pool.query(
        `SELECT
          u.email,
          b.choice,
          b.payout,
          b.created_at
        FROM bets b
        JOIN users u ON b.user_id = u.id
        WHERE b.result = 'win' AND b.payout > 0
        ORDER BY b.created_at DESC
        LIMIT $1`,
        [limit],
      );

      res.json({
        success: true,
        data: result.rows.map((row) => ({
          email: row.email,
          choice: row.choice,
          payout: parseFloat(row.payout || 0),
          created_at: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GameController;
