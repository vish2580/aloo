const express = require("express");
const router = express.Router();
const VIPController = require("../controllers/vipController");
const authMiddleware = require("../middlewares/auth");

// Get VIP status for current user
router.get("/status", authMiddleware, VIPController.getVIPStatus);

// Claim pending VIP bonus
router.post("/claim-bonus", authMiddleware, VIPController.claimBonus);

module.exports = router;
