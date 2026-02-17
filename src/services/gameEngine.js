const pool = require("../config/database");
const GameRound = require("../models/GameRound");
const Bet = require("../models/Bet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

class GameEngine {
  constructor() {
    this.roundDuration = parseInt(process.env.ROUND_DURATION_SECONDS || 180); // 3 minutes
    this.lockBeforeEnd = parseInt(process.env.BET_LOCK_BEFORE_SECONDS || 30); // 30 seconds lock phase
    this.currentRoundNumber = 0;
    this.manualOverride = null; // DEPRECATED: Use nextRoundOverride instead
    this.nextRoundOverride = null; // Admin can set this for NEXT round result (not current)
    this.isPaused = false; // Admin can pause the game

    // State tracking
    this.isProcessingRound = false;
    this.roundMonitorInterval = null;
    this.currentRoundId = null;

    // Timing constants
    this.MONITOR_INTERVAL_MS = 1000; // Check every 1 second
    this.NEW_ROUND_DELAY_MS = 2000; // 2 second delay between rounds
    this.SERVER_BUFFER_MS = 2000; // 2 second safety buffer
  }

  async initialize() {
    console.log("🎮 Game Engine initializing...");

    try {
      // Step 1: Recovery - Handle any orphaned rounds
      await this.recoverOrphanedRounds();

      // Step 2: Get last round number
      const lastRound = await this.getLastRound();
      if (lastRound) {
        this.currentRoundNumber = lastRound.round_number;
      }

      // Step 3: Check if there's an active round
      const activeRound = await GameRound.getCurrent();
      if (activeRound) {
        this.currentRoundId = activeRound.id;
        console.log(`✅ Resuming active round ${activeRound.round_number} (ID: ${activeRound.id})`);
      } else {
        console.log("✅ No active round found. Will create new round.");
      }

      // Step 4: Start the authoritative round monitor
      this.startRoundMonitor();

      console.log("✅ Game Engine initialized successfully");
    } catch (error) {
      console.error("❌ Game Engine initialization failed:", error);
      throw error;
    }
  }

  /**
   * CRITICAL: Authoritative round monitor
   * Runs every second and ensures rounds close on time
   * This is the single source of truth for round lifecycle
   */
  startRoundMonitor() {
    if (this.roundMonitorInterval) {
      clearInterval(this.roundMonitorInterval);
    }

    console.log("🔄 Starting authoritative round monitor (1s interval)");

    this.roundMonitorInterval = setInterval(async () => {
      try {
        await this.checkAndManageRound();
      } catch (error) {
        console.error("❌ Round monitor error:", error);
      }
    }, this.MONITOR_INTERVAL_MS);
  }

  /**
   * Main round management logic - called every second
   * Handles entire lifecycle: check -> lock -> end -> create new
   */
  async checkAndManageRound() {
    // Skip if game is paused
    if (this.isPaused) {
      return;
    }

    // Skip if already processing
    if (this.isProcessingRound) {
      return;
    }

    const now = new Date();
    const currentRound = await GameRound.getCurrent();

    // Case 1: No active round exists - create new one
    if (!currentRound) {
      await this.createNewRoundSafe();
      return;
    }

    this.currentRoundId = currentRound.id;
    const lockTime = new Date(currentRound.lock_time);
    const endTime = new Date(currentRound.end_time);

    // Case 2: Round should be locked but isn't
    if (now >= lockTime && currentRound.status === "betting") {
      await this.lockRoundSafe(currentRound.id);
    }

    // Case 3: Round should be ended (AUTHORITATIVE CHECK)
    if (now >= endTime && currentRound.status !== "completed") {
      await this.endRoundSafe(currentRound.id);
    }
  }

  /**
   * Recovery: Find and complete any orphaned rounds
   * Called on startup to handle server crashes/restarts
   */
  async recoverOrphanedRounds() {
    try {
      const query = `
        SELECT * FROM game_rounds
        WHERE status IN ('betting', 'locked')
        AND end_time < NOW()
        ORDER BY round_number ASC
      `;
      const result = await pool.query(query);
      const orphanedRounds = result.rows;

      if (orphanedRounds.length > 0) {
        console.log(`🔧 Found ${orphanedRounds.length} orphaned round(s). Recovering...`);

        for (const round of orphanedRounds) {
          console.log(`🔧 Recovering round ${round.round_number} (ID: ${round.id})`);
          await this.endRoundSafe(round.id);
        }

        console.log("✅ All orphaned rounds recovered");
      } else {
        console.log("✅ No orphaned rounds found");
      }
    } catch (error) {
      console.error("❌ Error recovering orphaned rounds:", error);
      // Don't throw - continue initialization
    }
  }

  /**
   * Get the last round (completed or active) to determine next round number
   */
  async getLastRound() {
    try {
      const query = `
        SELECT * FROM game_rounds
        ORDER BY round_number DESC
        LIMIT 1
      `;
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error("Error getting last round:", error);
      return null;
    }
  }

  /**
   * SAFE: Create new round with duplicate prevention
   */
  async createNewRoundSafe() {
    // Double-check no active round exists (race condition prevention)
    const existingRound = await GameRound.getCurrent();
    if (existingRound) {
      console.log(`⚠️ Active round already exists (${existingRound.round_number}). Skipping creation.`);
      this.currentRoundId = existingRound.id;
      return;
    }

    try {
      this.isProcessingRound = true;

      this.currentRoundNumber++;

      // CRITICAL: Apply nextRoundOverride to this new round (if set)
      // This ensures override only affects NEW rounds, never current rounds
      if (this.nextRoundOverride) {
        this.manualOverride = { ...this.nextRoundOverride };
        console.log(`🔧 Applying stored override to new round ${this.currentRoundNumber}:`, this.manualOverride);
        // Clear nextRoundOverride after transferring (one-time use)
        this.nextRoundOverride = null;
      }

      const now = new Date();
      const startTime = now;
      const lockTime = new Date(now.getTime() + (this.roundDuration - this.lockBeforeEnd) * 1000);
      const endTime = new Date(now.getTime() + this.roundDuration * 1000);

      const round = await GameRound.create({
        roundNumber: this.currentRoundNumber,
        startTime,
        lockTime,
        endTime,
      });

      this.currentRoundId = round.id;

      console.log(`✅ Round ${this.currentRoundNumber} created (ID: ${round.id}) - Betting open`);
      console.log(`   Lock at: ${lockTime.toISOString()}`);
      console.log(`   End at:  ${endTime.toISOString()}`);
    } catch (error) {
      // Handle unique constraint violation (duplicate round_number)
      if (error.code === "23505") {
        console.log(`⚠️ Round ${this.currentRoundNumber} already exists. Syncing...`);
        this.currentRoundNumber--; // Rollback increment
      } else {
        console.error("❌ Error creating round:", error);
        this.currentRoundNumber--; // Rollback increment
      }
    } finally {
      this.isProcessingRound = false;
    }
  }

  /**
   * SAFE: Lock round (idempotent)
   */
  async lockRoundSafe(roundId) {
    try {
      const round = await GameRound.getById(roundId);

      // Already locked or completed - skip
      if (round.status === "locked" || round.status === "completed") {
        return;
      }

      await GameRound.updateStatus(roundId, "locked");
      console.log(`🔒 Round ${round.round_number} locked - No more bets allowed`);
    } catch (error) {
      console.error("❌ Error locking round:", error);
    }
  }

  /**
   * SAFE: End round (idempotent, single execution guarantee)
   */
  async endRoundSafe(roundId) {
    try {
      // Get round with FOR UPDATE lock to prevent concurrent execution
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Lock the round row to prevent concurrent endRound calls
        const lockQuery = `
          SELECT * FROM game_rounds
          WHERE id = $1
          FOR UPDATE
        `;
        const lockResult = await client.query(lockQuery, [roundId]);
        const round = lockResult.rows[0];

        if (!round) {
          await client.query("ROLLBACK");
          console.log(`⚠️ Round ${roundId} not found`);
          return;
        }

        // Already completed - skip (idempotent)
        if (round.status === "completed") {
          await client.query("ROLLBACK");
          return;
        }

        console.log(`⏰ Round ${round.round_number} ending - Processing results...`);

        // Set processing flag
        this.isProcessingRound = true;

        // Generate result
        const result = this.generateResult();

        // Update round with result
        const updateQuery = `
          UPDATE game_rounds
          SET result = $1, result_number = $2, status = 'completed'
          WHERE id = $3
          RETURNING *
        `;
        await client.query(updateQuery, [result.color, result.number, roundId]);

        await client.query("COMMIT");

        // Clear manual override after using it
        if (this.manualOverride) {
          console.log(`🔧 Manual override applied: ${result.color} (${result.number})`);
          this.manualOverride = null;
        }

        console.log(`✅ Round ${round.round_number} result set: ${result.color} (${result.number})`);

        // Process bets (outside transaction to avoid long locks)
        await this.processBets(roundId, result.color);

        console.log(`✅ Round ${round.round_number} completed successfully`);

        // Clear current round ID
        this.currentRoundId = null;

        // Schedule new round creation after delay
        setTimeout(() => {
          this.isProcessingRound = false;
        }, this.NEW_ROUND_DELAY_MS);

      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("❌ Error ending round:", error);
      this.isProcessingRound = false;
    }
  }

  /**
   * Generate round result (auto or manual override)
   */
  generateResult() {
    // Check for manual override from admin
    if (this.manualOverride) {
      try {
        let number, color;

        if (this.manualOverride.number !== null && this.manualOverride.number !== undefined) {
          number = this.manualOverride.number;

          // Validate number
          if (number < 0 || number > 9) {
            throw new Error("Invalid override number");
          }

          // Determine color from number
          if (number === 0) {
            color = this.manualOverride.color || (Math.random() < 0.5 ? "red" : "purple");
          } else if (number % 2 === 0) {
            color = "red";
          } else {
            color = "green";
          }
        } else if (this.manualOverride.color) {
          color = this.manualOverride.color === "violet" ? "purple" : this.manualOverride.color;

          // Validate color
          if (!["red", "green", "purple"].includes(color)) {
            throw new Error("Invalid override color");
          }

          // Generate matching number
          if (color === "purple") {
            number = 0;
          } else if (color === "red") {
            const redNumbers = [2, 4, 6, 8];
            number = redNumbers[Math.floor(Math.random() * redNumbers.length)];
          } else {
            const greenNumbers = [1, 3, 5, 7, 9];
            number = greenNumbers[Math.floor(Math.random() * greenNumbers.length)];
          }
        } else {
          throw new Error("Invalid override");
        }

        return { number, color };
      } catch (error) {
        console.error("❌ Override failed, using auto mode:", error.message);
        this.manualOverride = null;
        // Fall through to auto generation
      }
    }

    // Auto mode: Generate random number 0-9
    const number = Math.floor(Math.random() * 10);

    let color;
    if (number === 0) {
      color = Math.random() < 0.5 ? "red" : "purple";
    } else if (number % 2 === 0) {
      color = "red";
    } else {
      color = "green";
    }

    return { number, color };
  }

  /**
   * Process all bets for completed round
   */
  async processBets(roundId, resultColor) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get only pending bets for this round
      const bets = await Bet.getPendingByRoundId(roundId, client);

      if (bets.length === 0) {
        await client.query("COMMIT");
        console.log(`💰 No bets to process for round ${roundId}`);
        return;
      }

      for (const bet of bets) {
        const userId = bet.user_id;
        const betAmount = parseFloat(bet.amount);
        const taxAmount = parseFloat(bet.tax_amount || 0);
        const stakeAmount = bet.stake_amount ? parseFloat(bet.stake_amount) : betAmount - taxAmount;
        const choice = bet.choice;

        let payout = 0;
        let result = "loss";

        // Calculate payout based on stake amount
        if (choice === resultColor) {
          result = "win";

          if (choice === "purple") {
            payout = stakeAmount * 9; // 9x for purple
          } else {
            payout = stakeAmount * 2; // 2x for red/green
          }
        }

        // Update bet result
        await Bet.updateResult(bet.id, result, payout, client);

        // Credit winnings
        if (result === "win" && payout > 0) {
          // Lock user row
          const user = await User.getForUpdate(userId, client);
          const balanceBefore = parseFloat(user.main_balance);
          const balanceAfter = balanceBefore + payout;

          // Update balance atomically
          await User.updateBalance(userId, payout, client);

          // Record win transaction
          await Transaction.create(
            {
              userId,
              type: "game_win",
              amount: payout,
              balanceBefore,
              balanceAfter,
              status: "completed",
              referenceId: `WIN-${bet.id}`,
              description: `Won ${choice} bet - Round ${bet.round_number}`,
            },
            client,
          );
        }
      }

      await client.query("COMMIT");
      console.log(`💰 Processed ${bets.length} bet(s) for round ${roundId}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("❌ Error processing bets:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Admin: Set manual override for NEXT round ONLY
   * CRITICAL: Stores in nextRoundOverride to prevent affecting current round
   */
  setManualOverride(override) {
    this.nextRoundOverride = override;
    console.log("🔧 Manual override set for NEXT round (will apply when new round is created):", override);
  }

  /**
   * Admin: Clear manual override
   */
  clearManualOverride() {
    this.nextRoundOverride = null;
    this.manualOverride = null; // Clear both for safety
    console.log("🔧 Manual override cleared");
  }

  /**
   * Admin: Pause game
   */
  pauseGame() {
    this.isPaused = true;
    console.log("⏸️ Game paused");
  }

  /**
   * Admin: Resume game
   */
  resumeGame() {
    this.isPaused = false;
    console.log("▶️ Game resumed");
  }

  /**
   * Cleanup on shutdown
   */
  shutdown() {
    if (this.roundMonitorInterval) {
      clearInterval(this.roundMonitorInterval);
      this.roundMonitorInterval = null;
    }
    console.log("🛑 Game Engine shut down");
  }
}

// Singleton instance
let gameEngineInstance = null;

const getGameEngine = () => {
  if (!gameEngineInstance) {
    gameEngineInstance = new GameEngine();
  }
  return gameEngineInstance;
};

module.exports = getGameEngine;
