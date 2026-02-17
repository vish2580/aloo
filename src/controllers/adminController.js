const pool = require("../config/database");
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");
const GameRound = require("../models/GameRound");
const AuditService = require("../services/auditService");
const getGameEngine = require("../services/gameEngine");

class AdminController {
  // ==================== DASHBOARD STATS ====================

  static async getDashboardStats(req, res, next) {
    try {
      // Total Users
      const usersResult = await pool.query(
        "SELECT COUNT(*) as count FROM users",
      );
      const totalUsers = parseInt(usersResult.rows[0].count);

      // Total Deposits
      const depositsResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'deposit' AND status = 'completed'",
      );
      const totalDeposits = parseFloat(depositsResult.rows[0].total);

      // Total Withdrawals (approved)
      const withdrawalsResult = await pool.query(
        "SELECT COALESCE(SUM(net_amount), 0) as total FROM withdrawals WHERE status = 'approved'",
      );
      const totalWithdrawals = parseFloat(withdrawalsResult.rows[0].total);

      // Today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayDepositsResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'deposit' AND status = 'completed' AND created_at >= $1",
        [today],
      );
      const todayDeposits = parseFloat(todayDepositsResult.rows[0].total);

      const todayWithdrawalsResult = await pool.query(
        "SELECT COALESCE(SUM(net_amount), 0) as total FROM withdrawals WHERE status = 'approved' AND processed_at >= $1",
        [today],
      );
      const todayWithdrawals = parseFloat(todayWithdrawalsResult.rows[0].total);

      // Today's game payouts
      const todayPayoutsResult = await pool.query(
        "SELECT COALESCE(SUM(payout), 0) as total FROM bets WHERE result = 'win' AND created_at >= $1",
        [today],
      );
      const todayPayouts = parseFloat(todayPayoutsResult.rows[0].total);

