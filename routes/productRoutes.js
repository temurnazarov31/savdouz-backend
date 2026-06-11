const express = require('express');
const productController = require('../controllers/productController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.use(protect);

// QR code generator
router.get('/export-barcodes', productController.exportBarcodes);
router.get('/:id/export-barcode', productController.exportSingleBarcode);

// Products routes
router
  .route('/')
  .get(productController.getAllMyProducts)
  .post(productController.createProduct);
router
  .route('/:id')
  .get(productController.getMyProduct)
  .patch(productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;
