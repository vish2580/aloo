const express = require('express');
const { body } = require('express-validator');
const UserController = require('../controllers/userController');
const authenticateToken = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

const router = express.Router();

// Get current user profile (JWT protected)
router.get('/me', authenticateToken, UserController.getMe);

// Get user balance (JWT protected)
router.get('/balance', authenticateToken, UserController.getBalance);

// Update user avatar (JWT protected)
router.put(
  '/avatar',
  authenticateToken,
  [
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  validate,
  UserController.updateAvatar
);

module.exports = router;
