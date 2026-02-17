const RedEnvelopeService = require('../services/redEnvelopeService');
const RedEnvelopeClaim = require('../models/RedEnvelopeClaim');
const RedEnvelope = require('../models/RedEnvelope');
const AuditService = require('../services/auditService');

class RedEnvelopeController {
  // Get active red envelope for user
  static async getActiveEnvelope(req, res, next) {
    try {
      const userId = req.user.userId;

      // Get the most recent active envelope (filtered by user eligibility)
      const envelope = await RedEnvelope.getActiveForUser(userId);

      if (!envelope) {
        return res.json({
          success: true,
          data: null,
          message: 'No active red envelope available'
        });
      }

      // Check if user already claimed this envelope
      const hasClaimed = await RedEnvelopeClaim.hasClaimed(envelope.id, userId);

      // Check eligibility (basic - can be extended with rules)
      let isEligible = true;
      let eligibilityMessage = '';

      // Check if max claims reached
      if (envelope.current_claims >= envelope.max_claims) {
        isEligible = false;
        eligibilityMessage = 'All envelopes have been claimed';
      }

      // Check if expired
      if (envelope.expires_at) {
        const now = new Date();
        const expiryDate = new Date(envelope.expires_at);
        if (now > expiryDate) {
          isEligible = false;
          eligibilityMessage = 'This envelope has expired';
        }
      }

      res.json({
        success: true,
        data: {
          code: envelope.code,
          amount: parseFloat(envelope.amount),
          isClaimed: hasClaimed,
          isEligible: isEligible && !hasClaimed,
          eligibilityMessage: hasClaimed ? 'Already claimed' : eligibilityMessage,
          expiresAt: envelope.expires_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Claim red envelope (User)
  static async claimRedEnvelope(req, res, next) {
    try {
      const userId = req.user.userId;
      const { code } = req.body;

      // Check if user is banned
      const User = require('../models/User');
      const userCheck = await User.findById(userId);
      if (userCheck.is_banned) {
        return res.status(403).json({
          success: false,
          message: "Your account has been suspended. Please contact support.",
          error_code: "ACCOUNT_BANNED",
        });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Red envelope code is required'
        });
      }

      const result = await RedEnvelopeService.claimEnvelope(code, userId);

      await AuditService.log({
        actorId: userId,
        action: 'RED_ENVELOPE_CLAIMED',
        resourceType: 'red_envelope',
        resourceId: code,
        payload: { amount: result.amount },
        req
      });

      res.json({
        success: true,
        message: 'Red envelope claimed successfully',
        data: {
          amount: result.amount,
          new_balance: result.newBalance,
          claimed_at: result.claim.claimed_at
        }
      });
    } catch (error) {
      if (error.message) {
        const errorCode = error.message.includes('not found') ? 'NOT_FOUND' :
          error.message.includes('expired') ? 'EXPIRED' :
            error.message.includes('already claimed') ? 'ALREADY_CLAIMED' :
              error.message.includes('fully claimed') ? 'FULLY_CLAIMED' : 'CLAIM_FAILED';

        await AuditService.logSecurityEvent({
          userId: req.user.userId,
          event: 'RED_ENVELOPE_CLAIM_FAILED',
          details: { code: req.body.code, reason: error.message },
          req,
          status: 'failed'
        });

        return res.status(400).json({
          success: false,
          message: error.message,
          error_code: errorCode
        });
      }
      next(error);
    }
  }

  // Get user's claimed red envelopes
  static async getMyClaimedEnvelopes(req, res, next) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 50;

      const claims = await RedEnvelopeClaim.getByUserId(userId, limit);

      res.json({
        success: true,
        data: claims.map(claim => ({
          id: claim.id,
          code: claim.envelope_code,
          amount: parseFloat(claim.amount),
          claimed_at: claim.claimed_at
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RedEnvelopeController;
