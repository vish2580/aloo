const pool = require("../config/database");

/**
 * RechargeRequest Model
 *
 * Handles user recharge requests with admin approval workflow
 * Status flow: pending → approved/rejected
 */
class RechargeRequest {
  /**
   * Create new recharge request (user submits)
   */
  static async create(
    {
      userId,
      amount,
      paymentMethod = "USDT_TRC20",
      transactionHash,
      screenshotUrl,
    },
    client = pool,
  ) {
    const query = `
      INSERT INTO recharge_requests (
        user_id,
        uid,
        amount,
        payment_method,
        transaction_hash,
        screenshot_url,
        status,
        notified
      )
      SELECT
        $1,
        u.uid,
        $2,
        $3,
        $4,
        $5,
        'pending',
        false
      FROM users u
      WHERE u.id = $1
      RETURNING *
    `;
    const result = await client.query(query, [
      userId,
      amount,
      paymentMethod,
      transactionHash,
      screenshotUrl,
    ]);
    return result.rows[0];
  }

  /**
   * Get recharge request by ID
   */
  static async getById(id, client = pool) {
    const query = `
      SELECT
        r.*,
        u.email as user_email,
        u.country as user_country,
        a.email as approved_by_email
      FROM recharge_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users a ON r.approved_by = a.id
      WHERE r.id = $1
    `;
    const result = await client.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get all pending recharge requests (admin view)
   */
  static async getPending(limit = 50, offset = 0, client = pool) {
    const query = `
      SELECT
        r.*,
        u.email as user_email,
        u.country as user_country,
        u.main_balance as user_current_balance
      FROM recharge_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
      LIMIT $1 OFFSET $2
    `;
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Get recharge requests by status
   */
  static async getByStatus(status, limit = 50, offset = 0, client = pool) {
    const query = `
      SELECT
        r.*,
        u.email as user_email,
        u.country as user_country
      FROM recharge_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(query, [status, limit, offset]);
    return result.rows;
  }

  /**
   * Get user's recharge history
   */
  static async getByUserId(userId, limit = 20, offset = 0, client = pool) {
    const query = `
      SELECT
        id,
        amount,
        payment_method,
        transaction_hash,
        status,
        admin_notes,
        created_at,
        approved_at
      FROM recharge_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await client.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Get pending request count (for admin dashboard)
   */
  static async getPendingCount(client = pool) {
    const query = `
      SELECT COUNT(*) as count
      FROM recharge_requests
      WHERE status = 'pending'
    `;
    const result = await client.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if user has pending request
   */
  static async hasPendingRequest(userId, client = pool) {
    const query = `
      SELECT id
      FROM recharge_requests
      WHERE user_id = $1 AND status = 'pending'
      LIMIT 1
    `;
    const result = await client.query(query, [userId]);
    return result.rows.length > 0;
  }

  /**
   * Approve recharge request
   * IMPORTANT: This only updates the request status
   * Balance update must be done separately in a transaction
   */
  static async approve(id, approvedBy, adminNotes = null, client = pool) {
    const query = `
      UPDATE recharge_requests
      SET
        status = 'approved',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        admin_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    const result = await client.query(query, [id, approvedBy, adminNotes]);

    if (result.rows.length === 0) {
      throw new Error("Request not found or already processed");
    }

    return result.rows[0];
  }

  /**
   * Reject recharge request
   */
  static async reject(id, approvedBy, adminNotes, client = pool) {
    const query = `
      UPDATE recharge_requests
      SET
        status = 'rejected',
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        admin_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;
    const result = await client.query(query, [id, approvedBy, adminNotes]);

    if (result.rows.length === 0) {
      throw new Error("Request not found or already processed");
    }

    return result.rows[0];
  }

  /**
   * Get all recharge requests with filters (admin view)
   */
  static async getAll(
    { status, userId, limit = 50, offset = 0 },
    client = pool,
  ) {
    let query = `
      SELECT
        r.*,
        u.uid,
        u.email as user_email,
        u.country as user_country,
        a.email as approved_by_email
      FROM recharge_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users a ON r.approved_by = a.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Only apply status filter if status is provided and not 'all'
    if (status && status !== 'all') {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (userId) {
      query += ` AND r.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    return result.rows;
  }

  /**
   * Get recharge statistics
   */
  static async getStats(client = pool) {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as total_approved_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as total_pending_amount
      FROM recharge_requests
    `;
    const result = await client.query(query);
    return result.rows[0];
  }

  /**
   * Delete old rejected requests (cleanup - optional)
   */
  static async deleteOldRejected(daysOld = 90, client = pool) {
    const query = `
      DELETE FROM recharge_requests
      WHERE status = 'rejected'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
      RETURNING id
    `;
    const result = await client.query(query);
    return result.rows.length;
  }
}

module.exports = RechargeRequest;
