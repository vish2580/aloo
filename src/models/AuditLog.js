const pool = require('../config/database');

class AuditLog {
  static async create({ actorId, action, resourceType = null, resourceId = null, payload = null, ipAddress = null, userAgent = null, status = 'success' }) {
    // If actorId is 'admin' (not a valid UUID), set to NULL
    const validActorId = actorId === 'admin' ? null : actorId;
    
    const query = `
      INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, payload, ip_address, user_agent, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(query, [
      validActorId,
      action,
      resourceType,
      resourceId,
      payload ? JSON.stringify(payload) : null,
      ipAddress,
      userAgent,
      status
    ]);
    return result.rows[0];
  }

  static async getByActor(actorId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM audit_logs 
      WHERE actor_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [actorId, limit, offset]);
    return result.rows;
  }

  static async getByAction(action, limit = 50) {
    const query = `
      SELECT * FROM audit_logs 
      WHERE action = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [action, limit]);
    return result.rows;
  }

  static async getRecent(limit = 100) {
    const query = `
      SELECT al.*, u.email as actor_email
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}

module.exports = AuditLog;
