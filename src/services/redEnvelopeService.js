const pool = require("../config/database");
const RedEnvelope = require("../models/RedEnvelope");
const RedEnvelopeClaim = require("../models/RedEnvelopeClaim");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

class RedEnvelopeService {
  // Claim red envelope
  static async claimEnvelope(code, userId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get envelope
      const envelope = await RedEnvelope.getByCode(code);
      if (!envelope) {
        throw new Error("Red envelope not found");
      }

      // Check if active
      if (!envelope.is_active) {
        throw new Error("Red envelope is no longer active");
      }

      // Check if expired
      if (envelope.expires_at) {
        const now = new Date();
        const expiryDate = new Date(envelope.expires_at);
        if (now > expiryDate) {
          throw new Error("Red envelope has expired");
        }
      }

      // Check if max claims reached
      if (envelope.current_claims >= envelope.max_claims) {
        throw new Error("Red envelope has been fully claimed");
      }

      // Check if user already claimed
      const alreadyClaimed = await RedEnvelopeClaim.hasClaimed(
        envelope.id,
        userId,
      );
      if (alreadyClaimed) {
        throw new Error("You have already claimed this red envelope");
      }

      // Check specific_user eligibility
      if (envelope.eligibility_rule === 'specific_user') {
        // Get user's UID
        const userResult = await client.query('SELECT uid FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          throw new Error("User not found");
        }
        const userUid = userResult.rows[0].uid;

        // Check if user's UID matches target UID
        if (userUid !== envelope.target_uid) {
          throw new Error("You are not eligible for this reward.");
        }
      }

      // Create claim record
      const claim = await RedEnvelopeClaim.create(
        {
          envelopeId: envelope.id,
          claimedBy: userId,
          amount: envelope.amount,
        },
        client,
      );

      // Increment claim count
      await RedEnvelope.incrementClaims(envelope.id, client);

      // Get current balance from user (SINGLE SOURCE OF TRUTH)
      const userBalance = await User.getBalance(userId, true, client);
      const balanceBefore = parseFloat(userBalance.main_balance);
      const balanceAfter = balanceBefore + parseFloat(envelope.amount);

      // Credit amount to user balance (SINGLE SOURCE OF TRUTH)
      await User.updateBalance(userId, parseFloat(envelope.amount), client);

      // Record transaction
      await Transaction.create(
        {
          userId,
          type: "red_envelope",
          amount: envelope.amount,
          balanceBefore,
          balanceAfter,
          status: "completed",
          referenceId: `RE-${envelope.id}`,
          description: `Red Envelope Reward +$${parseFloat(envelope.amount).toFixed(2)}`,
        },
        client,
      );

      // Deactivate if fully claimed
      const updatedEnvelope = await RedEnvelope.getById(envelope.id);
      if (updatedEnvelope.current_claims >= updatedEnvelope.max_claims) {
        await RedEnvelope.deactivate(envelope.id);
      }

      await client.query("COMMIT");

      return {
        claim,
        amount: parseFloat(envelope.amount),
        newBalance: balanceAfter,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = RedEnvelopeService;
