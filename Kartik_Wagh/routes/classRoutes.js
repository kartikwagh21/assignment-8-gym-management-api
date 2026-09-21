const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { ensureAuthenticated, requireAdmin } = require('../middleware/authMiddleware');
const checkActiveMember = require('../middleware/checkActiveMember');

// @route   GET /api/classes
// @desc    Fetch upcoming workout classes (optional ?trainer= query)
// @access  Public
router.get('/', classController.getClasses);

// @route   GET /api/classes/:id
// @desc    Get single class details with populated enrolled members
// @access  Public
router.get('/:id', classController.getClassById);

// @route   POST /api/classes
// @desc    Create a new workout class
// @access  Private (Admin only)
router.post('/', ensureAuthenticated, requireAdmin, classController.createClass);

// @route   POST /api/classes/:id/book
// @desc    Book / enroll logged-in member into class (enforces capacity & active membership)
// @access  Private (Active Members only)
router.post('/:id/book', ensureAuthenticated, checkActiveMember, classController.bookClass);

// @route   DELETE /api/classes/:id/cancel
// @desc    Cancel member booking from class
// @access  Private (Authenticated Members)
router.delete('/:id/cancel', ensureAuthenticated, classController.cancelBooking);

module.exports = router;
