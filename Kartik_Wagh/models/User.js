const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { addMonthsAsDays, calculateRemainingDays, isPastDate } = require('../utils/dateHelper');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  membershipTier: {
    type: String,
    enum: {
      values: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      message: '{VALUE} is not a valid membership tier'
    },
    default: 'Bronze'
  },
  membershipStatus: {
    type: String,
    enum: {
      values: ['active', 'expired', 'frozen'],
      message: '{VALUE} is not a valid membership status'
    },
    default: 'active'
  },
  membershipExpiryDate: {
    type: Date,
    required: [true, 'Membership expiry date is required']
  },
  emergencyContact: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: {
      values: ['member', 'admin'],
      message: '{VALUE} is not a valid role'
    },
    default: 'member'
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Transient duration in months for registration calculations (not saved directly to DB)
userSchema.virtual('durationMonths')
  .get(function () {
    return this._durationMonths;
  })
  .set(function (value) {
    this._durationMonths = value;
  });

// Virtual: isExpired
userSchema.virtual('isExpired').get(function () {
  if (!this.membershipExpiryDate) return true;
  return isPastDate(this.membershipExpiryDate);
});

// Virtual: remainingDays
userSchema.virtual('remainingDays').get(function () {
  return calculateRemainingDays(this.membershipExpiryDate);
});

// Pre-validate hook: Compute membershipExpiryDate automatically on new documents if not provided
userSchema.pre('validate', function (next) {
  if (this.isNew && !this.membershipExpiryDate) {
    const duration = this._durationMonths || this.durationMonths || 1;
    this.membershipExpiryDate = addMonthsAsDays(new Date(), duration);
  }
  next();
});

// Pre-save hook: Hash password with bcryptjs before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method: compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: lazily sync status if expired
userSchema.methods.syncMembershipStatus = async function () {
  if (this.membershipExpiryDate && isPastDate(this.membershipExpiryDate) && this.membershipStatus === 'active') {
    this.membershipStatus = 'expired';
    await this.save();
  }
  return this;
};

// Static method: helper to lazily check & sync a user's status
userSchema.statics.syncStatusById = async function (userId) {
  const user = await this.findById(userId);
  if (user) {
    await user.syncMembershipStatus();
  }
  return user;
};

module.exports = mongoose.model('User', userSchema);
