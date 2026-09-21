const { isPastDate } = require('../utils/dateHelper');
const User = require('../models/User');

/**
 * Middleware to ensure the authenticated member has an active (non-expired, non-frozen) membership.
 */
const checkActiveMember = async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to access this resource'
      });
    }

    // Refresh and sync status from DB if needed
    let user = req.user;
    if (user.membershipExpiryDate && isPastDate(user.membershipExpiryDate)) {
      if (user.membershipStatus === 'active') {
        user.membershipStatus = 'expired';
        await User.findByIdAndUpdate(user._id, { membershipStatus: 'expired' });
      }
    }

    // Check if membership is expired
    if (user.membershipStatus === 'expired' || (user.membershipExpiryDate && isPastDate(user.membershipExpiryDate))) {
      return res.status(400).json({
        success: false,
        message: 'Membership expired. Please renew to book classes'
      });
    }

    // Check if membership is frozen
    if (user.membershipStatus === 'frozen') {
      return res.status(400).json({
        success: false,
        message: 'Membership is frozen. Please contact gym administration'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = checkActiveMember;
