const express = require('express');
const workerController = require('../controllers/workerController');

const router = express.Router();

// Worker routes
router.get('/', workerController.getAllWorkers)
router.get('/:id',workerController.getWorker)
router.delete('/:id/outlet/outletId', workerController.removeWorker)

module.exports = router