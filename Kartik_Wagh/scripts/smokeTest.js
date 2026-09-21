const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Helper to track cookies across requests for session-based testing
class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  saveCookies(response) {
    const rawCookies = response.headers.get('set-cookie');
    if (rawCookies) {
      // Handle multiple cookies if joined by comma or array
      const cookieArray = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
      cookieArray.forEach(cookieStr => {
        const parts = cookieStr.split(';')[0].split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          this.cookies[key] = val;
        }
      });
    }
  }

  clearCookies() {
    this.cookies = {};
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...(options.headers || {}) };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const res = await fetch(url, { ...options, headers });
    this.saveCookies(res);

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return {
      status: res.status,
      headers: res.headers,
      data
    };
  }

  get(path) {
    return this.request(path, { method: 'GET' });
  }

  post(path, body) {
    return this.request(path, { method: 'POST', body });
  }

  patch(path, body) {
    return this.request(path, { method: 'PATCH', body });
  }

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

// Test runner function
async function runSmokeTests() {
  console.log('🚀 Starting Gym API Comprehensive Smoke & E2E Test Suite...\n');
  let mongod = null;
  let server = null;
  let testPort = 5055;
  let baseUrl = `http://localhost:${testPort}`;

  try {
    // 1. Setup in-memory DB or use local MongoDB
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri || mongoUri.includes('<password>')) {
      console.log('⚡ Initializing MongoDB In-Memory Server for local testing...');
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      process.env.MONGODB_URI = mongoUri;
    }

    process.env.NODE_ENV = 'test';
    process.env.PORT = testPort.toString();
    process.env.SESSION_SECRET = 'test_secret_key_smoke_test_12345';

    // Connect DB & start Express server
    const { app } = require('../server');
    await mongoose.connect(mongoUri);
    server = app.listen(testPort);
    console.log(`📡 Test server running on ${baseUrl}\n`);

    // Run database seed
    const User = require('../models/User');
    const FitnessClass = require('../models/FitnessClass');
    const seedDatabase = require('./seed');
    await seedDatabase();

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
      if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: ${message}`);
        failedTests++;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🧪 1. Testing Registration, Auto-Expiry (30 Days), & Validation');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const member1Client = new TestClient(baseUrl);
    const regTimestampBefore = Date.now();
    const regRes = await member1Client.post('/api/auth/register', {
      username: 'test_member_alpha',
      email: 'alpha@gym.com',
      password: 'Password@123',
      membershipTier: 'Gold',
      durationMonths: 1
    });

    assert(regRes.status === 201, `Registration returns 201 Created (got ${regRes.status})`);
    assert(regRes.data.success === true, 'Response body has success: true');
    assert(regRes.data.user && regRes.data.user.username === 'test_member_alpha', 'User object returned in response');
    assert(!regRes.data.user.password, 'Password field is stripped from returned user');

    // Verify 30-day expiry calculation
    const expiryDate = new Date(regRes.data.user.membershipExpiryDate);
    const diffMs = expiryDate.getTime() - regTimestampBefore;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    console.log(`     Calculated expiry difference: ${diffDays.toFixed(4)} days (~30 days)`);
    assert(Math.abs(diffDays - 30) < 0.05, `Membership expiry is exactly 30 days in future (diff: ${diffDays.toFixed(3)} days)`);

    // Duplicate username test
    const dupRes = await member1Client.post('/api/auth/register', {
      username: 'test_member_alpha',
      email: 'another_email@gym.com',
      password: 'Password@123'
    });
    assert(dupRes.status === 400 && dupRes.data.message.toLowerCase().includes('already taken'), 'Duplicate username returns 400 Bad Request');

    // Invalid tier test
    const badTierRes = await member1Client.post('/api/auth/register', {
      username: 'test_member_bad_tier',
      email: 'badtier@gym.com',
      password: 'Password@123',
      membershipTier: 'Diamond'
    });
    assert(badTierRes.status === 400, 'Invalid membershipTier returns 400 Bad Request');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 2. Testing Authentication, /api/auth/me, and Logout');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const unauthClient = new TestClient(baseUrl);
    const unauthMe = await unauthClient.get('/api/auth/me');
    assert(unauthMe.status === 401, 'Unauthenticated /api/auth/me returns 401 Unauthorized');

    // Bad login
    const badLoginRes = await unauthClient.post('/api/auth/login', {
      username: 'test_member_alpha',
      password: 'WrongPassword'
    });
    assert(badLoginRes.status === 401, 'Invalid password returns 401 Unauthorized');

    // Good login
    const loginRes = await unauthClient.post('/api/auth/login', {
      username: 'test_member_alpha',
      password: 'Password@123'
    });
    assert(loginRes.status === 200 && loginRes.data.success === true, 'Valid login returns 200 OK');

    // Authenticated me check
    const authMeRes = await unauthClient.get('/api/auth/me');
    assert(authMeRes.status === 200, 'Authenticated /api/auth/me returns 200 OK');
    assert(authMeRes.data.user.remainingDays >= 29, `User profile contains remainingDays (got ${authMeRes.data.user.remainingDays})`);
    assert(authMeRes.data.user.isExpired === false, 'User profile contains isExpired: false');

    // Logout
    const logoutRes = await unauthClient.post('/api/auth/logout', {});
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');
    const postLogoutMe = await unauthClient.get('/api/auth/me');
    assert(postLogoutMe.status === 401, 'After logout, /api/auth/me returns 401 Unauthorized');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 3. Testing Admin Authorization & Class Creation');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const adminClient = new TestClient(baseUrl);
    const adminLoginRes = await adminClient.post('/api/auth/login', {
      username: 'admin',
      password: 'Admin@123'
    });
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');

    // Member trying to create a class (should fail 403)
    const memberCreateRes = await member1Client.post('/api/classes', {
      title: 'Member Created Class',
      trainerName: 'Unauthorized Guy',
      scheduleDate: new Date(Date.now() + 86400000).toISOString(),
      maxCapacity: 10
    });
    assert(memberCreateRes.status === 403, `Non-admin creating class returns 403 Forbidden (got ${memberCreateRes.status})`);

    // Admin creating class with maxCapacity = 2
    const futureClassDate = new Date(Date.now() + 3 * 86400000).toISOString();
    const adminCreateRes = await adminClient.post('/api/classes', {
      title: 'Exclusive Sprint Lab',
      trainerName: 'Coach Carter',
      scheduleDate: futureClassDate,
      durationMinutes: 45,
      maxCapacity: 2
    });
    assert(adminCreateRes.status === 201, 'Admin creating class with maxCapacity = 2 returns 201 Created');
    const testClassId = adminCreateRes.data.class._id || adminCreateRes.data.class.id;
    assert(adminCreateRes.data.class.spotsLeft === 2, 'New class has spotsLeft = 2');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 4. Testing Class Bookings, Capacity Limit (max=2), & Double Booking');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Register 2 more active members
    const member2Client = new TestClient(baseUrl);
    await member2Client.post('/api/auth/register', {
      username: 'test_member_beta',
      email: 'beta@gym.com',
      password: 'Password@123',
      membershipTier: 'Silver',
      durationMonths: 1
    });

    const member3Client = new TestClient(baseUrl);
    await member3Client.post('/api/auth/register', {
      username: 'test_member_gamma',
      email: 'gamma@gym.com',
      password: 'Password@123',
      membershipTier: 'Bronze',
      durationMonths: 1
    });

    // 1st Booking
    const book1Res = await member1Client.post(`/api/classes/${testClassId}/book`, {});
    assert(book1Res.status === 200, '1st member booking returns 200 OK');
    assert(book1Res.data.class.spotsLeft === 1, 'Class spotsLeft is now 1');

    // Double Booking attempt by member 1
    const doubleBookRes = await member1Client.post(`/api/classes/${testClassId}/book`, {});
    assert(doubleBookRes.status === 400 && doubleBookRes.data.message.includes('already booked'), 'Double booking returns 400 Bad Request');

    // 2nd Booking
    const book2Res = await member2Client.post(`/api/classes/${testClassId}/book`, {});
    assert(book2Res.status === 200, '2nd member booking returns 200 OK');
    assert(book2Res.data.class.spotsLeft === 0, 'Class spotsLeft is now 0 (Full)');
    assert(book2Res.data.class.isFull === true, 'Class isFull is true');

    // 3rd Booking (Should fail with 400 Class capacity reached)
    const book3Res = await member3Client.post(`/api/classes/${testClassId}/book`, {});
    assert(
      book3Res.status === 400 && book3Res.data.message.toLowerCase().includes('capacity reached'),
      `3rd member booking returns 400 with "Class capacity reached" (got ${book3Res.status}: "${book3Res.data.message}")`
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 5. Testing Booking Cancellation');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Non-enrolled member trying to cancel
    const nonEnrolledCancel = await member3Client.delete(`/api/classes/${testClassId}/cancel`);
    assert(nonEnrolledCancel.status === 400, 'Cancelling booking when not enrolled returns 400 Bad Request');

    // Member 1 cancels booking
    const cancelRes = await member1Client.delete(`/api/classes/${testClassId}/cancel`);
    assert(cancelRes.status === 200, 'Member 1 cancelling booking returns 200 OK');
    assert(cancelRes.data.spotsLeft === 1, `spotsLeft increased back to 1 (got ${cancelRes.data.spotsLeft})`);

    // Member 3 can now book the open spot
    const book3RetryRes = await member3Client.post(`/api/classes/${testClassId}/book`, {});
    assert(book3RetryRes.status === 200, 'Member 3 successfully books the freed spot');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 6. Testing Expired Member Booking Restriction');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const expiredClient = new TestClient(baseUrl);
    await expiredClient.post('/api/auth/login', {
      username: 'expired_bob',
      password: 'Password@123'
    });

    const expiredBookRes = await expiredClient.post(`/api/classes/${testClassId}/book`, {});
    assert(
      expiredBookRes.status === 400 && expiredBookRes.data.message.toLowerCase().includes('expired'),
      `Expired member booking returns 400 with expired message (got "${expiredBookRes.data.message}")`
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 7. Testing Class Listing, Filtering, and Details with Population');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Public classes listing
    const classesRes = await member1Client.get('/api/classes');
    assert(classesRes.status === 200 && Array.isArray(classesRes.data.classes), 'GET /api/classes returns array of upcoming classes');

    // Trainer filter
    const trainerFilterRes = await member1Client.get('/api/classes?trainer=Carter');
    assert(trainerFilterRes.status === 200, 'GET /api/classes?trainer=Carter returns 200 OK');
    const matched = trainerFilterRes.data.classes.every(c => c.trainerName.includes('Carter'));
    assert(matched && trainerFilterRes.data.count >= 1, `Trainer filter correctly filtered by "Carter" (found ${trainerFilterRes.data.count})`);

    // Class details by ID
    const classDetailRes = await member1Client.get(`/api/classes/${testClassId}`);
    assert(classDetailRes.status === 200, 'GET /api/classes/:id returns 200 OK');
    assert(Array.isArray(classDetailRes.data.class.enrolledMembers), 'enrolledMembers is an array');
    const firstEnrolled = classDetailRes.data.class.enrolledMembers[0];
    assert(firstEnrolled && firstEnrolled.username && !firstEnrolled.password, 'enrolledMembers populated with username without password');

    // Invalid class ID
    const invalidIdRes = await member1Client.get('/api/classes/invalid_id_format');
    assert(invalidIdRes.status === 400, 'Invalid class ID returns 400 Bad Request');

    // Not found class ID
    const notFoundIdRes = await member1Client.get(`/api/classes/${new mongoose.Types.ObjectId()}`);
    assert(notFoundIdRes.status === 404, 'Non-existent class ID returns 404 Not Found');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 8. Testing /api/members/expired (Admin only)');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Regular member trying to get expired list
    const memberExpiredRes = await member1Client.get('/api/members/expired');
    assert(memberExpiredRes.status === 403, 'Non-admin accessing /api/members/expired returns 403 Forbidden');

    // Admin getting expired list
    const adminExpiredRes = await adminClient.get('/api/members/expired');
    assert(adminExpiredRes.status === 200, 'Admin accessing /api/members/expired returns 200 OK');
    assert(adminExpiredRes.data.count >= 1, `Expired list contains expired members (count: ${adminExpiredRes.data.count})`);
    const expiredBobFound = adminExpiredRes.data.members.some(m => m.username === 'expired_bob');
    assert(expiredBobFound, 'Expired list includes seeded "expired_bob"');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 9. Testing Membership Renewal & Post-Renewal Booking');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Get Bob's ID
    const bobDoc = await User.findOne({ username: 'expired_bob' });
    const renewBobRes = await expiredClient.patch(`/api/members/${bobDoc._id}/renew`, {
      additionalMonths: 6,
      tier: 'Platinum'
    });
    assert(renewBobRes.status === 200, 'Expired member self-renewal returns 200 OK');
    assert(renewBobRes.data.user.membershipStatus === 'active', 'Renewed member status is active');
    assert(renewBobRes.data.user.membershipTier === 'Platinum', 'Renewed member tier is updated to Platinum');
    assert(renewBobRes.data.user.remainingDays >= 179, `Remaining days extended by ~180 days (got ${renewBobRes.data.user.remainingDays})`);

    // Verify Bob can now book a class with space (e.g. Zumba Cardio)
    const zumbaClass = await FitnessClass.findOne({ title: { $regex: /Zumba/i } });
    if (zumbaClass) {
      const bobBookingRes = await expiredClient.post(`/api/classes/${zumbaClass._id}/book`, {});
      assert(bobBookingRes.status === 200, 'Renewed member can successfully book classes now');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n🧪 10. Clean-up & Reset State');
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await seedDatabase();
    console.log('  ✅ Database restored to clean seeded state.\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Smoke Test Summary: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Smoke test crashed with error:', error);
    if (server) server.close();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    process.exit(1);
  }
}

if (require.main === module) {
  runSmokeTests();
}

module.exports = runSmokeTests;
