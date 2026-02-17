const express = require('express');
const HistoryController = require('../controllers/historyController');
const authenticateToken = require('../middlewares/auth');

const router = express.Router();

// Get Transaction History
router.get('/transactions', authenticateToken, HistoryController.getTransactions);

// Get Bet History
router.get('/bets', authenticateToken, HistoryController.getBets);

module.exports = router;
