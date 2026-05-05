// routes/userRoutes.js
const User = require('../models/userModel');
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { default: rateLimit } = require('express-rate-limit');

const router = express.Router();

// Stricter limit only for auth routes
const authLimiter = rateLimit({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Too many login attempts, please try again in an hour!',
});

// Public routes
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
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
