// routes/userRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { default: rateLimit } = require('express-rate-limit');

const router = express.Router();

// Stricter limit only for auth routes
const authLimiter = rateLimit({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: {code: 'TOO_MANY_LOGIN_ATTEMPTS'},
});

const otpLimiter = rateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: { code: 'TOO_MANY_OTP_REQUESTS' },
});

// Public routes
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.get('/logout', authController.logout);

// OTP verification
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/forgotMypassword', authController.forgotPassword);
router.post('/resetMypassword', authController.resetPassword);

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
