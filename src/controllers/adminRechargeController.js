const pool = require("../config/database");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const RechargeRequest = require("../models/RechargeRequest");
const ReferralService = require("../services/referralService");
const AuditService = require("../services/auditService");

/**
 * AdminRechargeController - Admin-only recharge approval system
 *
 * CRITICAL: Approval must be atomic
 * 1. Lock user row
 * 2. Credit users.main_balance
 * 3. Log transaction
 * 4. Mark request as approved
 * All in single DB transaction
 */
class AdminRechargeController {
  /**
   * Get all pending recharge requests
   * GET /api/admin/recharge/pending
   */
  static async getPendingRequests(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const requests = await RechargeRequest.getPending(limit, offset);

      res.json({
        success: true,
        data: requests.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          user_email: r.user_email,
          user_country: r.user_country,
          user_current_balance: parseFloat(r.user_current_balance),
          amount: parseFloat(r.amount),
          payment_method: r.payment_method,
          transaction_hash: r.transaction_hash,
          screenshot_url: r.screenshot_url,
          status: r.status,
          created_at: r.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recharge request by ID
   * GET /api/admin/recharge/:id
   */
  static async getRequestById(req, res, next) {
    try {
      const { id } = req.params;

      const request = await RechargeRequest.getById(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Recharge request not found",
        });
      }

      res.json({
        success: true,
        data: {
          id: request.id,
          user_id: request.user_id,
          user_email: request.user_email,
          user_country: request.user_country,
          amount: parseFloat(request.amount),
          payment_method: request.payment_method,
          transaction_hash: request.transaction_hash,
          screenshot_url: request.screenshot_url,
          status: request.status,
          admin_notes: request.admin_notes,
          approved_by: request.approved_by,
          approved_by_email: request.approved_by_email,
          created_at: request.created_at,
          approved_at: request.approved_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve recharge request
   * POST /api/admin/recharge/approve/:id
   *
   * ATOMIC OPERATION:
   * 1. Lock user row (SELECT FOR UPDATE)
   * 2. Credit users.main_balance
   * 3. Insert transaction record
   * 4. Mark recharge_request as approved
   * 5. Process referral bonus (async)
   */
  static async approveRequest(req, res, next) {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      const adminId = req.user.userId;

      console.log("[DEBUG] approveRequest called:");
      console.log("  - Request ID:", id, "Type:", typeof id);
      console.log("  - Admin ID:", adminId, "Type:", typeof adminId);

      // Start atomic transaction
      await client.query("BEGIN");

      // Get recharge request details
      const request = await RechargeRequest.getById(id, client);

      if (!request) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Recharge request not found",
        });
      }

      console.log("[DEBUG] Recharge request found:");
      console.log("  - Request user_id:", request.user_id, "Type:", typeof request.user_id);

      if (request.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Request already ${request.status}`,
          error_code: "REQUEST_ALREADY_PROCESSED",
        });
      }

      const userId = request.user_id;
      const amount = parseFloat(request.amount);

      console.log("[DEBUG] About to lock user row with userId:", userId);

      // CRITICAL: Lock user row and get current balance (prevents race conditions)
      const user = await User.getForUpdate(userId, client);

      if (!user) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.is_banned) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Cannot approve recharge for banned user",
        });
      }

      const balanceBefore = parseFloat(user.main_balance);
      const balanceAfter = balanceBefore + amount;

      // Credit users.main_balance (ATOMIC)
      await User.updateBalance(userId, amount, client);

      // Record transaction
      await Transaction.create(
        {
          userId,
          type: "recharge",
          amount,
          balanceBefore,
          balanceAfter,
          status: "completed",
          referenceId: `RECHARGE-${id}`,
          description: `Recharge approved by admin - ${request.payment_method}${request.transaction_hash ? ` - ${request.transaction_hash}` : ""}`,
        },
        client,
      );

      // Mark recharge request as approved
      // FIX: adminId might be 'admin' string, not UUID - set to NULL
      const approvedBy = (adminId === 'admin') ? null : adminId;
      const approvedRequest = await RechargeRequest.approve(
        id,
        approvedBy,
        admin_notes,
        client,
      );

      // Commit transaction
      await client.query("COMMIT");

      // Log approval action
      await AuditService.logAdminAction({
        adminId: adminId,
        actionType: "recharge_approve",
        targetUserId: userId,
        targetEntityType: "recharge_request",
        targetEntityId: id.toString(),
        actionData: {
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        },
        req,
      });

      // NOTE: First Reward is MANUAL (admin gives it via /api/admin/promotion/first-reward/credit)
      // No automatic processing here

      res.json({
        success: true,
        message: "Recharge request approved successfully",
        data: {
          request_id: approvedRequest.id,
          user_id: userId,
          amount: parseFloat(approvedRequest.amount),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          status: approvedRequest.status,
          approved_at: approvedRequest.approved_at,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error approving recharge:", error);
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Reject recharge request
   * POST /api/admin/recharge/reject/:id
   */
  static async rejectRequest(req, res, next) {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      const adminId = req.user.userId;

      if (!admin_notes || admin_notes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Admin notes are required when rejecting a request",
        });
      }

      await client.query("BEGIN");

      // Get request details
      const request = await RechargeRequest.getById(id, client);

      if (!request) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Recharge request not found",
        });
      }

      if (request.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Request already ${request.status}`,
          error_code: "REQUEST_ALREADY_PROCESSED",
        });
      }

      // Mark as rejected
      // FIX: adminId might be 'admin' string, not UUID - set to NULL
      const rejectedBy = (adminId === 'admin') ? null : adminId;
      const rejectedRequest = await RechargeRequest.reject(
        id,
        rejectedBy,
        admin_notes,
        client,
      );

      await client.query("COMMIT");

      // Log rejection action
      await AuditService.logAdminAction({
        adminId: adminId,
        actionType: "recharge_reject",
        targetUserId: request.user_id,
        targetEntityType: "recharge_request",
        targetEntityId: id.toString(),
        actionData: {
          amount: parseFloat(request.amount),
        },
        reason: admin_notes,
        req,
      });

      res.json({
        success: true,
        message: "Recharge request rejected",
        data: {
          request_id: rejectedRequest.id,
          status: rejectedRequest.status,
          admin_notes: rejectedRequest.admin_notes,
          approved_at: rejectedRequest.approved_at,
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
   * Get all recharge requests with filters
   * GET /api/admin/recharge/all
   */
  static async getAllRequests(req, res, next) {
    try {
      const status = req.query.status; // pending, approved, rejected
      const userId = req.query.user_id;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const requests = await RechargeRequest.getAll({
        status,
        userId,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: requests.map((r) => ({
          id: r.id,
          uid: r.uid,
          user_id: r.user_id,
          email: r.user_email,
          user_country: r.user_country,
          amount: parseFloat(r.amount),
          payment_method: r.payment_method,
          transaction_hash: r.transaction_hash,
          status: r.status,
          admin_notes: r.admin_notes,
          approved_by_email: r.approved_by_email,
          created_at: r.created_at,
          approved_at: r.approved_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recharge statistics
   * GET /api/admin/recharge/stats
   */
  static async getStats(req, res, next) {
    try {
      const stats = await RechargeRequest.getStats();

      res.json({
        success: true,
        data: {
          pending_count: parseInt(stats.pending_count),
          approved_count: parseInt(stats.approved_count),
          rejected_count: parseInt(stats.rejected_count),
          total_approved_amount: parseFloat(stats.total_approved_amount),
          total_pending_amount: parseFloat(stats.total_pending_amount),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch approve multiple requests
   * POST /api/admin/recharge/batch-approve
   * Body: { request_ids: [1, 2, 3], admin_notes: "..." }
   */
  static async batchApprove(req, res, next) {
    const client = await pool.connect();

    try {
      const { request_ids, admin_notes } = req.body;
      const adminId = req.user.userId;

      if (!Array.isArray(request_ids) || request_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "request_ids must be a non-empty array",
        });
      }

      if (request_ids.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Cannot approve more than 100 requests at once",
        });
      }

      const results = {
        approved: [],
        failed: [],
      };

      for (const requestId of request_ids) {
        const subClient = await pool.connect();

        try {
          await subClient.query("BEGIN");

          const request = await RechargeRequest.getById(requestId, subClient);

          if (!request || request.status !== "pending") {
            results.failed.push({
              request_id: requestId,
              reason: request
                ? `Already ${request.status}`
                : "Request not found",
            });
            await subClient.query("ROLLBACK");
            continue;
          }

          const userId = request.user_id;
          const amount = parseFloat(request.amount);

          const user = await User.getForUpdate(userId, subClient);

          if (!user || user.is_banned) {
            results.failed.push({
              request_id: requestId,
              reason: user ? "User is banned" : "User not found",
            });
            await subClient.query("ROLLBACK");
            continue;
          }

          const balanceBefore = parseFloat(user.main_balance);
          const balanceAfter = balanceBefore + amount;

          await User.updateBalance(userId, amount, subClient);

          await Transaction.create(
            {
              userId,
              type: "recharge",
              amount,
              balanceBefore,
              balanceAfter,
              status: "completed",
              referenceId: `RECHARGE-${requestId}`,
              description: `Recharge approved (batch) - ${request.payment_method}`,
            },
            subClient,
          );

          await RechargeRequest.approve(
            requestId,
            adminId,
            admin_notes,
            subClient,
          );

          await subClient.query("COMMIT");

          results.approved.push({
            request_id: requestId,
            user_id: userId,
            amount: amount,
          });

          // NOTE: First Reward is MANUAL (admin gives it separately)
        } catch (error) {
          await subClient.query("ROLLBACK");
          results.failed.push({
            request_id: requestId,
            reason: error.message,
          });
        } finally {
          subClient.release();
        }
      }

      res.json({
        success: true,
        message: `Batch approval completed: ${results.approved.length} approved, ${results.failed.length} failed`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminRechargeController;
