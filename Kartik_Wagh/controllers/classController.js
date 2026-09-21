const mongoose = require('mongoose');
const FitnessClass = require('../models/FitnessClass');
const { escapeRegex, isPastDate } = require('../utils/dateHelper');

/**
 * Fetch all upcoming fitness classes with optional trainer filter.
 */
const getClasses = async (req, res, next) => {
  try {
    const { trainer } = req.query;
    const filter = {
      scheduleDate: { $gte: new Date() }
    };

    if (trainer && typeof trainer === 'string' && trainer.trim()) {
      filter.trainerName = {
        $regex: escapeRegex(trainer.trim()),
        $options: 'i'
      };
    }

    const classes = await FitnessClass.find(filter).sort({ scheduleDate: 1 });

    // Format classes to return enrolledCount instead of full enrolledMembers array
    const formattedClasses = classes.map(cls => {
      const classObj = cls.toJSON();
      const enrolledCount = Array.isArray(classObj.enrolledMembers) ? classObj.enrolledMembers.length : 0;
      delete classObj.enrolledMembers;
      return {
        ...classObj,
        enrolledCount
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedClasses.length,
      classes: formattedClasses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get class details with populated enrolled members list (excluding passwords).
 */
const getClassById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    const fitnessClass = await FitnessClass.findById(id).populate({
      path: 'enrolledMembers',
      select: 'username email membershipTier membershipStatus'
    });

    if (!fitnessClass) {
      return res.status(404).json({
        success: false,
        message: 'Fitness class not found'
      });
    }

    return res.status(200).json({
      success: true,
      class: fitnessClass
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new workout class (Admin only).
 */
const createClass = async (req, res, next) => {
  try {
    const { title, trainerName, scheduleDate, durationMinutes, maxCapacity } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Class title is required'
      });
    }

    // Validate trainerName
    if (!trainerName || typeof trainerName !== 'string' || !trainerName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Trainer name is required'
      });
    }

    // Validate scheduleDate
    if (!scheduleDate) {
      return res.status(400).json({
        success: false,
        message: 'Schedule date is required'
      });
    }

    const parsedDate = new Date(scheduleDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule date format'
      });
    }

    if (parsedDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Class schedule date must be in the future'
      });
    }

    // Validate maxCapacity
    if (maxCapacity === undefined || maxCapacity === null) {
      return res.status(400).json({
        success: false,
        message: 'Max capacity is required'
      });
    }

    const parsedCapacity = Number(maxCapacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Max capacity must be an integer of at least 1'
      });
    }

    // Validate durationMinutes if provided
    let duration = 60;
    if (durationMinutes !== undefined && durationMinutes !== null) {
      const parsedDuration = Number(durationMinutes);
      if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Duration minutes must be a positive number greater than 0'
        });
      }
      duration = parsedDuration;
    }

    const newClass = new FitnessClass({
      title: title.trim(),
      trainerName: trainerName.trim(),
      scheduleDate: parsedDate,
      durationMinutes: duration,
      maxCapacity: parsedCapacity,
      enrolledMembers: []
    });

    await newClass.save();

    return res.status(201).json({
      success: true,
      message: 'Fitness class created successfully',
      class: newClass
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Book / enroll logged-in member into a fitness class with atomic capacity enforcement.
 */
const bookClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    // Check if class exists and status before atomic update
    const existingClass = await FitnessClass.findById(id);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: 'Fitness class not found'
      });
    }

    if (isPastDate(existingClass.scheduleDate)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book past classes'
      });
    }

    // Check if already booked
    const isAlreadyBooked = existingClass.enrolledMembers.some(
      memberId => memberId.toString() === userId.toString()
    );
    if (isAlreadyBooked) {
      return res.status(400).json({
        success: false,
        message: 'You have already booked this class'
      });
    }

    // Check if full
    if (existingClass.enrolledMembers.length >= existingClass.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Class capacity reached'
      });
    }

    // Atomic find and update to prevent race conditions & over-enrollment
    const updatedClass = await FitnessClass.findOneAndUpdate(
      {
        _id: id,
        scheduleDate: { $gte: new Date() },
        enrolledMembers: { $ne: userId },
        $expr: { $lt: [{ $size: '$enrolledMembers' }, '$maxCapacity'] }
      },
      {
        $addToSet: { enrolledMembers: userId }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedClass) {
      // If atomic update returned null, determine exact reason
      const freshClass = await FitnessClass.findById(id);
      if (!freshClass) {
        return res.status(404).json({
          success: false,
          message: 'Fitness class not found'
        });
      }
      if (freshClass.enrolledMembers.some(m => m.toString() === userId.toString())) {
        return res.status(400).json({
          success: false,
          message: 'You have already booked this class'
        });
      }
      if (freshClass.enrolledMembers.length >= freshClass.maxCapacity) {
        return res.status(400).json({
          success: false,
          message: 'Class capacity reached'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Unable to complete booking at this time'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully booked class',
      class: updatedClass
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a member booking from a class.
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    const fitnessClass = await FitnessClass.findById(id);
    if (!fitnessClass) {
      return res.status(404).json({
        success: false,
        message: 'Fitness class not found'
      });
    }

    if (isPastDate(fitnessClass.scheduleDate)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking for a class that has already taken place'
      });
    }

    const isEnrolled = fitnessClass.enrolledMembers.some(
      memberId => memberId.toString() === userId.toString()
    );

    if (!isEnrolled) {
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this class'
      });
    }

    const updatedClass = await FitnessClass.findByIdAndUpdate(
      id,
      { $pull: { enrolledMembers: userId } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      spotsLeft: updatedClass.spotsLeft
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClasses,
  getClassById,
  createClass,
  bookClass,
  cancelBooking
};
