const passport = require('passport');
const User = require('../models/User');

/**
 * Register a new gym member with automated expiry date calculation.
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, membershipTier, durationMonths, emergencyContact } = req.body;

    // Validate username
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Validate email
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate membership tier if provided
    const validTiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    if (membershipTier && !validTiers.includes(membershipTier)) {
      return res.status(400).json({
        success: false,
        message: `Invalid membership tier. Allowed tiers: ${validTiers.join(', ')}`
      });
    }

    // Validate durationMonths if provided
    let duration = 1;
    if (durationMonths !== undefined && durationMonths !== null) {
      const parsedDuration = Number(durationMonths);
      if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 36) {
        return res.status(400).json({
          success: false,
          message: 'Duration months must be an integer between 1 and 36'
        });
      }
      duration = parsedDuration;
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing duplicate username or email
    const existingUser = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Create new member user (cannot directly set role or status on register)
    const newUser = new User({
      username: trimmedUsername,
      email: normalizedEmail,
      password,
      membershipTier: membershipTier || 'Bronze',
      emergencyContact: emergencyContact ? emergencyContact.trim() : undefined,
      durationMonths: duration
    });

    await newUser.save();

    // Auto-login newly registered member
    req.login(newUser, (err) => {
      if (err) return next(err);
      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: newUser
      });
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `An account with this ${duplicateField} already exists`
      });
    }
    next(error);
  }
};

/**
 * Log in member via Passport Local Strategy.
 */
const login = (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both username and password'
    });
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Invalid username or password'
      });
    }

    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user
      });
    });
  })(req, res, next);
};

/**
 * Fetch active member profile with remaining days & virtuals.
 */
const getMe = async (req, res, next) => {
  try {
    // Lazily sync membership status if expired
    if (req.user && typeof req.user.syncMembershipStatus === 'function') {
      await req.user.syncMembershipStatus();
    }
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log out member, destroy session, and clear cookie.
 */
const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    if (req.session) {
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        return res.status(200).json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    } else {
      res.clearCookie('connect.sid');
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout
};
