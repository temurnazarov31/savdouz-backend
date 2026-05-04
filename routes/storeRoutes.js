// routes/storeRoutes.js
const express = require('express');
const storeController = require('../controllers/storeController');
const storeProductController = require('../controllers/storeProductController');
const { protect } = require('../controllers/authController');
const inviteController = require('../controllers/inviteController');

const router = express.Router();

// All routes require login
router.use(protect);

// Specific routes FIRST
router.post('/join/:token', inviteController.joinOutlet);
router.get('/my-store', storeController.getMyStore);
router.get('/my-stores', storeController.getMyStores);
router.get('/products', storeProductController.getAllStoreProducts);
router.post('/products', storeProductController.createStoreProduct);
router.get('/products/:outletId', storeProductController.getStoreProducts);
router.get('/product/:id', storeProductController.getStoreProduct);
router.patch('/product/:id', storeProductController.updateStoreProduct);
router.delete('/product/:id', storeProductController.deleteStoreProduct);
router.get('/', storeController.getMyStores);
router.post('/', storeController.createStore);

// Parameterized routes LAST
router.post('/:outletId/invite', inviteController.generateInvite);
router.get('/:outletId/requests', inviteController.getJoinRequests);
router.patch('/:outletId/requests/:reqId', inviteController.handleJoinRequest);
router.delete('/:outletId/workers/:workerId', inviteController.removeWorker);
router.patch(
  '/:outletId/workers/:workerId',
  inviteController.updateWorkerPermissions
);
router.route('/:outletId/products').post(storeController.addProductToStore);
router
  .route('/:outletId')
  .get(storeController.getStore)
  .patch(storeController.updateStore)
  .delete(storeController.deleteStore);

module.exports = router;
