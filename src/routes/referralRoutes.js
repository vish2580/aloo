const express = require("express");
const ReferralController = require("../controllers/referralController");
const authenticateToken = require("../middlewares/auth");

const router = express.Router();

/**
 * REFERRAL / PROMOTION ROUTES
 *
 * All endpoints provide READ-ONLY access to promotion data
 * Commission is already auto-credited to wallet (real-time)
 * Promotion page just mirrors this data
 */

// ============================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================

/**
 * Validate referral code (used during signup)
 * GET /api/referral/validate/:code
 */
router.get("/validate/:code", ReferralController.validateReferralCode);

// ============================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================

/**
 * Get user's referral info (code & link)
 * GET /api/referral/info
 */
router.get("/info", authenticateToken, ReferralController.getReferralInfo);

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
router.get("/stats", authenticateToken, ReferralController.getPromotionStats);

/**
 * Get users at specific level (for Level 1/2/3 tabs)
 * GET /api/referral/users/:level
 *
 * Params: level = 1, 2, or 3
 *
 * Returns array of users with:
 * - UID (formatted)
 * - Phone (if available)
 * - Water Reward (commission from this user)
 * - First Reward (if given)
 */
router.get(
  "/users/:level",
  authenticateToken,
  ReferralController.getUsersByLevel,
);

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
router.get(
  "/commissions",
  authenticateToken,
  ReferralController.getCommissionHistory,
);

/**
 * Get referral tree summary (who invited whom)
 * GET /api/referral/tree
 */
router.get("/tree", authenticateToken, ReferralController.getReferralTree);

/**
 * Get commission statistics summary
 * GET /api/referral/commission-stats
 */
router.get(
  "/commission-stats",
  authenticateToken,
  ReferralController.getCommissionStats,
);

module.exports = router;
