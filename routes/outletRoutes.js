// routes/OutletRoutes.js
const express = require('express');
const outletController = require('../controllers/outletController');
const outletProductController = require('../controllers/outletProductController');
const authController = require('../controllers/authController');
const { protect } = require('../controllers/authController');
const inviteController = require('../controllers/inviteController');

const router = express.Router();

// All routes require login
router.use(protect);

// Get my outlet
router.get('/my-outlet', outletController.getMyOutlet);

// Join to the outlet
router.post('/join/:token', inviteController.joinOutlet);
router.post('/:outletId/invite', inviteController.generateInvite);

// Add product to the outlet
router.route('/:outletId/products').post(outletController.addProductToOutlet);

// Outlets
router.get('/', outletController.getAllOutlets);
router.post('/', outletController.createOutlet);
router
  .route('/:outletId')
  .get(outletController.getOutlet)
  .patch(outletController.updateOutlet)
  .delete(outletController.deleteOutlet);

// Outlet products
router.get('/products/:outletId', outletProductController.getOutletProducts);
router
  .route('/product/:id')
  .get(outletProductController.getOutletProduct)
  .patch(outletProductController.updateOutletProduct)
  .delete(outletProductController.deleteOutletProduct);

router.get('/:outletId/low-stock', outletController.getLowStock);

module.exports = router;
