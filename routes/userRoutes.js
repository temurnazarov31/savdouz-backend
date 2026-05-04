// routes/userRoutes.js
const User = require('../models/userModel');
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Protected routes — login required
router.use(authController.protect);

router.get('/getMe', userController.getMe);
router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);
router.patch('/updateMyPassword', authController.updatePassword);

// Admin only routes
router.use(authController.restrictTo('admin'));
router.route('/').get(userController.getAllUsers);

router.route('/:id').delete(userController.deleteUser);

module.exports = router;
