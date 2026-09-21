/**
 * Authentication and authorization middleware.
 */

// Ensure the user has an active session authenticated with Passport
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Please log in to access this resource'
  });
};

// Ensure the authenticated user has an admin role
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Please log in to access this resource'
    });
  }

  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required'
  });
};

module.exports = {
  ensureAuthenticated,
  requireAdmin
};
