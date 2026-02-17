const pool = require("../config/database");

/**
 * User Model - Single Source of Truth for Balance
 *
 * CRITICAL RULES:
 * - users.main_balance is the ONLY balance field
 * - All balance reads/writes use row-level locking (FOR UPDATE)
 * - All balance operations are atomic within transactions
 * - No wallets table - everything in users table
 */
class User {
  /**
   * Create new user with main_balance = 0
   */
  static async create(
    {
      email,
      passwordHash,
      withdrawalPasswordHash,
      country,
      avatar,
      currency = "USD",
    },
    client = pool,
  ) {
    // Get next UID (auto-increment)
    const uidResult = await client.query(
      "SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM users",
    );
    const nextUid = uidResult.rows[0].next_uid;

    const query = `
      INSERT INTO users (
        email,
        password_hash,
        withdrawal_password_hash,
        country,
        avatar,
        main_balance,
        locked_balance,
        currency,
        is_banned,
        uid
      )
      VALUES ($1, $2, $3, $4, $5, 0.00, 0.00, $6, false, $7)
      RETURNING id, uid, email, country, avatar, currency, main_balance, locked_balance, is_banned, created_at
    `;
    const result = await client.query(query, [
      email,
      passwordHash,
      withdrawalPasswordHash,
      country,
      avatar,
      currency,
      nextUid,
    ]);
    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email, client = pool) {
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await client.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Find user by ID (UUID)
   */
  static async findById(id, client = pool) {
    const query = `
      SELECT
        id,
        uid,
        email,
        country,
        avatar,
        currency,
        main_balance,
        locked_balance,
        is_banned,
        is_admin,
        vip_level,
        total_wager,
        last_vip_upgrade,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await client.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find user by UID (numeric)
   */
  static async findByUid(uid, client = pool) {
    const query = `
      SELECT
        id,
        uid,
        email,
        country,
        avatar,
        currency,
        main_balance,
        locked_balance,
        is_banned,
        is_admin,
        vip_level,
        total_wager,
        last_vip_upgrade,
        created_at,
        updated_at
      FROM users
      WHERE uid = $1
    `;
    const result = await client.query(query, [uid]);
    return result.rows[0];
  }

  /**
   * Get balance with optional row locking
   * Use forUpdate=true when you need to update balance immediately after
   */
  static async getBalance(userId, forUpdate = false, client = pool) {
    const lockClause = forUpdate ? "FOR UPDATE" : "";
    const query = `
      SELECT main_balance, locked_balance
      FROM users
      WHERE id = $1
      ${lockClause}
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get full user with balance locked for update
   * CRITICAL: Use this inside transactions before balance operations
   */
  static async getForUpdate(userId, client) {
    const query = `
      SELECT
        id,
        uid,
        email,
        country,
        avatar,
        currency,
        main_balance,
        locked_balance,
        is_banned,
        is_admin,
        vip_level,
        total_wager,
        last_vip_upgrade,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      FOR UPDATE
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Update balance atomically
   * MUST be called within a transaction with prior row lock
   *
   * @param {UUID} userId
   * @param {number} amount - Can be positive (credit) or negative (debit)
   * @param {object} client - DB transaction client
   * @returns {object} Updated user with new balance
   */
  static async updateBalance(userId, amount, client) {
    // Validate client is provided (ensures we're in a transaction)
    if (!client || client === pool) {
      throw new Error(
        "updateBalance MUST be called within a transaction with a client",
      );
    }

    const query = `
      UPDATE users
      SET
        main_balance = main_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, main_balance, locked_balance
    `;
    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Lock balance (move from main_balance to locked_balance)
   * Used for pending withdrawals
   *
   * @param {UUID} userId
   * @param {number} amount - Amount to lock
   * @param {object} client - DB transaction client
   */
  static async lockBalance(userId, amount, client) {
    if (!client || client === pool) {
      throw new Error("lockBalance MUST be called within a transaction");
    }

    const query = `
      UPDATE users
      SET
        main_balance = main_balance - $1,
        locked_balance = locked_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND main_balance >= $1
      RETURNING id, main_balance, locked_balance
    `;
    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      throw new Error("Insufficient balance to lock");
    }

    return result.rows[0];
  }

  /**
   * Unlock balance (move from locked_balance back to main_balance)
   * Used when withdrawal is rejected or cancelled
   */
  static async unlockBalance(userId, amount, client) {
    if (!client || client === pool) {
      throw new Error("unlockBalance MUST be called within a transaction");
    }

    const query = `
      UPDATE users
      SET
        locked_balance = locked_balance - $1,
        main_balance = main_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND locked_balance >= $1
      RETURNING id, main_balance, locked_balance
    `;
    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      throw new Error("Insufficient locked balance to unlock");
    }

    return result.rows[0];
  }

  /**
   * Deduct locked balance (when withdrawal is approved/processed)
   */
  static async deductLockedBalance(userId, amount, client) {
    if (!client || client === pool) {
      throw new Error(
        "deductLockedBalance MUST be called within a transaction",
      );
    }

    const query = `
      UPDATE users
      SET
        locked_balance = locked_balance - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND locked_balance >= $1
      RETURNING id, main_balance, locked_balance
    `;
    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      throw new Error("Insufficient locked balance to deduct");
    }

    return result.rows[0];
  }

  /**
   * Get withdrawal password hash
   */
  static async getWithdrawalPassword(userId, client = pool) {
    const query = "SELECT withdrawal_password_hash FROM users WHERE id = $1";
    const result = await client.query(query, [userId]);
    return result.rows[0]?.withdrawal_password_hash;
  }

  /**
   * Update user avatar
   */
  static async updateAvatar(userId, avatar, client = pool) {
    const query = `
      UPDATE users
      SET avatar = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, uid, email, country, avatar, currency, main_balance, locked_balance, is_banned, created_at
    `;
    const result = await client.query(query, [avatar, userId]);
    return result.rows[0];
  }

  /**
   * Set user ban status
   */
  static async setBanStatus(userId, isBanned, client = pool) {
    const query = `
      UPDATE users
      SET is_banned = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await client.query(query, [isBanned, userId]);
    return result.rows[0];
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(userId, client = pool) {
    const query = "SELECT is_admin FROM users WHERE id = $1";
    const result = await client.query(query, [userId]);
    return result.rows[0]?.is_admin || false;
  }

  /**
   * Set admin status
   */
  static async setAdminStatus(userId, isAdmin, client = pool) {
    const query = `
      UPDATE users
      SET is_admin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await client.query(query, [isAdmin, userId]);
    return result.rows[0];
  }

  /**
   * Get all users (admin only)
   */
  static async getAll(limit = 100, offset = 0, client = pool) {
    const query = `
      SELECT
        id,
        uid,
        email,
        country,
        avatar,
        currency,
        main_balance,
        locked_balance,
        is_banned,
        is_admin,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Get user count
   */
  static async getCount(client = pool) {
    const query = "SELECT COUNT(*) as count FROM users";
    const result = await client.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get VIP status for a user
   */
  static async getVIPStatus(userId, client = pool) {
    const query = `
      SELECT vip_level, total_wager, last_vip_upgrade, pending_vip_bonus
      FROM users
      WHERE id = $1
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Update total wager atomically
   * MUST be called within a transaction
   */
  static async updateTotalWager(userId, amount, client) {
    if (!client || client === pool) {
      throw new Error(
        "updateTotalWager MUST be called within a transaction with a client",
      );
    }

    const query = `
      UPDATE users
      SET
        total_wager = total_wager + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, vip_level, total_wager
    `;
    const result = await client.query(query, [amount, userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Upgrade VIP level
   * MUST be called within a transaction
   */
  static async upgradeVIPLevel(userId, newLevel, client) {
    if (!client || client === pool) {
      throw new Error(
        "upgradeVIPLevel MUST be called within a transaction with a client",
      );
    }

    const query = `
      UPDATE users
      SET
        vip_level = $1,
        last_vip_upgrade = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, vip_level, total_wager, last_vip_upgrade
    `;
    const result = await client.query(query, [newLevel, userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Set password reset token and expiry
   * @param {string} email - User email
   * @param {string} hashedToken - Hashed reset token
   * @param {Date} expiresAt - Token expiry timestamp
   * @param {object} client - DB client
   */
  static async setResetToken(email, hashedToken, expiresAt, client = pool) {
    const query = `
      UPDATE users
      SET 
        reset_password_token = $1,
        reset_password_expires = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $3
      RETURNING id, email
    `;
    const result = await client.query(query, [hashedToken, expiresAt, email]);
    return result.rows[0];
  }

  /**
   * Find user by valid reset token
   * Token must exist and not be expired
   * @param {string} hashedToken - Hashed reset token
   * @param {object} client - DB client
   */
  static async findByResetToken(hashedToken, client = pool) {
    const query = `
      SELECT 
        id,
        uid,
        email,
        country,
        avatar,
        currency,
        main_balance,
        locked_balance,
        is_banned,
        reset_password_token,
        reset_password_expires
      FROM users
      WHERE reset_password_token = $1
        AND reset_password_expires > NOW()
    `;
    const result = await client.query(query, [hashedToken]);
    return result.rows[0];
  }

  /**
   * Update user password
   * @param {UUID} userId - User ID
   * @param {string} newPasswordHash - New hashed password
   * @param {object} client - DB client
   */
  static async updatePassword(userId, newPasswordHash, client = pool) {
    const query = `
      UPDATE users
      SET 
        password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email
    `;
    const result = await client.query(query, [newPasswordHash, userId]);
    return result.rows[0];
  }

  /**
   * Clear reset token after successful password reset
   * @param {UUID} userId - User ID
   * @param {object} client - DB client
   */
  static async clearResetToken(userId, client = pool) {
    const query = `
      UPDATE users
      SET 
        reset_password_token = NULL,
        reset_password_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Add pending VIP bonus (not auto-credited)
   * MUST be called within a transaction
   */
  static async addPendingVIPBonus(userId, bonusAmount, client) {
    if (!client || client === pool) {
      throw new Error(
        "addPendingVIPBonus MUST be called within a transaction with a client",
      );
    }

    const query = `
      UPDATE users
      SET
        pending_vip_bonus = pending_vip_bonus + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, pending_vip_bonus
    `;
    const result = await client.query(query, [bonusAmount, userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Claim pending VIP bonus and credit to main balance
   * MUST be called within a transaction
   */
  static async claimPendingVIPBonus(userId, client) {
    if (!client || client === pool) {
      throw new Error(
        "claimPendingVIPBonus MUST be called within a transaction with a client",
      );
    }

    const query = `
      UPDATE users
      SET
        main_balance = main_balance + pending_vip_bonus,
        pending_vip_bonus = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND pending_vip_bonus > 0
      RETURNING id, main_balance, pending_vip_bonus
    `;
    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found or no pending bonus`);
    }

    return result.rows[0];
  }
}

module.exports = User;
