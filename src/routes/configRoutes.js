const express = require('express');
const router = express.Router();
const { getWalletAddress } = require('../controllers/configController');

// GET /api/config/wallet - Get USDT TRC20 wallet address
router.get('/wallet', getWalletAddress);

module.exports = router;
