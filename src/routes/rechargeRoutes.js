const express = require("express");
const { body, param } = require("express-validator");
const authenticateToken = require("../middlewares/auth");
const { validate, sanitizeInput } = require("../middlewares/validator");
const pool = require("../config/database");
const RechargeRequest = require("../models/RechargeRequest");

const router = express.Router();

/**
 * User-side Recharge Routes
 * 
 * POST /api/recharge/request - Create recharge request
 * GET /api/recharge/my-status - Get unnotified approved/rejected requests
 * PATCH /api/recharge/mark-notified/:id - Mark request as notified
 */

/**
 * Create recharge request
 * POST /api/recharge/request
 * Body: { amount }
 */
router.post(
    "/request",
    authenticateToken,
    sanitizeInput,
    [
        body("amount")
            .isFloat({ min: 1 })
            .withMessage("Amount must be greater than 0"),
    ],
    validate,
    async (req, res, next) => {
        try {
            const { amount } = req.body;
            const userId = req.user.userId;

            // Check if user is banned
            const User = require("../models/User");
            const userCheck = await User.findById(userId);
            if (userCheck.is_banned) {
                return res.status(403).json({
                    success: false,
                    message: "Your account has been suspended. Please contact support.",
                });
            }

            // Validate minimum recharge amount
            const minRecharge = parseFloat(process.env.MIN_RECHARGE_AMOUNT || 10);
            if (amount < minRecharge) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum recharge amount is ${minRecharge} USD`,
                });
            }

            // Check if user already has a pending request
            const hasPending = await RechargeRequest.hasPendingRequest(userId);
            if (hasPending) {
                return res.status(400).json({
                    success: false,
                    message:
                        "You already have a pending recharge request. Please wait for approval.",
                });
            }

            // Create recharge request (status = pending, notified = false by default)
            const request = await RechargeRequest.create({
                userId,
                amount,
                paymentMethod: "USDT_TRC20",
                transactionHash: null,
                screenshotUrl: null,
            });

            res.json({
                success: true,
                message:
                    "Recharge request submitted successfully. Please wait for admin approval.",
                data: {
                    request_id: request.id,
                    amount: parseFloat(request.amount),
                    status: request.status,
                    created_at: request.created_at,
                },
            });
        } catch (error) {
            next(error);
        }
    },
);

/**
 * Get user's unnotified approved/rejected requests
 * GET /api/recharge/my-status
 * Returns requests that need to show popup notification
 */
router.get("/my-status", authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const query = `
      SELECT
        id,
        amount,
        status,
        admin_notes,
        approved_at,
        created_at
      FROM recharge_requests
      WHERE user_id = $1
        AND status IN ('approved', 'rejected')
        AND notified = false
      ORDER BY approved_at DESC
      LIMIT 10
    `;

        const result = await pool.query(query, [userId]);

        res.json({
            success: true,
            data: result.rows.map((r) => ({
                id: r.id,
                amount: parseFloat(r.amount),
                status: r.status,
                admin_notes: r.admin_notes,
                approved_at: r.approved_at,
                created_at: r.created_at,
            })),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Mark recharge request as notified
 * PATCH /api/recharge/mark-notified/:id
 * Called after user sees the popup notification
 */
router.patch(
    "/mark-notified/:id",
    authenticateToken,
    sanitizeInput,
    [param("id").isInt().withMessage("Request ID must be an integer")],
    validate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.userId;

            const query = `
        UPDATE recharge_requests
        SET notified = true
        WHERE id = $1 AND user_id = $2
        RETURNING id, status
      `;

            const result = await pool.query(query, [id, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Recharge request not found",
                });
            }

            res.json({
                success: true,
                message: "Notification marked as seen",
                data: {
                    id: result.rows[0].id,
                    status: result.rows[0].status,
                },
            });
        } catch (error) {
            next(error);
        }
    },
);

module.exports = router;
