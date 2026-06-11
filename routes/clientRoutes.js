const express = require('express');
const clientController = require('../controllers/clientController');
const authController = require('../controllers/authController');

const router = express.Router();

// All routes require login
router.use(authController.protect);

router.get('/my-clients', clientController.getMyClients)

// Get and create clients
router
  .route('/')
  .get(clientController.getAllClients)
  .post(clientController.createClient);

// Get, update and delete clients
router
  .route('/:id')
  .get(clientController.getClient)
  .patch(clientController.updateClient)
  .delete(clientController.deleteClient);

// Record payment
router.post('/:id/pay', clientController.recordPayment);

module.exports = router;
