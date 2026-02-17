const pool = require("../config/database");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

/**
 * VIP Controller - Manages VIP level system
 * 
 * VIP Levels based on total_wager:
 * - VIP 0: $0 (default) - No bonus - 10% withdrawal fee
 * - VIP 1: $500 - $5 bonus - 8% withdrawal fee
 * - VIP 2: $2,000 - $10 bonus - 6% withdrawal fee
 * - VIP 3: $10,000 - $20 bonus - 4% withdrawal fee
 * - VIP 4: $50,000 - $50 bonus - 3% withdrawal fee
 * - VIP 5: $100,000 - $100 bonus - 2% withdrawal fee
 */

const VIP_LEVELS = [
    { level: 0, threshold: 0, bonus: 0, withdrawalFee: 10.0 },
    { level: 1, threshold: 500, bonus: 5, withdrawalFee: 8.0 },
    { level: 2, threshold: 2000, bonus: 10, withdrawalFee: 6.0 },
    { level: 3, threshold: 10000, bonus: 20, withdrawalFee: 4.0 },
    { level: 4, threshold: 50000, bonus: 50, withdrawalFee: 3.0 },
    { level: 5, threshold: 100000, bonus: 100, withdrawalFee: 2.0 },
];

class VIPController {
    /**
     * Get VIP status for current user
     */
    static async getVIPStatus(req, res, next) {
        try {
            const userId = req.user.userId;

            const vipData = await User.getVIPStatus(userId);
            if (!vipData) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const currentLevel = parseInt(vipData.vip_level);
            const totalWager = parseFloat(vipData.total_wager);

            // Find current level info
            const currentLevelInfo = VIP_LEVELS.find((l) => l.level === currentLevel);

            // Find next level
            const nextLevel = VIP_LEVELS.find((l) => l.level === currentLevel + 1);

            // Calculate progress
            let progress = 0;
            let requiredForNext = 0;

            if (nextLevel) {
                requiredForNext = nextLevel.threshold;
                const previousThreshold = currentLevelInfo.threshold;
                const range = requiredForNext - previousThreshold;
                const current = totalWager - previousThreshold;
                progress = Math.min(100, Math.max(0, (current / range) * 100));
            } else {
                // Max level reached
                progress = 100;
            }

            res.json({
                success: true,
                data: {
                    current_level: currentLevel,
                    total_wager: totalWager,
                    next_level: nextLevel ? nextLevel.level : null,
                    required_for_next: requiredForNext,
                    progress_percentage: Math.round(progress * 100) / 100,
                    pending_vip_bonus: parseFloat(vipData.pending_vip_bonus) || 0,
                    current_benefits: {
                        upgrade_bonus: currentLevelInfo.bonus,
                        withdrawal_fee: currentLevelInfo.withdrawalFee,
                    },
                    next_benefits: nextLevel
                        ? {
                            upgrade_bonus: nextLevel.bonus,
                            withdrawal_fee: nextLevel.withdrawalFee,
                        }
                        : null,
                    all_levels: VIP_LEVELS.map((level) => ({
                        level: level.level,
                        threshold: level.threshold,
                        bonus: level.bonus,
                        withdrawal_fee: level.withdrawalFee,
                    })),
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Check and upgrade VIP level if threshold crossed
     * Called internally after bet placement
     * MUST be called within a transaction
     */
    static async checkAndUpgrade(userId, client) {
        try {
            // Get current VIP status with row lock
            const user = await User.getForUpdate(userId, client);
            const currentLevel = parseInt(user.vip_level);
            const totalWager = parseFloat(user.total_wager);

            // Calculate appropriate level based on total wager
            let newLevel = 0;
            for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
                if (totalWager >= VIP_LEVELS[i].threshold) {
                    newLevel = VIP_LEVELS[i].level;
                    break;
                }
            }

            // Check if upgrade is needed
            if (newLevel > currentLevel) {
                console.log(
                    `🎖️ [VIP] User ${userId} upgrading from VIP ${currentLevel} to VIP ${newLevel}`,
                );

                // Upgrade VIP level
                await User.upgradeVIPLevel(userId, newLevel, client);

                // Credit upgrade bonus for each level crossed
                let totalBonus = 0;
                for (let level = currentLevel + 1; level <= newLevel; level++) {
                    const levelInfo = VIP_LEVELS.find((l) => l.level === level);
                    if (levelInfo && levelInfo.bonus > 0) {
                        totalBonus += levelInfo.bonus;
                    }
                }

                if (totalBonus > 0) {
                    // Add bonus to pending instead of auto-crediting
                    await User.addPendingVIPBonus(userId, totalBonus, client);

                    console.log(
                        `🎖️ [VIP] Added $${totalBonus} pending bonus for user ${userId} (must claim manually)`,
                    );
                }

                return {
                    upgraded: true,
                    old_level: currentLevel,
                    new_level: newLevel,
                    pending_bonus: totalBonus,
                };
            }

            return {
                upgraded: false,
                current_level: currentLevel,
            };
        } catch (error) {
            console.error("Error in VIP checkAndUpgrade:", error);
            throw error;
        }
    }

    /**
     * Get withdrawal fee percentage for user based on VIP level
     */
    static async getWithdrawalFee(userId, client = pool) {
        try {
            const vipData = await User.getVIPStatus(userId, client);
            const currentLevel = parseInt(vipData.vip_level);
            const levelInfo = VIP_LEVELS.find((l) => l.level === currentLevel);
            return levelInfo ? levelInfo.withdrawalFee : 10.0; // Default 10%
        } catch (error) {
            console.error("Error getting withdrawal fee:", error);
            return 10.0; // Default fallback
        }
    }

    /**
     * Claim pending VIP bonus
     */
    static async claimBonus(req, res, next) {
        const client = await pool.connect();
        try {
            const userId = req.user.userId;

            await client.query("BEGIN");

            // Get current pending bonus
            const vipData = await User.getVIPStatus(userId, client);
            const pendingBonus = parseFloat(vipData.pending_vip_bonus) || 0;

            if (pendingBonus <= 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "No pending VIP bonus to claim",
                });
            }

            // Get balance before claim
            const userBefore = await User.getForUpdate(userId, client);
            const balanceBefore = parseFloat(userBefore.main_balance);

            // Claim bonus (credits to balance and resets pending)
            const updatedUser = await User.claimPendingVIPBonus(userId, client);
            const balanceAfter = parseFloat(updatedUser.main_balance);

            // Create transaction record
            await Transaction.create(
                {
                    userId,
                    type: "vip_bonus_claimed",
                    amount: pendingBonus,
                    balanceBefore,
                    balanceAfter,
                    status: "completed",
                    referenceId: `VIP-CLAIM-${Date.now()}`,
                    description: `VIP Bonus Claimed`,
                },
                client,
            );

            await client.query("COMMIT");

            console.log(
                `🎖️ [VIP] User ${userId} claimed $${pendingBonus} VIP bonus`,
            );

            res.json({
                success: true,
                message: "VIP bonus claimed successfully",
                data: {
                    claimed_amount: pendingBonus,
                    new_balance: balanceAfter,
                },
            });
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Error claiming VIP bonus:", error);
            next(error);
        } finally {
            client.release();
        }
    }
}

module.exports = VIPController;
