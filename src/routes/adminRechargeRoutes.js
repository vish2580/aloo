const express = require("express");
const { body, param, query } = require("express-validator");
const AdminRechargeController = require("../controllers/adminRechargeController");
const { authenticateAdmin } = require("../middlewares/adminAuth");
const { validate, sanitizeInput } = require("../middlewares/validator");

const router = express.Router();

/**
 * Admin Recharge Management Routes
 *
 * CRITICAL: All recharge approvals are atomic transactions
 * - Lock user row
 * - Credit users.main_balance
 * - Log transaction
 * - Mark request as approved
 * All in single DB transaction with rollback on failure
 */

// ==================== RECHARGE REQUEST MANAGEMENT ====================

/**
 * Get recharge statistics
 * GET /api/admin/recharge/stats
 * Returns: pending_count, approved_count, total_approved_amount, etc.
 */
router.get(
  "/stats",
  authenticateAdmin,
  sanitizeInput,
  AdminRechargeController.getStats,
);

/**
 * Get all pending recharge requests
 * GET /api/admin/recharge/pending
 * Query: limit, offset
 */
router.get(
  "/pending",
  authenticateAdmin,
  sanitizeInput,
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  validate,
  AdminRechargeController.getPendingRequests,
);

/**
 * Batch approve multiple recharge requests
 * POST /api/admin/recharge/batch-approve
 * Body: { request_ids: [1, 2, 3], admin_notes: "..." }
 *
 * Approves multiple requests in separate transactions
 * Returns: { approved: [...], failed: [...] }
 */
router.post(
  "/batch-approve",
  authenticateAdmin,
  sanitizeInput,
  [
    body("request_ids")
      .isArray({ min: 1, max: 100 })
      .withMessage("request_ids must be an array of 1-100 IDs"),
    body("request_ids.*")
      .isInt()
      .withMessage("Each request ID must be an integer"),
    body("admin_notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Admin notes must be a string (max 500 chars)"),
  ],
  validate,
  AdminRechargeController.batchApprove,
);

/**
 * Approve recharge request (ATOMIC OPERATION)
 * PUT /api/admin/recharge/:id/approve
 * Body: { admin_notes: "..." }
 *
 * This will:
 * 1. Lock user row (SELECT FOR UPDATE)
 * 2. Credit users.main_balance
 * 3. Insert transaction record
 * 4. Mark request as approved
 * 5. Trigger referral bonus (async)
 */
router.put(
  "/:id/approve",
  authenticateAdmin,
  sanitizeInput,
  [
    param("id").isInt().withMessage("Request ID must be an integer"),
    body("admin_notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Admin notes must be a string (max 500 chars)"),
  ],
  validate,
  AdminRechargeController.approveRequest,
);

/**
 * Reject recharge request
 * PUT /api/admin/recharge/:id/reject
 * Body: { admin_notes: "..." } (required)
 */
router.put(
  "/:id/reject",
  authenticateAdmin,
  sanitizeInput,
  [
    param("id").isInt().withMessage("Request ID must be an integer"),
    body("admin_notes")
      .notEmpty()
      .withMessage("Admin notes are required when rejecting")
      .isString()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage("Admin notes must be 5-500 characters"),
  ],
  validate,
  AdminRechargeController.rejectRequest,
);

/**
 * Get all recharge requests with filters
 * GET /api/admin/recharge/all
 * Query: status (pending/approved/rejected), user_id, limit, offset
 */
router.get(
  "/",
  authenticateAdmin,
  sanitizeInput,
  [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Status must be pending, approved, or rejected"),
    query("user_id")
      .optional()
      .isUUID()
      .withMessage("User ID must be a valid UUID"),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  validate,
  AdminRechargeController.getAllRequests,
);

/**
 * Get specific recharge request by ID
 * GET /api/admin/recharge/:id
 */
router.get(
  "/:id",
  authenticateAdmin,
  sanitizeInput,
  [param("id").isInt().withMessage("Request ID must be an integer")],
  validate,
  AdminRechargeController.getRequestById,
);

module.exports = router;
