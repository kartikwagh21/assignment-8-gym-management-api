const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password'
      },
      async (username, password, done) => {
        try {
          if (!username || !password) {
            return done(null, false, { message: 'Username and password are required' });
          }

          // Case-sensitive username lookup
          const user = await User.findOne({ username: username.trim() });
          if (!user) {
            return done(null, false, { message: 'Invalid username or password' });
          }

          const isMatch = await user.comparePassword(password);
          if (!isMatch) {
            return done(null, false, { message: 'Invalid username or password' });
          }

          // Sync status if expired
          await user.syncMembershipStatus();

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id || user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-password');
      if (user) {
        // Keep status fresh
        await user.syncMembershipStatus();
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
