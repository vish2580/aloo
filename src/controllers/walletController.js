const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Withdrawal = require("../models/Withdrawal");
const WithdrawalAttempt = require("../models/WithdrawalAttempt");
const RechargeRequest = require("../models/RechargeRequest");
const ReferralService = require("../services/referralService");
const AuditService = require("../services/auditService");
const VIPController = require("./vipController");

/**
 * WalletController - Manages user balance operations
 *
 * CRITICAL RULES:
 * - users.main_balance is the ONLY balance source
 * - All balance operations use row-level locking (FOR UPDATE)
 * - All operations are atomic within DB transactions
 * - Recharge requires admin approval
 */
class WalletController {
  /**
   * Get user balance
   * Returns balance from users.main_balance (single source of truth)
   */
  static async getBalance(req, res, next) {
    try {
      const userId = req.user.userId;

      const balance = await User.getBalance(userId);

      if (!balance) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: {
          main_balance: parseFloat(balance.main_balance),
          locked_balance: parseFloat(balance.locked_balance),
          available_balance: parseFloat(balance.main_balance),
          total_balance:
            parseFloat(balance.main_balance) +
            parseFloat(balance.locked_balance),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create recharge request (user submits)
   * Does NOT credit balance - requires admin approval
   */
  static async createRechargeRequest(req, res, next) {
    const client = await pool.connect();

    try {
      const userId = req.user.userId;
      const { amount, payment_method, transaction_hash, screenshot_url } =
        req.body;

      // Validate amount
      const minRecharge = parseFloat(process.env.MIN_RECHARGE_AMOUNT || 10);
      if (amount < minRecharge) {
        return res.status(400).json({
          success: false,
          message: `Minimum recharge amount is ${minRecharge} USD`,
        });
      }

      await client.query("BEGIN");

      // Check if user already has a pending request
      const hasPending = await RechargeRequest.hasPendingRequest(
        userId,
        client,
      );
      if (hasPending) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message:
            "You already have a pending recharge request. Please wait for approval.",
          error_code: "PENDING_REQUEST_EXISTS",
        });
      }

      // Create recharge request (status = pending)
      const request = await RechargeRequest.create(
        {
          userId,
          amount,
          paymentMethod: payment_method || "USDT_TRC20",
          transactionHash: transaction_hash,
          screenshotUrl: screenshot_url,
        },
        client,
      );

      await client.query("COMMIT");

      // Log request creation
      await AuditService.log({
        actorId: userId,
        action: "RECHARGE_REQUEST_CREATED",
        resourceType: "recharge_request",
        resourceId: request.id.toString(),
        payload: { amount, payment_method },
        req,
      });

      res.status(201).json({
        success: true,
        message:
          "Recharge request submitted successfully. Please wait for admin approval.",
        data: {
          request_id: request.id,
          amount: parseFloat(request.amount),
          payment_method: request.payment_method,
          status: request.status,
          created_at: request.created_at,
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
   * Get user's recharge history
   * DEDUPLICATION: Filters out APPROVED entries when COMPLETED transaction exists
   */
  static async getRechargeHistory(req, res, next) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const requests = await RechargeRequest.getByUserId(userId, limit, offset);

      // NEW APPROACH: Merge recharge_requests with transactions
      // Show COMPLETED transaction if it exists, otherwise show the recharge_request
      const mergedResults = [];

      for (const request of requests) {
        // Check if there's a COMPLETED transaction for this recharge
        const completedTxQuery = `
          SELECT id, amount, status, created_at
          FROM transactions 
          WHERE user_id = $1 
            AND reference_id = $2 
            AND type = 'recharge'
            AND status = 'completed'
          LIMIT 1
        `;
        const completedTxResult = await pool.query(completedTxQuery, [
          userId,
          `RECHARGE-${request.id}`
        ]);

        if (completedTxResult.rows.length > 0) {
          // COMPLETED transaction exists - show it with completed status
          const tx = completedTxResult.rows[0];
          mergedResults.push({
            id: request.id,
            amount: parseFloat(tx.amount),
            payment_method: request.payment_method,
            transaction_hash: request.transaction_hash,
            status: 'completed', // Show as completed
            admin_notes: request.admin_notes,
            created_at: request.created_at,
            approved_at: request.approved_at,
          });
        } else {
          // No completed transaction - show the recharge request as-is
          mergedResults.push({
            id: request.id,
            amount: parseFloat(request.amount),
            payment_method: request.payment_method,
            transaction_hash: request.transaction_hash,
            status: request.status, // pending, approved, or rejected
            admin_notes: request.admin_notes,
            created_at: request.created_at,
            approved_at: request.approved_at,
          });
        }
      }

      res.json({
        success: true,
        data: mergedResults,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request withdrawal
   * Locks balance atomically
   */
  static async requestWithdrawal(req, res, next) {
    console.log('\n[WITHDRAWAL] ========== REQUEST STARTED ==========');
    console.log('[WITHDRAWAL] User ID:', req.user?.userId);
    console.log('[WITHDRAWAL] Request body:', JSON.stringify(req.body, null, 2));

    const client = await pool.connect();
    console.log('[WITHDRAWAL] ✅ Database client acquired');

    try {
      const userId = req.user.userId;
      const { amount, withdrawal_password, wallet_address } = req.body;
      console.log('[WITHDRAWAL] Parsed params:', { amount, wallet_address, hasPassword: !!withdrawal_password });

      // Check if user is banned
      const userCheck = await User.findById(userId);
      if (userCheck.is_banned) {
        console.log('[WITHDRAWAL] ❌ User is banned, returning 403');
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended. Please contact support.",
          error_code: "ACCOUNT_BANNED",
        });
      }

      // Check if withdrawals are locked due to failed attempts
      console.log('[WITHDRAWAL] Checking if user is locked...');
      const isLocked = await WithdrawalAttempt.isLocked(userId);
      console.log('[WITHDRAWAL] Is locked:', isLocked);

      if (isLocked) {
        console.log('[WITHDRAWAL] ❌ User is locked, returning 403');
        return res.status(403).json({
          success: false,
          message:
            "Withdrawals are temporarily locked due to multiple failed attempts. Please try again in 30 minutes.",
          error_code: "WITHDRAWAL_LOCKED",
        });
      }

      // Validate minimum withdrawal
      const minWithdraw = parseFloat(process.env.MIN_WITHDRAW_AMOUNT || 50);
      console.log('[WITHDRAWAL] Checking minimum amount:', { amount, minWithdraw });

      if (amount < minWithdraw) {
        console.log('[WITHDRAWAL] ❌ Amount too low, returning 400');
        return res.status(400).json({
          success: false,
          message: `Minimum withdrawal amount is ${minWithdraw} USD`,
          error_code: "AMOUNT_TOO_LOW",
        });
      }

      // Verify withdrawal password
      console.log('[WITHDRAWAL] Fetching withdrawal password hash...');
      const storedWithdrawalPassword = await User.getWithdrawalPassword(userId);
      console.log('[WITHDRAWAL] Has withdrawal password:', !!storedWithdrawalPassword);

      // Check if withdrawal password is set
      if (!storedWithdrawalPassword) {
        console.log('[WITHDRAWAL] ❌ No withdrawal password set, returning 400');
        return res.status(400).json({
          success: false,
          message: "Withdrawal password not set. Please set your withdrawal password first.",
          error_code: "WITHDRAWAL_PASSWORD_NOT_SET",
        });
      }

      console.log('[WITHDRAWAL] Comparing passwords...');
      const isPasswordValid = await bcrypt.compare(
        withdrawal_password,
        storedWithdrawalPassword,
      );
      console.log('[WITHDRAWAL] Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('[WITHDRAWAL] ❌ Invalid password, incrementing failed attempts...');
        // Increment failed attempts
        const attempt = await WithdrawalAttempt.incrementFailed(userId);
        console.log('[WITHDRAWAL] Failed attempts:', attempt.failed_attempts);

        const remainingAttempts = Math.max(0, 3 - attempt.failed_attempts);

        if (attempt.locked_until) {
          console.log('[WITHDRAWAL] ❌ User now locked, returning 403');
          return res.status(403).json({
            success: false,
            message:
              "Too many failed attempts. Withdrawals locked for 30 minutes.",
            error_code: "WITHDRAWAL_LOCKED",
          });
        }

        console.log('[WITHDRAWAL] ❌ Returning invalid password error');
        return res.status(401).json({
          success: false,
          message: `Invalid withdrawal password. ${remainingAttempts} attempts remaining.`,
          error_code: "INVALID_WITHDRAWAL_PASSWORD",
        });
      }

      // Reset failed attempts on success
      console.log('[WITHDRAWAL] Resetting failed attempts...');
      await WithdrawalAttempt.reset(userId);
      console.log('[WITHDRAWAL] ✅ Failed attempts reset');

      // Check for pending withdrawals
      console.log('[WITHDRAWAL] Checking for pending withdrawals...');
      const pendingWithdrawals = await Withdrawal.getPendingByUserId(userId);
      console.log('[WITHDRAWAL] Pending withdrawals count:', pendingWithdrawals.length);

      if (pendingWithdrawals.length > 0) {
        console.log('[WITHDRAWAL] ❌ Has pending withdrawal, returning 400');
        return res.status(400).json({
          success: false,
          message:
            "You have a pending withdrawal. Please wait for it to be processed.",
        });
      }

      console.log('[WITHDRAWAL] Starting transaction...');
      await client.query("BEGIN");
      console.log('[WITHDRAWAL] ✅ Transaction started');

      // Lock user row and get balance (ATOMIC)
      console.log('[WITHDRAWAL] Locking user row and fetching balance...');
      const user = await User.getForUpdate(userId, client);
      const currentBalance = parseFloat(user.main_balance);
      console.log('[WITHDRAWAL] Current balance:', currentBalance);

      // Calculate fee based on VIP level (dynamic)
      const feePercent = await VIPController.getWithdrawalFee(userId, client);
      const fee = parseFloat(((amount * feePercent) / 100).toFixed(2));
      const netAmount = parseFloat((amount - fee).toFixed(2));
      const totalDeduction = amount;
      console.log('[WITHDRAWAL] Calculated:', {
        withdrawalAmount: amount,
        vipLevel: user.vip_level,
        feePercent: `${feePercent}%`,
        fee,
        netAmount,
        totalDeduction
      });

      // Check sufficient balance
      if (currentBalance < totalDeduction) {
        console.log('[WITHDRAWAL] ❌ Insufficient balance, rolling back');
        await client.query("ROLLBACK");
        console.log('[WITHDRAWAL] ✅ Rollback complete, returning 400');
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Required: ${totalDeduction.toFixed(2)} USD (${fee.toFixed(2)} USD fee will be deducted, you will receive ${netAmount.toFixed(2)} USD)`,
        });
      }

      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - totalDeduction;

      // Lock balance (move from main_balance to locked_balance)
      console.log('[WITHDRAWAL] Locking balance...');
      await User.lockBalance(userId, totalDeduction, client);
      console.log('[WITHDRAWAL] ✅ Balance locked');

      // Create withdrawal request
      console.log('[WITHDRAWAL] Creating withdrawal record...');
      const withdrawal = await Withdrawal.create({
        userId,
        amount,
        fee,
        netAmount,
        walletAddress: wallet_address,
      }, client);
      console.log('[WITHDRAWAL] ✅ Withdrawal created, ID:', withdrawal.id);

      // Record transaction
      console.log('[WITHDRAWAL] Creating transaction record...');
      await Transaction.create(
        {
          userId,
          type: "withdrawal_request",
          amount: -totalDeduction,
          balanceBefore,
          balanceAfter,
          status: "pending",
          referenceId: `WD-${withdrawal.id}`,
          description: `Withdrawal request to ${wallet_address}`,
        },
        client,
      );
      console.log('[WITHDRAWAL] ✅ Transaction record created');

      console.log('[WITHDRAWAL] Committing transaction...');
      await client.query("COMMIT");
      console.log('[WITHDRAWAL] ✅ Transaction committed');

      console.log('[WITHDRAWAL] Sending success response...');
      res.json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: {
          withdrawal_id: withdrawal.id,
          withdrawal_amount: amount,
          fee,
          fee_percent: feePercent,
          vip_level: user.vip_level,
          net_amount_received: netAmount,
          total_deducted: totalDeduction,
          status: "pending",
          wallet_address,
        },
      });
      console.log('[WITHDRAWAL] ✅ Response sent successfully');
      console.log('[WITHDRAWAL] ========== REQUEST COMPLETED ==========\n');
    } catch (error) {
      console.log('[WITHDRAWAL] ❌ ERROR CAUGHT:', error.message);
      console.log('[WITHDRAWAL] Error stack:', error.stack);
      console.log('[WITHDRAWAL] Rolling back transaction...');
      await client.query("ROLLBACK");
      console.log('[WITHDRAWAL] ✅ Rollback complete, passing to error handler');
      next(error);
    } finally {
      console.log('[WITHDRAWAL] Releasing database client...');
      client.release();
      console.log('[WITHDRAWAL] ✅ Client released');
    }
  }

  /**
   * Get withdrawal fee preview
   * Calculates fee based on user's VIP level
   */
  static async getWithdrawalFeePreview(req, res, next) {
    try {
      const userId = req.user.userId;
      const { amount } = req.query;

      // Validate amount
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid amount is required",
        });
      }

      const withdrawalAmount = parseFloat(amount);

      // Get user's VIP level and calculate fee
      const user = await User.findById(userId);
      const feePercent = await VIPController.getWithdrawalFee(userId);
      const fee = parseFloat(((withdrawalAmount * feePercent) / 100).toFixed(2));
      const netAmount = parseFloat((withdrawalAmount - fee).toFixed(2));

      res.json({
        success: true,
        data: {
          withdrawal_amount: withdrawalAmount,
          vip_level: user.vip_level,
          fee_percent: feePercent,
          fee,
          net_amount: netAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Get withdrawal history
   */
  static async getWithdrawals(req, res, next) {
    try {
      const userId = req.user.userId;
      const withdrawals = await Withdrawal.getByUserId(userId);

      res.json({
        success: true,
        data: withdrawals.map((w) => ({
          id: w.id,
          amount: parseFloat(w.amount),
          fee: parseFloat(w.fee),
          net_amount: parseFloat(w.net_amount),
          wallet_address: w.wallet_address,
          status: w.status,
          created_at: w.created_at,
          processed_at: w.processed_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get wallet transaction history
   * Returns all balance changes from transactions table
   */
  static async getTransactionHistory(req, res, next) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const type = req.query.type; // Optional filter by type

      const transactions = await Transaction.getByUserId(userId, {
        limit,
        offset,
        type,
      });

      res.json({
        success: true,
        data: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: parseFloat(t.amount),
          balance_before: parseFloat(t.balance_before),
          balance_after: parseFloat(t.balance_after),
          status: t.status,
          description: t.description,
          reference_id: t.reference_id,
          created_at: t.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = WalletController;