      // Today's bet income (bet amounts only, not including tax)
      const todayBetsResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE created_at >= $1",
        [today],
      );
      const todayBets = parseFloat(todayBetsResult.rows[0].total);

      // Today's tax collected (from bet_tax transactions)
      const todayTaxResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'bet_tax' AND created_at >= $1",
        [today],
      );
      const todayTax = parseFloat(todayTaxResult.rows[0].total);

      // Total tax collected (all time)
      const totalTaxResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'bet_tax'",
      );
      const totalTax = parseFloat(totalTaxResult.rows[0].total);

      // Total bets (all time)
      const totalBetsResult = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM bets",
      );
      const totalBets = parseFloat(totalBetsResult.rows[0].total);

      // Total payouts (all time)
      const totalPayoutsResult = await pool.query(
        "SELECT COALESCE(SUM(payout), 0) as total FROM bets WHERE result = 'win'",
      );
      const totalPayouts = parseFloat(totalPayoutsResult.rows[0].total);

      // Net game profit = bets lost (bets - payouts) + tax collected
      // Users lose their bet amount when they lose, platform keeps it
      const netGameProfit = totalBets - totalPayouts + totalTax;

      // Today's profit = deposits + bets - withdrawals - payouts + tax
      // (bets - payouts + tax = game profit)
      const todayGameProfit = todayBets - todayPayouts + todayTax;
      const todayProfit = todayDeposits + todayGameProfit - todayWithdrawals;

      res.json({
        success: true,
        data: {
          totalUsers,
          totalDeposits,
          totalWithdrawals,
          // Today's stats
          todayProfit,
          todayDeposits,
          todayWithdrawals,
          todayBets,
          todayPayouts,
          todayTax,
          todayGameProfit,
          // All-time game stats
          totalBets,
          totalPayouts,
          totalTax,
          netGameProfit,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RECENT ACTIVITY ====================

  static async getRecentActivity(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;

      // Get recent events from various sources
      const activities = [];

      // Recent rounds completed
      const rounds = await pool.query(
        `SELECT 'round_completed' as type, round_number, result, result_number, end_time as timestamp
         FROM game_rounds WHERE status = 'completed' ORDER BY end_time DESC LIMIT 5`,
      );
      rounds.rows.forEach((r) =>
        activities.push({
          type: "round_completed",
          icon: "🎮",
          text: `Round #${r.round_number} completed - ${r.result} (${r.result_number})`,
          timestamp: r.timestamp,
        }),
      );

      // Recent deposits
      const deposits = await pool.query(
        `SELECT t.amount, t.created_at as timestamp, u.email
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.type = 'deposit' AND t.status = 'completed'
         ORDER BY t.created_at DESC LIMIT 5`,
      );
      deposits.rows.forEach((d) =>
        activities.push({
          type: "deposit",
          icon: "💰",
          text: `${d.email.substring(0, 3)}***${d.email.slice(-8)} deposited $${parseFloat(d.amount).toFixed(2)}`,
          timestamp: d.timestamp,
        }),
      );

      // Recent withdrawal requests
      const withdrawals = await pool.query(
        `SELECT w.net_amount, w.status, w.created_at as timestamp, u.email
         FROM withdrawals w
         JOIN users u ON w.user_id = u.id
         ORDER BY w.created_at DESC LIMIT 5`,
      );
      withdrawals.rows.forEach((w) =>
        activities.push({
          type: "withdrawal",
          icon: "💸",
          text: `Withdrawal ${w.status} - $${parseFloat(w.net_amount).toFixed(2)} from ${w.email.substring(0, 3)}***`,
          timestamp: w.timestamp,
        }),
      );

      // Recent registrations
      const newUsers = await pool.query(
        `SELECT email, created_at as timestamp FROM users ORDER BY created_at DESC LIMIT 5`,
      );
      newUsers.rows.forEach((u) =>
        activities.push({
          type: "registration",
          icon: "👤",
          text: `New user registered: ${u.email.substring(0, 3)}***${u.email.slice(-8)}`,
          timestamp: u.timestamp,
        }),
      );

      // Recent red envelope claims
      const claims = await pool.query(
        `SELECT rec.amount, rec.claimed_at as timestamp, u.email
         FROM red_envelope_claims rec
         JOIN users u ON rec.claimed_by = u.id
         ORDER BY rec.claimed_at DESC LIMIT 5`,
      );
      claims.rows.forEach((c) =>
        activities.push({
          type: "envelope_claimed",
          icon: "🧧",
          text: `Red envelope claimed by ${c.email.substring(0, 3)}*** - $${parseFloat(c.amount).toFixed(2)}`,
          timestamp: c.timestamp,
        }),
      );

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json({
        success: true,
        data: activities.slice(0, limit),
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== LIVE GAME STATS ====================

  static async getLiveGameStats(req, res, next) {
    try {
      // Current round
      const currentRound = await GameRound.getCurrent();

      // Today's rounds count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const roundsToday = await pool.query(
        "SELECT COUNT(*) as count FROM game_rounds WHERE created_at >= $1",
        [today],
      );

      // Today's total bets
      const todayBets = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM bets WHERE created_at >= $1",
        [today],
      );

      // Active players (bets in current round)
      let activePlayers = 0;
      let currentRoundBets = 0;
      if (currentRound) {
        const currentRoundStats = await pool.query(
          "SELECT COUNT(DISTINCT user_id) as players, COALESCE(SUM(amount), 0) as total FROM bets WHERE round_id = $1",
          [currentRound.id],
        );
        activePlayers = parseInt(currentRoundStats.rows[0].players);
        currentRoundBets = parseFloat(currentRoundStats.rows[0].total);
      }

      res.json({
        success: true,
        data: {
          currentRound: currentRound
            ? {
              id: currentRound.id,
              roundNumber: currentRound.round_number,
              status: currentRound.status,
              startTime: currentRound.start_time,
              lockTime: currentRound.lock_time,
              endTime: currentRound.end_time,
            }
            : null,
          activePlayers,
          currentRoundBets,
          roundsToday: parseInt(roundsToday.rows[0].count),
          todayBetsTotal: parseFloat(todayBets.rows[0].total),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== USER MANAGEMENT ====================

  static async listUsers(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const search = req.query.search || "";

      let query = `
        SELECT u.id, u.uid, u.email, u.country, u.main_balance, u.is_banned, u.created_at,
               COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
               COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN b.amount ELSE 0 END), 0) as total_bets
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id AND t.type = 'deposit'
        LEFT JOIN bets b ON u.id = b.user_id
      `;

      const params = [];
      if (search) {
        // Check if search is numeric (UID search)
        const isNumeric = /^\d+$/.test(search);
        if (isNumeric) {
          query += ` WHERE u.uid = $1`;
          params.push(parseInt(search));
        } else {
          query += ` WHERE u.email ILIKE $1`;
          params.push(`%${search}%`);
        }
      }

      query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) FROM users";
      let countParams = [];
      if (search) {
        const isNumeric = /^\d+$/.test(search);
        if (isNumeric) {
          countQuery += " WHERE uid = $1";
          countParams.push(parseInt(search));
        } else {
          countQuery += " WHERE email ILIKE $1";
          countParams.push(`%${search}%`);
        }
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          users: result.rows.map((u) => ({
            id: u.id,
            uid: u.uid,
            email: u.email,
            country: u.country,
            balance: parseFloat(u.main_balance),
            totalDeposits: parseFloat(u.total_deposits),
            totalBets: parseFloat(u.total_bets),
            isBanned: u.is_banned,
            createdAt: u.created_at,
          })),
          total: parseInt(countResult.rows[0].count),
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async banUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;

      const user = await User.setBanStatus(userId, true);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      await AuditService.logAdminAction({
        adminId,
        action: "BAN_USER",
        resourceType: "user",
        resourceId: userId,
        payload: { banned: true },
        req,
      });

      res.json({
        success: true,
        message: "User banned successfully",
        data: { userId, isBanned: true },
      });
    } catch (error) {
      next(error);
    }
  }

  static async unbanUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;

      const user = await User.setBanStatus(userId, false);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      await AuditService.logAdminAction({
        adminId,
        action: "UNBAN_USER",
        resourceType: "user",
        resourceId: userId,
        payload: { banned: false },
        req,
      });

      res.json({
        success: true,
        message: "User unbanned successfully",
        data: { userId, isBanned: false },
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleUserBan(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;

      // Get current user status
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Toggle ban status
      const newBanStatus = !user.is_banned;
      const updatedUser = await User.setBanStatus(userId, newBanStatus);

      await AuditService.logAdminAction({
        adminId,
        action: newBanStatus ? "BAN_USER" : "UNBAN_USER",
        resourceType: "user",
        resourceId: userId,
        payload: { banned: newBanStatus },
        req,
      });

      res.json({
        success: true,
        message: `User ${newBanStatus ? "banned" : "unbanned"} successfully`,
        data: { userId, is_banned: updatedUser.is_banned },
      });
    } catch (error) {
      next(error);
    }
  }

  static async adjustBalance(req, res, next) {
    const client = await pool.connect();

    try {
      const { userId } = req.params;
      const { reason } = req.body;
      // Parse amount as number to handle string inputs from frontend
      const amount = parseFloat(req.body.amount);
      const adminId = req.user.userId;

      if (isNaN(amount) || amount === 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Valid non-zero amount is required",
          });
      }

      await client.query("BEGIN");

      // Verify user exists first
      const userExists = await client.query(
        "SELECT id FROM users WHERE id = $1",
        [userId],
      );
      if (userExists.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Get user with row lock (SINGLE SOURCE OF TRUTH: users.main_balance)
      const user = await User.getForUpdate(userId, client);
      const balanceBefore = parseFloat(user.main_balance);
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            message: "Insufficient balance for deduction",
          });
      }

      // Update users.main_balance (SINGLE SOURCE OF TRUTH)
      await User.updateBalance(userId, amount, client);

      // Record transaction
      await Transaction.create(
        {
          userId,
          type: amount > 0 ? "admin_credit" : "admin_debit",
          amount,
          balanceBefore,
          balanceAfter,
          status: "completed",
          referenceId: `ADJ-${Date.now()}`,
          description: reason || "Admin balance adjustment",
        },
        client,
      );

      await client.query("COMMIT");

      await AuditService.logAdminAction({
        adminId,
        action: "ADJUST_BALANCE",
        resourceType: "user",
        resourceId: userId,
        payload: { amount, reason, balanceBefore, balanceAfter },
        req,
      });

      res.json({
        success: true,
        message: "Balance adjusted successfully",
        data: { userId, amount, balanceBefore, balanceAfter },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }

  // ==================== WITHDRAWALS MANAGEMENT ====================

  static async listWithdrawals(req, res, next) {
    try {
      const status = req.query.status || "all";
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      let query = `
        SELECT w.*, u.email
        FROM withdrawals w
        JOIN users u ON w.user_id = u.id
      `;

      const params = [];
      if (status !== "all") {
        query += " WHERE w.status = $1";
        params.push(status);
      }

      query += ` ORDER BY w.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows.map((w) => ({
          id: w.id,
          userId: w.user_id,
          email: w.email,
          amount: parseFloat(w.amount),
          fee: parseFloat(w.fee),
          netAmount: parseFloat(w.net_amount),
          walletAddress: w.wallet_address,
          status: w.status,
          createdAt: w.created_at,
          processedAt: w.processed_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveWithdrawal(req, res, next) {
    const client = await pool.connect();

    try {
      const { withdrawalId } = req.params;
      const adminId = req.user.userId;

      await client.query("BEGIN");

      // Get withdrawal
      const withdrawalResult = await client.query(
        "SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE",
        [withdrawalId],
      );

      if (withdrawalResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, message: "Withdrawal not found" });
      }

      const withdrawal = withdrawalResult.rows[0];

      if (withdrawal.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Withdrawal already ${withdrawal.status}`,
        });
      }

      // Update withdrawal status
      await client.query(
        `UPDATE withdrawals SET status = 'approved', processed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [withdrawalId],
      );

      // Update transaction status
      await client.query(
        `UPDATE transactions SET status = 'completed' WHERE reference_id = $1`,
        [`WD-${withdrawalId}`],
      );

      // Deduct locked balance (withdrawal approved)
      await User.deductLockedBalance(
        withdrawal.user_id,
        parseFloat(withdrawal.amount),
        client,
      );

      await client.query("COMMIT");

      await AuditService.logAdminAction({
        adminId,
        action: "APPROVE_WITHDRAWAL",
        resourceType: "withdrawal",
        resourceId: withdrawalId.toString(),
        payload: {
          amount: withdrawal.net_amount,
          wallet_address: withdrawal.wallet_address,
        },
        req,
      });

      res.json({
        success: true,
        message: "Withdrawal approved successfully",
        data: { withdrawalId, status: "approved" },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }

  static async rejectWithdrawal(req, res, next) {
    const client = await pool.connect();

    try {
      const { withdrawalId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.userId;

      await client.query("BEGIN");

      // Get withdrawal
      const withdrawalResult = await client.query(
        "SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE",
        [withdrawalId],
      );

      if (withdrawalResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, message: "Withdrawal not found" });
      }

      const withdrawal = withdrawalResult.rows[0];

      if (withdrawal.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Withdrawal already ${withdrawal.status}`,
        });
      }

      // Update withdrawal status
      await client.query(
        `UPDATE withdrawals SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, notes = $1 WHERE id = $2`,
        [reason || "Rejected by admin", withdrawalId],
      );

      // Refund: unlock balance back to main_balance (SINGLE SOURCE OF TRUTH)
      await User.unlockBalance(
        withdrawal.user_id,
        parseFloat(withdrawal.amount),
        client,
      );

      // Update transaction
      await client.query(
        `UPDATE transactions SET status = 'cancelled', description = $1 WHERE reference_id = $2`,
        [
          `Withdrawal rejected: ${reason || "Rejected by admin"}`,
          `WD-${withdrawalId}`,
        ],
      );

      // Create refund transaction
      const userAfterRefund = await User.findById(withdrawal.user_id, client);
      await Transaction.create(
        {
          userId: withdrawal.user_id,
          type: "withdrawal_refund",
          amount: parseFloat(withdrawal.amount),
          balanceBefore:
            parseFloat(userAfterRefund.main_balance) -
            parseFloat(withdrawal.amount),
          balanceAfter: parseFloat(userAfterRefund.main_balance),
          status: "completed",
          referenceId: `REF-${withdrawalId}`,
          description: `Withdrawal refund: ${reason || "Rejected by admin"}`,
        },
        client,
      );

      await client.query("COMMIT");

      await AuditService.logAdminAction({
        adminId,
        action: "REJECT_WITHDRAWAL",
        resourceType: "withdrawal",
        resourceId: withdrawalId.toString(),
        payload: { amount: withdrawal.net_amount, reason },
        req,
      });

      res.json({
        success: true,
        message: "Withdrawal rejected and refunded",
        data: { withdrawalId, status: "rejected" },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }

  // ==================== GAME CONTROL ====================

  static async setManualOverride(req, res, next) {
    try {
      const { color, number } = req.body;
      const adminId = req.user.userId;

      if (!color && number === undefined) {
        return res.status(400).json({
          success: false,
          message: "Either color or number must be provided",
        });
      }

      const gameEngine = getGameEngine();
      const currentRound = await GameRound.getCurrent();

      // Store previous override state for audit
      const previousOverride = gameEngine.nextRoundOverride
        ? { ...gameEngine.nextRoundOverride }
        : null;

      // Set override for next round ONLY (stored in nextRoundOverride)
      gameEngine.nextRoundOverride = {
        color: color || null,
        number: number !== undefined ? number : null,
        setBy: adminId,
        setAt: new Date(),
        // Store which round was current when override was set (override applies AFTER this round)
        setDuringRound: currentRound ? currentRound.round_number : null,
      };

      await AuditService.logAdminAction({
        adminId,
        action: "SET_GAME_OVERRIDE",
        resourceType: "game",
        resourceId: "manual_override",
        payload: {
          color,
          number,
          previousState: previousOverride,
          newState: gameEngine.nextRoundOverride,
          currentRoundNumber: currentRound?.round_number,
          currentRoundStatus: currentRound?.status,
          appliesTo: "NEXT_ROUND_ONLY",
        },
        req,
      });

      res.json({
        success: true,
        message: `Manual override set. Will apply to round AFTER current round #${currentRound?.round_number || "N/A"}`,
        data: {
          color,
          number,
          currentRound: currentRound?.round_number,
          willApplyToNextRound: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async clearManualOverride(req, res, next) {
    try {
      const adminId = req.user.userId;
      const gameEngine = getGameEngine();

      // Store previous state for audit
      const previousOverride = gameEngine.nextRoundOverride
        ? { ...gameEngine.nextRoundOverride }
        : null;

      gameEngine.clearManualOverride(); // This clears both nextRoundOverride and manualOverride

      await AuditService.logAdminAction({
        adminId,
        action: "CLEAR_GAME_OVERRIDE",
        resourceType: "game",
        resourceId: "manual_override",
        payload: {
          previousState: previousOverride,
          newState: null,
          clearedManually: true,
        },
        req,
      });

      res.json({
        success: true,
        message: "Manual override cleared",
        data: {
          previousOverride: previousOverride
            ? {
              color: previousOverride.color,
              number: previousOverride.number,
            }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGameControlStatus(req, res, next) {
    try {
      const gameEngine = getGameEngine();
      const currentRound = await GameRound.getCurrent();
      const recentResults = await GameRound.getRecent(10);

      res.json({
        success: true,
        data: {
          currentRound: currentRound
            ? {
              id: currentRound.id,
              roundNumber: currentRound.round_number,
              status: currentRound.status,
              startTime: currentRound.start_time,
              lockTime: currentRound.lock_time,
              endTime: currentRound.end_time,
            }
            : null,
          manualOverride: gameEngine.nextRoundOverride || null,
          autoMode: !gameEngine.nextRoundOverride,
          isPaused: gameEngine.isPaused || false,
          recentResults: recentResults.map((r) => ({
            roundNumber: r.round_number,
            result: r.result,
            resultNumber: r.result_number,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANNOUNCEMENTS ====================

  static async createAnnouncement(req, res, next) {
    try {
      const { title, message, type, showAsPopup } = req.body;
      const adminId = req.user.userId;
      // If adminId is 'admin' (not a UUID), use NULL for created_by since it references users(id)
      const createdBy = adminId === "admin" ? null : adminId;

      const result = await pool.query(
        `INSERT INTO announcements (title, message, type, show_as_popup, created_by, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [title, message, type || "info", showAsPopup || false, createdBy],
      );

      await AuditService.logAdminAction({
        adminId,
        action: "CREATE_ANNOUNCEMENT",
        resourceType: "announcement",
        resourceId: result.rows[0].id.toString(),
        payload: { title, type },
        req,
      });

      res.status(201).json({
        success: true,
        message: "Announcement created successfully",
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAnnouncements(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT a.*, u.email as created_by_email
         FROM announcements a
         LEFT JOIN users u ON a.created_by = u.id
         ORDER BY a.created_at DESC LIMIT 50`,
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAnnouncement(req, res, next) {
    try {
      const { announcementId } = req.params;
      const adminId = req.user.userId;

      await pool.query("DELETE FROM announcements WHERE id = $1", [
        announcementId,
      ]);

      await AuditService.logAdminAction({
        adminId,
        action: "DELETE_ANNOUNCEMENT",
        resourceType: "announcement",
        resourceId: announcementId,
        payload: {},
        req,
      });

      res.json({
        success: true,
        message: "Announcement deleted",
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== REFERRAL STATS ====================

  static async getReferralStats(req, res, next) {
    try {
      // Total referrals
      const totalReferrals = await pool.query(
        "SELECT COUNT(*) as count FROM referrals WHERE referred_by IS NOT NULL",
      );

      // Today's commissions
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCommissions = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE created_at >= $1",
        [today],
      );

      // Total commissions
      const totalCommissions = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM commissions",
      );

      // Active promoters (users with referrals)
      const activePromoters = await pool.query(
        "SELECT COUNT(DISTINCT referred_by) as count FROM referrals WHERE referred_by IS NOT NULL",
      );

      // First recharge bonuses paid
      const firstRechargeBonuses = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'first_recharge_bonus'",
      );

      res.json({
        success: true,
        data: {
          totalReferrals: parseInt(totalReferrals.rows[0].count),
          todayCommissions: parseFloat(todayCommissions.rows[0].total),
          totalCommissions: parseFloat(totalCommissions.rows[0].total),
          activePromoters: parseInt(activePromoters.rows[0].count),
          firstRechargeBonuses: parseFloat(firstRechargeBonuses.rows[0].total),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SETTINGS ====================

  static async getSettings(req, res, next) {
    try {
      // Get all settings from promotion_config table
      const settingsResult = await pool.query(
        "SELECT key, value, description FROM promotion_config WHERE key LIKE 'setting_%' OR key IN ('site_name', 'support_email', 'support_whatsapp', 'telegram_channel', 'round_duration', 'min_bet', 'max_bet', 'house_edge', 'min_deposit', 'min_withdrawal', 'max_withdrawal', 'usdt_wallet_address')",
      );

      const settings = {};
      settingsResult.rows.forEach((row) => {
        settings[row.key] = row.value;
      });

      // Return with defaults for any missing settings
      res.json({
        success: true,
        data: {
          site_name: settings.site_name || "LuxWin",
          support_email: settings.support_email || "support@luxwin.com",
          support_whatsapp: settings.support_whatsapp || "+1234567890",
          telegram_channel: settings.telegram_channel || "@luxwin_official",
          round_duration: parseInt(settings.round_duration) || 180,
          min_bet: parseFloat(settings.min_bet) || 1,
          max_bet: parseFloat(settings.max_bet) || 1000,
          house_edge: parseFloat(settings.house_edge) || 5,
          min_deposit: parseFloat(settings.min_deposit) || 10,
          min_withdrawal: parseFloat(settings.min_withdrawal) || 20,
          max_withdrawal: parseFloat(settings.max_withdrawal) || 5000,
          usdt_wallet_address: settings.usdt_wallet_address || "",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const adminId = req.user.userId;
      const { category, settings } = req.body;

      if (!settings || typeof settings !== "object") {
        return res.status(400).json({
          success: false,
          message: "Settings object is required",
        });
      }

      const updates = [];
      const oldValues = {};

      for (const [key, value] of Object.entries(settings)) {
        // Get old value for audit
        const oldResult = await pool.query(
          "SELECT value FROM promotion_config WHERE key = $1",
          [key],
        );
        oldValues[key] = oldResult.rows[0]?.value || null;

        // Upsert setting
        await pool.query(
          `INSERT INTO promotion_config (key, value, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
          [key, value.toString(), `${category || "general"} setting`],
        );
        updates.push(key);
      }

      await AuditService.logAdminAction({
        adminId,
        action: "UPDATE_SETTINGS",
        resourceType: "settings",
        resourceId: category || "general",
        payload: {
          category,
          previousValues: oldValues,
          newValues: settings,
        },
        req,
      });

      res.json({
        success: true,
        message: "Settings updated successfully",
        data: { updatedKeys: updates },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== GAME PAUSE ====================

  static async pauseGame(req, res, next) {
    try {
      const adminId = req.user.userId;
      const gameEngine = getGameEngine();

      const previousState = gameEngine.isPaused || false;
      gameEngine.isPaused = true;

      await AuditService.logAdminAction({
        adminId,
        action: "PAUSE_GAME",
        resourceType: "game",
        resourceId: "game_state",
        payload: { previousState, newState: true },
        req,
      });

      res.json({
        success: true,
        message: "Game paused - no new rounds will start",
        data: { isPaused: true },
      });
    } catch (error) {
      next(error);
    }
  }

  static async resumeGame(req, res, next) {
    try {
      const adminId = req.user.userId;
      const gameEngine = getGameEngine();

      const previousState = gameEngine.isPaused || false;
      gameEngine.isPaused = false;

      // The round monitor will automatically create a new round when it detects
      // the game is no longer paused and no active round exists

      await AuditService.logAdminAction({
        adminId,
        action: "RESUME_GAME",
        resourceType: "game",
        resourceId: "game_state",
        payload: { previousState, newState: false },
        req,
      });

      res.json({
        success: true,
        message: "Game resumed - rounds will continue",
        data: { isPaused: false },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== USER DETAILS ====================

  static async getUserDetails(req, res, next) {
    try {
      const { userId } = req.params;

      // Get user info
      const userResult = await pool.query(
        `SELECT id, email, country, currency, main_balance, locked_balance, is_banned, created_at, is_admin
         FROM users WHERE id = $1`,
        [userId],
      );

      if (userResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const user = userResult.rows[0];

      // Get stats
      const statsResult = await pool.query(
        `SELECT
          COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = $1 AND type = 'deposit'), 0) as total_deposits,
          COALESCE((SELECT SUM(amount) FROM bets WHERE user_id = $1), 0) as total_bets,
          COALESCE((SELECT SUM(payout) FROM bets WHERE user_id = $1 AND result = 'win'), 0) as total_winnings,
          COALESCE((SELECT COUNT(*) FROM bets WHERE user_id = $1), 0) as total_bet_count,
          COALESCE((SELECT SUM(net_amount) FROM withdrawals WHERE user_id = $1 AND status = 'approved'), 0) as total_withdrawals`,
        [userId],
      );
      const stats = statsResult.rows[0];

      // Get recent transactions
      const transactionsResult = await pool.query(
        `SELECT type, amount, status, created_at, description
         FROM transactions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId],
      );

      // Get recent bets
      const betsResult = await pool.query(
        `SELECT b.round_number, b.choice, b.amount, b.result, b.payout, b.created_at
         FROM bets b WHERE b.user_id = $1
         ORDER BY b.created_at DESC LIMIT 10`,
        [userId],
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            country: user.country,
            currency: user.currency,
            balance: parseFloat(user.main_balance),
            isBanned: user.is_banned,
            isAdmin: user.is_admin,
            createdAt: user.created_at,
          },
          wallet: {
            balance: parseFloat(user.main_balance),
            lockedBalance: parseFloat(user.locked_balance || 0),
          },
          stats: {
            totalDeposits: parseFloat(stats.total_deposits),
            totalBets: parseFloat(stats.total_bets),
            totalWinnings: parseFloat(stats.total_winnings),
            totalBetCount: parseInt(stats.total_bet_count),
            totalWithdrawals: parseFloat(stats.total_withdrawals),
          },
          recentTransactions: transactionsResult.rows,
          recentBets: betsResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== WITHDRAWAL DETAILS ====================

  static async getWithdrawalDetails(req, res, next) {
    try {
      const { withdrawalId } = req.params;

      const result = await pool.query(
        `SELECT w.*, u.email, u.country, u.main_balance as current_balance
         FROM withdrawals w
         JOIN users u ON w.user_id = u.id
         WHERE w.id = $1`,
        [withdrawalId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Withdrawal not found" });
      }

      const w = result.rows[0];

      // Get user's withdrawal history
      const historyResult = await pool.query(
        `SELECT id, amount, net_amount, status, created_at, processed_at
         FROM withdrawals WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [w.user_id],
      );

      res.json({
        success: true,
        data: {
          withdrawal: {
            id: w.id,
            userId: w.user_id,
            email: w.email,
            country: w.country,
            amount: parseFloat(w.amount),
            fee: parseFloat(w.fee),
            netAmount: parseFloat(w.net_amount),
            walletAddress: w.wallet_address,
            status: w.status,
            notes: w.notes,
            createdAt: w.created_at,
            processedAt: w.processed_at,
            currentBalance: parseFloat(w.current_balance),
          },
          withdrawalHistory: historyResult.rows.map((h) => ({
            id: h.id,
            amount: parseFloat(h.amount),
            netAmount: parseFloat(h.net_amount),
            status: h.status,
            createdAt: h.created_at,
            processedAt: h.processed_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
