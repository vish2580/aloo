const crypto = require('crypto');

/**
 * Token Utilities for Password Reset
 * 
 * Generates cryptographically secure random tokens
 * and provides hashing functionality for secure storage
 */

/**
 * Generate a secure random token
 * @returns {string} 32-byte hex token (64 characters)
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * Used to store tokens securely in database
 * @param {string} token - Raw token to hash
 * @returns {string} Hashed token
 */
function hashToken(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

module.exports = {
    generateResetToken,
    hashToken
};
