// routes/transactionRoutes.js
const express = require('express');
const transactionController = require('../controllers/transactionController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(transactionController.getAllTransactions)
  .post(transactionController.createTransaction);
router.get('/store/:outletId', transactionController.getStoreTransactions);
router.get('/store/:outletId/daily', transactionController.getDailyReport);
router.get('/store/:outletId/summary', transactionController.getIncomeSummary);

module.exports = router;
