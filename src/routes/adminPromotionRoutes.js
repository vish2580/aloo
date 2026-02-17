const express = require("express");
const { body } = require("express-validator");
const AdminPromotionController = require("../controllers/adminPromotionController");
const { authenticateAdmin } = require("../middlewares/adminAuth");
const { validate } = require("../middlewares/validator");

const router = express.Router();

// All routes require authentication AND admin role
// authenticateAdmin = JWT verification + is_admin check

// Red Envelope Management
router.post(
  "/red-envelopes",
  authenticateAdmin,
  [
    body("amount")
      .isFloat({ min: 1 })
      .withMessage("Amount must be greater than 0"),
    body("max_claims")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Max claims must be at least 1"),
    body("expires_in_hours")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Expiry must be positive"),
  ],
  validate,
  AdminPromotionController.createRedEnvelope,
);

router.get(
  "/red-envelopes",
  authenticateAdmin,
  AdminPromotionController.listRedEnvelopes,
);

router.get(
  "/red-envelopes/:envelope_id/claims",
  authenticateAdmin,
  AdminPromotionController.getEnvelopeClaims,
);

// Deactivate Red Envelope
router.post(
  "/red-envelopes/:envelope_id/deactivate",
  authenticateAdmin,
  AdminPromotionController.deactivateRedEnvelope,
);

// Promotion Configuration
router.get(
  "/config",
  authenticateAdmin,
  AdminPromotionController.getPromotionConfig,
);

router.put(
  "/config",
  authenticateAdmin,
  [
    body("key").notEmpty().withMessage("Config key is required"),
    body("value").notEmpty().withMessage("Config value is required"),
  ],
  validate,
  AdminPromotionController.updatePromotionConfig,
);

// Commission Rates
router.put(
  "/commission-rates",
  authenticateAdmin,
  [
    body("level_1")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Level 1 rate must be 0-100"),
    body("level_2")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Level 2 rate must be 0-100"),
    body("level_3")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Level 3 rate must be 0-100"),
  ],
  validate,
  AdminPromotionController.updateCommissionRates,
);

// First Recharge Bonus
router.put(
  "/first-recharge-bonus",
  authenticateAdmin,
  [
    body("enabled")
      .optional()
      .isBoolean()
      .withMessage("Enabled must be boolean"),
    body("bonus_percent")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Bonus percent must be 0-100"),
  ],
  validate,
  AdminPromotionController.updateFirstRechargeBonus,
);

// Bet Tax Configuration
router.get(
  "/bet-tax",
  authenticateAdmin,
  AdminPromotionController.getBetTaxConfig,
);

router.put(
  "/bet-tax",
  authenticateAdmin,
  [
    body("tax_percent")
      .isFloat({ min: 0, max: 50 })
      .withMessage("Tax percent must be between 0 and 50"),
  ],
  validate,
  AdminPromotionController.updateBetTaxConfig,
);

// ============================================================
// FIRST REWARD MANAGEMENT (MANUAL - ADMIN ONLY)
// ============================================================

/**
 * Get users eligible for first reward
 * GET /api/admin/promotion/first-reward/eligible
 */
router.get(
  "/first-reward/eligible",
  authenticateAdmin,
  AdminPromotionController.getEligibleForFirstReward,
);

/**
 * Credit first reward manually
 * POST /api/admin/promotion/first-reward/credit
 */
router.post(
  "/first-reward/credit",
  authenticateAdmin,
  [
    body("user_id").notEmpty().withMessage("user_id is required"),
    body("reward_amount")
      .isFloat({ min: 0.01 })
      .withMessage("reward_amount must be greater than 0"),
  ],
  validate,
  AdminPromotionController.creditFirstReward,
);

/**
 * Get first reward history
 * GET /api/admin/promotion/first-reward/history
 */
router.get(
  "/first-reward/history",
  authenticateAdmin,
  AdminPromotionController.getFirstRewardHistory,
);

/**
 * Get first reward statistics
 * GET /api/admin/promotion/first-reward/stats
 */
router.get(
  "/first-reward/stats",
  authenticateAdmin,
  AdminPromotionController.getFirstRewardStats,
);

module.exports = router;
