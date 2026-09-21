const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// @route   POST /api/auth/register
// @desc    Register new gym member with automated plan duration calculation
// @access  Public
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Login via Passport Local strategy
// @access  Public
router.post('/login', authController.login);

// @route   GET /api/auth/me
// @desc    Get current active member profile & remaining days
// @access  Private (Authenticated Member/Admin)
router.get('/me', ensureAuthenticated, authController.getMe);

// @route   POST /api/auth/logout
// @desc    Destroy session and log out
// @access  Public / Private
router.post('/logout', authController.logout);

module.exports = router;
