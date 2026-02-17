const express = require('express');
const { body } = require('express-validator');
const RedEnvelopeController = require('../controllers/redEnvelopeController');
const authenticateToken = require('../middlewares/auth');
const { validate, sanitizeInput } = require('../middlewares/validator');
const { redEnvelopeLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Get active red envelope for user
router.get('/active', authenticateToken, RedEnvelopeController.getActiveEnvelope);

// Claim red envelope
router.post(
  '/claim',
  authenticateToken,
  redEnvelopeLimiter,
  sanitizeInput,
  [
    body('code').notEmpty().withMessage('Red envelope code is required')
  ],
  validate,
  RedEnvelopeController.claimRedEnvelope
);

// Get user's claimed envelopes
router.get('/my-claims', authenticateToken, RedEnvelopeController.getMyClaimedEnvelopes);

module.exports = router;
