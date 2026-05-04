// routes/warehouseRoutes.js
const express = require('express');
const warehouseController = require('../controllers/warehouseController');
const whProductController = require('../controllers/whProductController');
const inviteController = require('../controllers/inviteController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.use(protect);

// Specific routes first
router.get('/my-warehouse', warehouseController.getMyWarehouse);
router.post('/join/:token', inviteController.joinOutlet);
// Invite routes
router.post('/:outletId/invite', inviteController.generateInvite);
router.get('/:outletId/requests', inviteController.getJoinRequests);
router.patch('/:outletId/requests/:reqId', inviteController.handleJoinRequest);
router.delete('/:outletId/workers/:workerId', inviteController.removeWorker);
router.patch(
  '/:outletId/workers/:workerId',
  inviteController.updateWorkerPermissions
);

// Create and Get Warehouse
router
  .route('/')
  .get(warehouseController.getMyWarehouses)
  .post(warehouseController.createWarehouse);

router
  .route('/:id')
  .get(warehouseController.getWarehouse)
  .patch(warehouseController.updateWarehouse)
  .delete(warehouseController.deleteWarehouse);

// Add product to warehouse
router.route('/:id/products').post(warehouseController.addProductToWarehouse);

// Manage warehouse's products
router
  .route('/products/warehouse/:id')
  .get(whProductController.getAllWarehouseProducts)
  .post(whProductController.createWarehouseProduct);

// router.get("/products/:outletId", whProductController.getWhProducts)

router
  .route('/product/:id')
  .get(whProductController.getWarehouseProduct)
  .patch(whProductController.updateWarehouseProduct)
  .delete(whProductController.deleteWarehouseProduct);

module.exports = router;
