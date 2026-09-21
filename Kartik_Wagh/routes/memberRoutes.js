const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { ensureAuthenticated, requireAdmin } = require('../middleware/authMiddleware');

// @route   GET /api/members/expired
// @desc    Get list of all members with expired memberships
// @access  Private (Admin only)
router.get('/expired', ensureAuthenticated, requireAdmin, memberController.getExpiredMembers);

// @route   PATCH /api/members/:id/renew
// @desc    Renew or extend membership expiry date (Member self-renew or Admin)
// @access  Private (Member self or Admin)
router.patch('/:id/renew', ensureAuthenticated, memberController.renewMembership);

module.exports = router;
