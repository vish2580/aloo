const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const { validate, sanitizeInput } = require('../middlewares/validator');
const { authLimiter, registerLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Register
router.post(
  '/register',
  registerLimiter,
  sanitizeInput,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('withdrawal_password')
      .isLength({ min: 6 })
      .withMessage('Withdrawal password must be at least 6 characters'),
    body('country').notEmpty().withMessage('Country is required'),
    body('referral_code').optional().isString().withMessage('Invalid referral code')
  ],
  validate,
  AuthController.register
);

// Login
router.post(
  '/login',
  authLimiter,
  sanitizeInput,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  AuthController.login
);

// Forgot Password
router.post(
  '/forgot-password',
  authLimiter, // 5 requests per 15 minutes
  sanitizeInput,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  validate,
  AuthController.forgotPassword
);

// Reset Password
router.post(
  '/reset-password',
  authLimiter, // 5 requests per 15 minutes
  sanitizeInput,
  [
    body('token').notEmpty().isString().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ],
  validate,
  AuthController.resetPassword
);

module.exports = router;
