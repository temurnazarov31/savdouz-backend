// routes/deliveryRoutes.js
const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.use(protect);

router.post('/', deliveryController.createDelivery);
router.get('/my', deliveryController.getAllMyDeliveries);
router.get('/outlet/:outletId', deliveryController.getDeliveries);

module.exports = router;