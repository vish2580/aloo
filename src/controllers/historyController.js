const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');

class HistoryController {
  // Get Transaction History
  static async getTransactions(req, res, next) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const type = req.query.type; // Optional filter by type

      let transactions;
      if (type) {
        transactions = await Transaction.getByType(userId, type, limit);
      } else {
        transactions = await Transaction.getByUserId(userId, limit, offset);
      }

      res.json({
        success: true,
        data: transactions.map(txn => ({
          id: txn.id,
          type: txn.type,
          amount: parseFloat(txn.amount),
          balance_before: parseFloat(txn.balance_before),
          balance_after: parseFloat(txn.balance_after),
          status: txn.status,
          description: txn.description,
          reference_id: txn.reference_id,
          created_at: txn.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get Bet History
  static async getBets(req, res, next) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const bets = await Bet.getByUserId(userId, limit, offset);

      res.json({
        success: true,
        data: bets.map(bet => ({
          id: bet.id,
          round_number: bet.round_number,
          choice: bet.choice,
          amount: parseFloat(bet.amount),
          tax_amount: parseFloat(bet.tax_amount || 0),
          result: bet.result,
          payout: parseFloat(bet.payout || 0),
          round_result: bet.round_result,
          round_result_number: bet.result_number,
          profit: parseFloat(bet.payout || 0) - parseFloat(bet.amount),
          created_at: bet.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HistoryController;
