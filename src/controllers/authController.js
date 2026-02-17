const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Referral = require("../models/Referral");
const { getRandomAvatar } = require("../utils/avatars");
const { generateReferralCode } = require("../utils/promotions");

class AuthController {
  /**
   * User Registration
   * Creates user with main_balance = 0
   * No wallet table - balance stored directly in users table
   */
  static async register(req, res, next) {
    try {
      const { email, password, withdrawal_password, country, referral_code } =
        req.body;

      console.log(`[AUTH] Registration attempt for email: ${email}`);

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.log(`[AUTH] Registration failed - email already exists: ${email}`);
        return res
          .status(409)
          .json({ success: false, message: "Email already registered" });
      }

      // Validate referral code if provided
      let referredBy = null;
      if (referral_code) {
        const referrer = await Referral.getByCode(referral_code);
        if (referrer) {
          referredBy = referrer.user_id;
        }
      }

      // Hash both passwords
      const passwordHash = await bcrypt.hash(password, 10);
      const withdrawalPasswordHash = await bcrypt.hash(withdrawal_password, 10);

      // Assign random avatar
      const avatar = getRandomAvatar();

      // Create user with main_balance = 0 (single source of truth)
      const user = await User.create({
        email,
        passwordHash,
        withdrawalPasswordHash,
        country,
        avatar,
        currency: "USD",
      });

      console.log(
        `[AUTH] ✅ Successfully created user ${user.id} (${email}) with main_balance: ${user.main_balance}`,
      );

      // Generate unique referral code for new user
      let userReferralCode = generateReferralCode();
      let codeExists = await Referral.getByCode(userReferralCode);

      // Ensure uniqueness
      while (codeExists) {
        userReferralCode = generateReferralCode();
        codeExists = await Referral.getByCode(userReferralCode);
      }

      // Create referral record
      await Referral.create({
        userId: user.id,
        referralCode: userReferralCode,
        referredBy,
        level: 1,
      });

      // Generate JWT token (userId only - minimal payload)
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "7d",
      });

      console.log(`[AUTH] ✅ Registration successful - Token issued for user ${user.id}`);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            uid: user.uid,
            email: user.email,
            country: user.country,
            avatar: user.avatar,
            currency: user.currency,
            main_balance: parseFloat(user.main_balance),
            locked_balance: parseFloat(user.locked_balance),
            is_banned: user.is_banned,
          },
          token,
        },
      });
    } catch (error) {
      console.error(`[AUTH] Registration error:`, error.message);
      next(error);
    }
  }

  /**
   * User Login
   * Fetches balance from users.main_balance (single source of truth)
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      console.log(`[AUTH] Login attempt for email: ${email}`);

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        console.log(`[AUTH] Login failed - user not found: ${email}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Check if banned
      if (user.is_banned) {
        console.log(`[AUTH] Login failed - account banned: ${email}`);
        return res
          .status(403)
          .json({ success: false, message: "Account is banned" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        console.log(`[AUTH] Login failed - invalid password: ${email}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Get balance from users table (single source of truth)
      const balance = await User.getBalance(user.id);

      // Generate JWT token (userId only - minimal payload)
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "7d",
      });

      console.log(`[AUTH] ✅ Login successful - Token issued for user ${user.id} (${email})`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            uid: user.uid,
            email: user.email,
            country: user.country,
            avatar: user.avatar,
            currency: user.currency,
            main_balance: parseFloat(balance.main_balance),
            locked_balance: parseFloat(balance.locked_balance),
            is_banned: user.is_banned,
          },
          token,
        },
      });
    } catch (error) {
      console.error(`[AUTH] Login error:`, error.message);
      next(error);
    }
  }

  /**
   * Forgot Password
   * Generates reset token and sends email
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      console.log(`[AUTH] Password reset requested for email: ${email}`);

      // Find user by email
      const user = await User.findByEmail(email);

      // SECURITY: Always return success message (don't reveal if email exists)
      if (!user) {
        console.log(`[AUTH] Password reset - user not found: ${email}`);
        return res.json({
          success: true,
          message: "If your account exists, you will receive a password reset email shortly."
        });
      }

      // Check if user is banned
      if (user.is_banned) {
        console.log(`[AUTH] Password reset - account banned: ${email}`);
        return res.json({
          success: true,
          message: "If your account exists, you will receive a password reset email shortly."
        });
      }

      // Generate reset token
      const { generateResetToken, hashToken } = require('../utils/tokenUtils');
      const resetToken = generateResetToken();
      const hashedToken = hashToken(resetToken);

      // Calculate expiry time
      const expiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRE_MINUTES) || 15;
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Save hashed token to database
      await User.setResetToken(email, hashedToken, expiresAt);

      console.log(`[AUTH] Reset token generated for user ${user.id} (${email}), expires at ${expiresAt.toISOString()}`);

      // Send reset email
      const emailService = require('../services/emailService');
      await emailService.sendPasswordResetEmail(email, resetToken);

      console.log(`[AUTH] ✅ Password reset email sent to ${email}`);

      res.json({
        success: true,
        message: "If your account exists, you will receive a password reset email shortly."
      });
    } catch (error) {
      console.error(`[AUTH] Forgot password error:`, error.message);

      // SECURITY: Don't expose internal errors
      res.json({
        success: true,
        message: "If your account exists, you will receive a password reset email shortly."
      });
    }
  }

  /**
   * Reset Password
   * Validates token and updates password
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      console.log(`[AUTH] Password reset attempt with token`);

      // Hash the incoming token
      const { hashToken } = require('../utils/tokenUtils');
      const hashedToken = hashToken(token);

      // Find user by valid token
      const user = await User.findByResetToken(hashedToken);

      if (!user) {
        console.log(`[AUTH] Password reset failed - invalid or expired token`);
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token"
        });
      }

      // Check if user is banned
      if (user.is_banned) {
        console.log(`[AUTH] Password reset failed - account banned: ${user.email}`);
        return res.status(403).json({
          success: false,
          message: "Account is banned"
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
      await User.updatePassword(user.id, newPasswordHash);
      await User.clearResetToken(user.id);

      console.log(`[AUTH] ✅ Password reset successful for user ${user.id} (${user.email})`);

      res.json({
        success: true,
        message: "Password reset successful. You can now login with your new password."
      });
    } catch (error) {
      console.error(`[AUTH] Reset password error:`, error.message);
      next(error);
    }
  }
}

module.exports = AuthController;
