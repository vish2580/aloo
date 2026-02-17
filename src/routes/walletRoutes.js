const express = require("express");
const { body } = require("express-validator");
const WalletController = require("../controllers/walletController");
const authenticateToken = require("../middlewares/auth");
const { validate, sanitizeInput } = require("../middlewares/validator");
const { withdrawalLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

/**
 * Wallet Routes - Balance & Transaction Management
 *
 * CRITICAL: All operations use users.main_balance (single source of truth)
 * Recharge requires admin approval via recharge_requests table
 */

// ==================== BALANCE ====================

/**
 * Get user balance
 * GET /api/wallet/balance
 * Returns: main_balance, locked_balance, available_balance
 */
router.get("/balance", authenticateToken, WalletController.getBalance);

// ==================== RECHARGE (Admin Approval Required) ====================

/**
 * Create recharge request (does NOT credit balance immediately)
 * POST /api/wallet/recharge-request
 * Body: { amount, payment_method, transaction_hash, screenshot_url }
 * Status: pending → admin approves → balance credited
 */
router.post(
  "/recharge-request",
  authenticateToken,
  sanitizeInput,
  [
    body("amount")
      .isFloat({ min: 1 })
      .withMessage("Amount must be greater than 0"),
    body("payment_method")
      .optional()
      .isString()
      .isIn(["USDT_TRC20", "USDT_ERC20", "BTC", "ETH", "BANK_TRANSFER"])
      .withMessage("Invalid payment method"),
    body("transaction_hash")
      .optional()
      .isString()
      .trim()
      .withMessage("Transaction hash must be a string"),
    body("screenshot_url")
      .optional()
      .isURL()
      .withMessage("Screenshot URL must be valid"),
  ],
  validate,
  WalletController.createRechargeRequest,
);

/**
 * Get user's recharge history
 * GET /api/wallet/recharge-history
 * Query params: limit, offset
 * Returns: List of recharge requests (pending/approved/rejected)
 */
router.get(
  "/recharge-history",
  authenticateToken,
  WalletController.getRechargeHistory,
);

// ==================== WITHDRAWAL ====================

/**
 * Request withdrawal
 * POST /api/wallet/withdraw
 * Body: { amount, withdrawal_password, wallet_address }
 * Locks balance immediately, processed by admin later
 */
router.post(
  "/withdraw",
  authenticateToken,
  withdrawalLimiter,
  sanitizeInput,
  [
    body("amount")
      .isFloat({ min: 1 })
      .withMessage("Amount must be greater than 0"),
    body("withdrawal_password")
      .notEmpty()
      .withMessage("Withdrawal password is required"),
    body("wallet_address")
      .notEmpty()
      .isLength({ min: 10 })
      .withMessage("Valid wallet address is required"),
  ],
  validate,
  WalletController.requestWithdrawal,
);

/**
 * Get withdrawal fee preview
 * GET /api/wallet/withdrawal-fee-preview?amount=100
 * Returns: VIP-based fee calculation
 */
router.get(
  "/withdrawal-fee-preview",
  authenticateToken,
  WalletController.getWithdrawalFeePreview,
);

/**
 * Get withdrawal history
 * GET /api/wallet/withdrawals
 * Returns: List of withdrawal requests
 */
router.get("/withdrawals", authenticateToken, WalletController.getWithdrawals);

// ==================== TRANSACTION HISTORY ====================

/**
 * Get transaction history
 * GET /api/wallet/transactions
 * Query params: limit, offset, type
 * Returns: All balance changes (bets, wins, recharges, withdrawals, commissions)
 */
router.get(
  "/transactions",
  authenticateToken,
  WalletController.getTransactionHistory,
);

// ==================== DEPRECATED ROUTES ====================

/**
 * OLD: Direct add-funds (REMOVED - use recharge-request instead)
 * Reason: Recharge must be approved by admin to prevent fraud
 */
// router.post('/add-funds', ...) // REMOVED

module.exports = router;
