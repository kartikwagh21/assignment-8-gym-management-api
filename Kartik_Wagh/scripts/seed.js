require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const FitnessClass = require('../models/FitnessClass');
const { addMonthsAsDays } = require('../utils/dateHelper');

const seedDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in the environment.');
    process.exit(1);
  }

  const isReset = process.argv.includes('--reset');

  try {
    console.log('🔄 Connecting to MongoDB for database seeding...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    if (isReset) {
      console.log('🧹 --reset flag passed: Clearing existing Users and Fitness Classes...');
      await User.deleteMany({});
      await FitnessClass.deleteMany({});
      console.log('✨ Cleared existing collections.');
    }

    const now = new Date();

    // 1. Seed Admin Account
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'admin',
        email: 'admin@gym.com',
        password: 'Admin@123',
        membershipTier: 'Platinum',
        role: 'admin',
        membershipStatus: 'active',
        membershipExpiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        emergencyContact: '911-000-0000'
      });
      await admin.save();
      console.log('👤 Created Admin: admin (admin@gym.com / Admin@123)');
    } else {
      console.log('ℹ️ Admin user already exists.');
    }

    // 2. Seed Sample Members
    const sampleMembers = [
      {
        username: 'fit_sam',
        email: 'sam@fit.com',
        password: 'Password@123',
        membershipTier: 'Gold',
        role: 'member',
        membershipStatus: 'active',
        membershipExpiryDate: addMonthsAsDays(now, 3),
        emergencyContact: '111-222-3333'
      },
      {
        username: 'yoga_amy',
        email: 'amy@fit.com',
        password: 'Password@123',
        membershipTier: 'Silver',
        role: 'member',
        membershipStatus: 'active',
        membershipExpiryDate: addMonthsAsDays(now, 2),
        emergencyContact: '222-333-4444'
      },
      {
        username: 'lift_raj',
        email: 'raj@fit.com',
        password: 'Password@123',
        membershipTier: 'Bronze',
        role: 'member',
        membershipStatus: 'active',
        membershipExpiryDate: addMonthsAsDays(now, 1),
        emergencyContact: '333-444-5555'
      },
      {
        username: 'expired_bob',
        email: 'bob@fit.com',
        password: 'Password@123',
        membershipTier: 'Bronze',
        role: 'member',
        membershipStatus: 'expired',
        // 15 days in the past
        membershipExpiryDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        emergencyContact: '444-555-6666'
      },
      {
        username: 'frozen_claire',
        email: 'claire@fit.com',
        password: 'Password@123',
        membershipTier: 'Silver',
        role: 'member',
        membershipStatus: 'frozen',
        membershipExpiryDate: addMonthsAsDays(now, 1),
        emergencyContact: '555-666-7777'
      }
    ];

    for (const memberData of sampleMembers) {
      const exists = await User.findOne({ username: memberData.username });
      if (!exists) {
        const user = new User(memberData);
        await user.save();
        console.log(`👤 Created Member: ${memberData.username} [${memberData.membershipTier} - ${memberData.membershipStatus}]`);
      } else {
        console.log(`ℹ️ Member ${memberData.username} already exists.`);
      }
    }

    // 3. Seed Sample Classes
    const sampleClasses = [
      {
        title: 'HIIT Bootcamp (Small Group)',
        trainerName: 'John',
        scheduleDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        durationMinutes: 60,
        maxCapacity: 2, // Limited capacity for testing
        enrolledMembers: []
      },
      {
        title: 'Zumba Cardio Explosion',
        trainerName: 'Maria',
        scheduleDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        durationMinutes: 45,
        maxCapacity: 20,
        enrolledMembers: []
      },
      {
        title: 'Vinyasa Yoga Flow',
        trainerName: 'Amy',
        scheduleDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        durationMinutes: 60,
        maxCapacity: 15,
        enrolledMembers: []
      },
      {
        title: 'Power Strength & Conditioning',
        trainerName: 'John',
        scheduleDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
        durationMinutes: 75,
        maxCapacity: 10,
        enrolledMembers: []
      },
      {
        title: 'Core & Mat Pilates',
        trainerName: 'Sarah',
        scheduleDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
        durationMinutes: 50,
        maxCapacity: 12,
        enrolledMembers: []
      }
    ];

    for (const classData of sampleClasses) {
      const exists = await FitnessClass.findOne({ title: classData.title });
      if (!exists) {
        const cls = new FitnessClass(classData);
        await cls.save();
        console.log(`🏋️ Created Class: "${classData.title}" with ${classData.trainerName} (Max: ${classData.maxCapacity})`);
      } else {
        console.log(`ℹ️ Class "${classData.title}" already exists.`);
      }
    }

    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin Credentials:');
    console.log('  Username: admin');
    console.log('  Password: Admin@123');
    console.log('Member Credentials (all):');
    console.log('  fit_sam / yoga_amy / lift_raj / expired_bob / frozen_claire');
    console.log('  Password: Password@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (require.main === module) {
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    if (require.main === module) {
      await mongoose.disconnect();
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
