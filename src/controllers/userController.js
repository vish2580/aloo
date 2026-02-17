const User = require("../models/User");
const { getRandomAvatar } = require("../utils/avatars");

/**
 * UserController - Manages user profile and balance
 * CRITICAL: All balance operations use users.main_balance (single source of truth)
 */
class UserController {
  /**
   * Get current user profile
   * Returns user data with main_balance from users table
   */
  static async getMe(req, res, next) {
    try {
      const userId = req.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          country: user.country,
          avatar: user.avatar,
          currency: user.currency,
          main_balance: parseFloat(user.main_balance),
          locked_balance: parseFloat(user.locked_balance),
          available_balance: parseFloat(user.main_balance), // Same as main_balance
          is_banned: user.is_banned,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user balance
   * Returns balance from users.main_balance (single source of truth)
   */
  static async getBalance(req, res, next) {
    try {
      const userId = req.user.userId;

      // Read from users table - single source of truth
      const balance = await User.getBalance(userId);

      if (!balance) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        data: {
          main_balance: parseFloat(balance.main_balance),
          locked_balance: parseFloat(balance.locked_balance),
          available_balance: parseFloat(balance.main_balance),
          currency: "USD",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user avatar
   */
  static async updateAvatar(req, res, next) {
    try {
      const userId = req.user.userId;
      let { avatar } = req.body;

      // If no avatar provided, assign random one
      if (!avatar) {
        avatar = getRandomAvatar();
      }

      const updatedUser = await User.updateAvatar(userId, avatar);
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: "Avatar updated successfully",
        data: {
          id: updatedUser.id,
          uid: updatedUser.uid,
          email: updatedUser.email,
          country: updatedUser.country,
          avatar: updatedUser.avatar,
          currency: updatedUser.currency,
          main_balance: parseFloat(updatedUser.main_balance),
          locked_balance: parseFloat(updatedUser.locked_balance),
          is_banned: updatedUser.is_banned,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user statistics (for profile page)
   */
  static async getStats(req, res, next) {
    try {
      const userId = req.user.userId;

      // Get user balance
      const balance = await User.getBalance(userId);

      // You can add more stats here (total bets, total wins, etc.)
      // For now, returning basic balance info
      res.json({
        success: true,
        data: {
          main_balance: parseFloat(balance.main_balance),
          locked_balance: parseFloat(balance.locked_balance),
          available_balance: parseFloat(balance.main_balance),
          total_balance:
            parseFloat(balance.main_balance) +
            parseFloat(balance.locked_balance),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
