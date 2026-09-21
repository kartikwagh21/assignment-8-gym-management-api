const mongoose = require('mongoose');

const fitnessClassSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Class title is required'],
    trim: true
  },
  trainerName: {
    type: String,
    required: [true, 'Trainer name is required'],
    trim: true
  },
  scheduleDate: {
    type: Date,
    required: [true, 'Schedule date is required']
  },
  durationMinutes: {
    type: Number,
    required: [true, 'Duration in minutes is required'],
    default: 60,
    min: [1, 'Duration must be at least 1 minute']
  },
  maxCapacity: {
    type: Number,
    required: [true, 'Max capacity is required'],
    min: [1, 'Max capacity must be at least 1']
  },
  enrolledMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Virtual: spotsLeft (computed spots remaining)
fitnessClassSchema.virtual('spotsLeft').get(function () {
  const enrolledCount = Array.isArray(this.enrolledMembers) ? this.enrolledMembers.length : 0;
  return Math.max(0, this.maxCapacity - enrolledCount);
});

// Virtual: isFull (boolean indicator)
fitnessClassSchema.virtual('isFull').get(function () {
  const enrolledCount = Array.isArray(this.enrolledMembers) ? this.enrolledMembers.length : 0;
  return enrolledCount >= this.maxCapacity;
});

// Compound and single indexes for query performance
fitnessClassSchema.index({ scheduleDate: 1 });
fitnessClassSchema.index({ trainerName: 1 });
fitnessClassSchema.index({ scheduleDate: 1, trainerName: 1 });

module.exports = mongoose.model('FitnessClass', fitnessClassSchema);
