const express = require("express");
const { body } = require("express-validator");
const GameController = require("../controllers/gameController");
const authenticateToken = require("../middlewares/auth");
const { validate, sanitizeInput } = require("../middlewares/validator");
const { betLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

// Get Current Round (PUBLIC - countdown visible to all)
router.get("/current-round", GameController.getCurrentRound);

// Place Bet
router.post(
  "/bet",
  authenticateToken,
  betLimiter,
  sanitizeInput,
  [
    body("choice")
      .isIn(["red", "green", "purple", "Red", "Green", "Purple"])
      .withMessage("Choice must be red, green, or purple"),
    body("amount")
      .isFloat({ min: 1 })
      .withMessage("Amount must be greater than 0"),
  ],
  validate,
  GameController.placeBet,
);

// Get Recent Results (PUBLIC - system game results available to all)
router.get("/results", GameController.getRecentResults);

// Get Top Winners (PUBLIC - for leaderboard display)
router.get("/top-winners", GameController.getTopWinners);

// Get Recent Winners (PUBLIC - for live winners feed)
router.get("/recent-winners", GameController.getRecentWinners);

// Get User's Bets for Current Round
router.get(
  "/current-bets",
  authenticateToken,
  GameController.getCurrentRoundBets,
);

module.exports = router;
