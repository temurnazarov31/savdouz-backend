// routes/transactionRoutes.js
const express = require('express');
const transactionController = require('../controllers/transactionController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.use(protect);

// Transactions
router
  .route('/')
  .get(transactionController.getAllTransactions)
  .post(transactionController.createTransaction);
router.get('/outlet/:outletId', transactionController.getStoreTransactions);

// Reports
router.get('/outlet/:outletId/daily', transactionController.getDailyReport);
router.get('/outlet/:outletId/summary', transactionController.getIncomeSummary);

module.exports = router;
