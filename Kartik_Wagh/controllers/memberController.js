const mongoose = require('mongoose');
const User = require('../models/User');
const { addMonthsAsDays, isPastDate } = require('../utils/dateHelper');

/**
 * Renew / extend membership expiry date.
 * Member can renew own membership; Admin can renew any member.
 */
const renewMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { additionalMonths, tier } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }

    // Role check: User can only renew their own membership unless they are an admin
    const isSelf = req.user._id.toString() === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only renew your own membership'
      });
    }

    // Validate additionalMonths (required, positive integer 1-36)
    if (additionalMonths === undefined || additionalMonths === null) {
      return res.status(400).json({
        success: false,
        message: 'additionalMonths is required'
      });
    }

    const parsedMonths = Number(additionalMonths);
    if (!Number.isInteger(parsedMonths) || parsedMonths < 1 || parsedMonths > 36) {
      return res.status(400).json({
        success: false,
        message: 'additionalMonths must be an integer between 1 and 36'
      });
    }

    // Validate tier if provided
    const validTiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    if (tier && !validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        message: `Invalid membership tier. Allowed tiers: ${validTiers.join(', ')}`
      });
    }

    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Extension logic:
    // If current expiry is in the future, extend from current expiry date;
    // If already expired (or invalid), extend from now.
    const now = new Date();
    const currentExpiry = member.membershipExpiryDate ? new Date(member.membershipExpiryDate) : now;
    const isCurrentlyActive = currentExpiry.getTime() > now.getTime();

    const baseDate = isCurrentlyActive ? currentExpiry : now;
    const newExpiry = addMonthsAsDays(baseDate, parsedMonths);

    member.membershipExpiryDate = newExpiry;
    member.membershipStatus = 'active';

    if (tier) {
      member.membershipTier = tier;
    }

    await member.save();

    return res.status(200).json({
      success: true,
      message: 'Membership renewed successfully',
      user: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of all expired memberships (Admin only).
 */
const getExpiredMembers = async (req, res, next) => {
  try {
    const now = new Date();
    // Query members whose membershipExpiryDate < now
    const expiredMembers = await User.find({
      membershipExpiryDate: { $lt: now }
    })
      .select('-password')
      .sort({ membershipExpiryDate: -1 });

    return res.status(200).json({
      success: true,
      count: expiredMembers.length,
      members: expiredMembers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  renewMembership,
  getExpiredMembers
};
