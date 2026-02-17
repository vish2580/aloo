const express = require("express");
const { body, param } = require("express-validator");
const AdminController = require("../controllers/adminController");
const AdminReferralController = require("../controllers/adminReferralController");
const AdminSecurityController = require("../controllers/adminSecurityController");
const { authenticateAdmin, adminLogin } = require("../middlewares/adminAuth");
const { validate } = require("../middlewares/validator");

const router = express.Router();

// ==================== ADMIN LOGIN (No auth required) ====================
router.post("/login", adminLogin);

// All routes below require admin authentication
// authenticateAdmin = Admin JWT verification only (no database checks)

// ==================== DASHBOARD ====================
router.get(
  "/dashboard/stats",
  authenticateAdmin,
  AdminController.getDashboardStats,
);
router.get(
  "/dashboard/activity",
  authenticateAdmin,
  AdminController.getRecentActivity,
);
router.get(
  "/dashboard/live-game",
  authenticateAdmin,
  AdminController.getLiveGameStats,
);

// ==================== USER MANAGEMENT ====================
router.get("/users", authenticateAdmin, AdminController.listUsers);

router.post(
  "/users/:userId/ban",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminController.banUser,
);

router.post(
  "/users/:userId/unban",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminController.unbanUser,
);

router.post(
  "/users/:userId/toggle-ban",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminController.toggleUserBan,
);

router.post(
  "/users/:userId/adjust-balance",
  authenticateAdmin,
  [
    param("userId").isUUID().withMessage("Valid user ID required"),
    body("amount").isFloat().withMessage("Valid amount required"),
    body("reason").optional().isString(),
  ],
  validate,
  AdminController.adjustBalance,
);

// ==================== WITHDRAWALS ====================
router.get("/withdrawals", authenticateAdmin, AdminController.listWithdrawals);

router.post(
  "/withdrawals/:withdrawalId/approve",
  authenticateAdmin,
  [param("withdrawalId").isInt().withMessage("Valid withdrawal ID required")],
  validate,
  AdminController.approveWithdrawal,
);

router.post(
  "/withdrawals/:withdrawalId/reject",
  authenticateAdmin,
  [
    param("withdrawalId").isInt().withMessage("Valid withdrawal ID required"),
    body("reason").optional().isString(),
  ],
  validate,
  AdminController.rejectWithdrawal,
);

// ==================== GAME CONTROL ====================
router.get(
  "/game/status",
  authenticateAdmin,
  AdminController.getGameControlStatus,
);

router.post(
  "/game/override",
  authenticateAdmin,
  [
    body("color")
      .optional()
      .isIn(["red", "green", "purple", "violet"])
      .withMessage("Valid color required"),
    body("number")
      .optional()
      .isInt({ min: 0, max: 9 })
      .withMessage("Number must be 0-9"),
  ],
  validate,
  AdminController.setManualOverride,
);

router.delete(
  "/game/override",
  authenticateAdmin,
  AdminController.clearManualOverride,
);

router.post("/game/pause", authenticateAdmin, AdminController.pauseGame);
router.post("/game/resume", authenticateAdmin, AdminController.resumeGame);

// ==================== USER DETAILS ====================
router.get(
  "/users/:userId/details",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminController.getUserDetails,
);

// ==================== WITHDRAWAL DETAILS ====================
router.get(
  "/withdrawals/:withdrawalId/details",
  authenticateAdmin,
  [param("withdrawalId").isInt().withMessage("Valid withdrawal ID required")],
  validate,
  AdminController.getWithdrawalDetails,
);

// ==================== SETTINGS ====================
router.get("/settings", authenticateAdmin, AdminController.getSettings);

router.put(
  "/settings",
  authenticateAdmin,
  [
    body("category").optional().isString(),
    body("settings").isObject().withMessage("Settings object is required"),
  ],
  validate,
  AdminController.updateSettings,
);

// ==================== ANNOUNCEMENTS ====================
router.get(
  "/announcements",
  authenticateAdmin,
  AdminController.listAnnouncements,
);

router.post(
  "/announcements",
  authenticateAdmin,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("message").notEmpty().withMessage("Message is required"),
    body("type").optional().isIn(["info", "warning", "success", "promo"]),
    body("showAsPopup").optional().isBoolean(),
  ],
  validate,
  AdminController.createAnnouncement,
);

router.delete(
  "/announcements/:announcementId",
  authenticateAdmin,
  [
    param("announcementId")
      .isInt()
      .withMessage("Valid announcement ID required"),
  ],
  validate,
  AdminController.deleteAnnouncement,
);

// ==================== REFERRAL MANAGEMENT ====================
router.get(
  "/referrals/list",
  authenticateAdmin,
  AdminReferralController.getReferralList,
);
router.get(
  "/referrals/stats",
  authenticateAdmin,
  AdminReferralController.getReferralStats,
);

router.get(
  "/referrals/:inviterId/details",
  authenticateAdmin,
  [param("inviterId").isUUID().withMessage("Valid inviter ID required")],
  validate,
  AdminReferralController.getReferralDetails,
);

router.post(
  "/referrals/:inviterId/ban",
  authenticateAdmin,
  [
    param("inviterId").isUUID().withMessage("Valid inviter ID required"),
    body("scope")
      .isIn(["inviter", "team"])
      .withMessage("Scope must be inviter or team"),
    body("reason").notEmpty().withMessage("Reason is required"),
    body("revokeBonus").optional().isBoolean(),
  ],
  validate,
  AdminReferralController.banReferralTeam,
);

router.post(
  "/referrals/:inviterId/unban",
  authenticateAdmin,
  [
    param("inviterId").isUUID().withMessage("Valid inviter ID required"),
    body("scope")
      .isIn(["inviter", "team"])
      .withMessage("Scope must be inviter or team"),
    body("reason").optional().isString(),
  ],
  validate,
  AdminReferralController.unbanReferralTeam,
);

// ==================== SECURITY / FLAGS ====================
router.get(
  "/security/overview",
  authenticateAdmin,
  AdminSecurityController.getSecurityOverview,
);
router.get(
  "/security/flags",
  authenticateAdmin,
  AdminSecurityController.getFlaggedUsers,
);

router.get(
  "/security/users/:userId/flags",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminSecurityController.getUserSecurityDetails,
);

router.post(
  "/security/flags/:flagId/resolve",
  authenticateAdmin,
  [
    param("flagId").isInt().withMessage("Valid flag ID required"),
    body("resolution_notes")
      .notEmpty()
      .withMessage("Resolution notes are required"),
  ],
  validate,
  AdminSecurityController.resolveFlag,
);

router.post(
  "/security/users/:userId/analyze",
  authenticateAdmin,
  [param("userId").isUUID().withMessage("Valid user ID required")],
  validate,
  AdminSecurityController.analyzeUser,
);

router.get(
  "/security/same-ip/:ip",
  authenticateAdmin,
  AdminSecurityController.getUsersBySameIP,
);

router.get(
  "/security/same-device/:deviceId",
  authenticateAdmin,
  AdminSecurityController.getUsersBySameDevice,
);

router.post(
  "/security/batch-analyze",
  authenticateAdmin,
  [
    body("risk_level").optional().isIn(["red", "yellow", "all"]),
    body("limit").optional().isInt({ min: 1, max: 1000 }),
  ],
  validate,
  AdminSecurityController.batchAnalyze,
);

module.exports = router;
