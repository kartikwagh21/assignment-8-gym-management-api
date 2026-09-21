# 🏋️‍♂️ Gym & Fitness Club Management REST API

> **Assignment 08 — ITM Gym API**  
> **Tech Stack:** Node.js, Express.js, MongoDB, Mongoose, Passport.js (Local Strategy), express-session, connect-mongo, bcryptjs, dotenv, cors  
> **Deployment Platform:** Render (Web Service) & MongoDB Atlas (Cloud Database)

---

## 📋 Table of Contents
1. [Overview & Features](#-overview--features)
2. [Tech Stack & Architecture](#-tech-stack--architecture)
3. [Project Structure](#-project-structure)
4. [Business Logic & Rules](#-business-logic--rules)
5. [Seeded Credentials](#-seeded-credentials)
6. [API Endpoints Reference](#-api-endpoints-reference)
7. [Local Setup & Installation](#-local-setup--installation)
8. [Automated Testing & Smoke Tests](#-automated-testing--smoke-tests)
9. [Postman Collection & Running Guide](#-postman-collection--running-guide)
10. [Render Deployment Guide (Step-by-Step)](#-render-deployment-guide-step-by-step)
11. [Troubleshooting](#-troubleshooting)

---

## 🌟 Overview & Features

A full-featured, secure, and production-ready backend REST API for a **Gym & Fitness Club Management System**. It manages the complete lifecycle of gym memberships, automated plan duration calculations, workout class creation, and atomic concurrency-safe class enrollment.

### Key Highlights:
- 🔐 **Stateful Session Authentication**: Built using Passport.js Local Strategy with salted bcrypt password hashing and persistent session storage in MongoDB (`connect-mongo`).
- ⏳ **Automated 30-Day Plan Expiry Calculation**: Mongoose pre-validate hooks calculate membership expiration accurately based on a 30-day/month standard.
- 🏋️ **Atomic Class Capacity Enforcement**: Concurrency-safe atomic MongoDB operators (`findOneAndUpdate` with `$expr` and `$addToSet`) guarantee that classes never exceed their maximum seat capacity.
- 💳 **Smart Subscription Renewal**: Intelligent renewal logic that extends active memberships from their current expiry date and expired memberships from the current date.
- 🛡️ **Role-Based Access Control (RBAC)**: Fine-grained middleware separating regular member permissions from administrator privileges.
- 🩺 **Health Check & Proxy Awareness**: Ready for cloud reverse proxies (e.g., Render, Nginx) with `app.set('trust proxy', 1)` and `/health` monitoring.

---

## 🛠 Tech Stack & Architecture

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js 4.x
- **Database & ODM:** MongoDB Atlas with Mongoose 8.x
- **Session & Security:** `express-session`, `connect-mongo`, `passport`, `passport-local`, `bcryptjs`, `cors`
- **Environment Management:** `dotenv`
- **Testing:** Native Node fetch E2E test harness (`scripts/smokeTest.js`) & MongoDB In-Memory Server

---

## 📂 Project Structure

```text
Kartik_Wagh/
├── config/
│   ├── db.js                # Async MongoDB Mongoose connection with error handling
│   └── passport.js          # Passport Local strategy, serialize & deserialize logic
├── controllers/
│   ├── authController.js    # Register with auto-expiry calculation, login, getMe, logout
│   ├── classController.js   # Class CRUD, trainer search filter, atomic booking & cancellation
│   └── memberController.js  # Subscription renewal & expired members query
├── middleware/
│   ├── authMiddleware.js    # ensureAuthenticated and requireAdmin role guards
│   └── checkActiveMember.js # Checks membership status (not expired / not frozen)
├── models/
│   ├── FitnessClass.js      # Class schema, virtuals (spotsLeft, isFull), compound indexes
│   └── User.js              # User schema, bcrypt hash hook, pre-validate 30-day calculation
├── routes/
│   ├── authRoutes.js        # /api/auth routes
│   ├── classRoutes.js       # /api/classes routes
│   └── memberRoutes.js      # /api/members routes
├── utils/
│   └── dateHelper.js        # addMonthsAsDays (30 days/mo), calculateRemainingDays, regex escape
├── scripts/
│   ├── seed.js              # Idempotent seed script with --reset support
│   └── smokeTest.js         # Automated end-to-end 10-point test runner
├── postman/
│   ├── Gym_API.postman_collection.json   # Postman Collection v2.1 with pm.test assertions
│   └── Gym_API.postman_environment.json  # Postman Environment with baseUrl variable
├── .env.example             # Template environment configuration
├── .gitignore               # Excludes node_modules, .env, and logs
├── package.json             # Scripts, dependencies, and node engine requirements
├── render.yaml              # Render Infrastructure-as-Code Blueprint
├── server.js                # Server entry point, middleware stack, error handlers
└── README.md                # Comprehensive documentation
```

---

## ⚙️ Business Logic & Rules

### 1. 30-Days-Per-Month Plan Calculation
- Whenever a member registers or renews, their plan duration is calculated as:
  $$\text{Expiry Date} = \text{Base Date} + (\text{durationMonths} \times 30 \text{ days})$$
- A `pre('validate')` hook on the `User` schema triggers before Mongoose validates `membershipExpiryDate`, automatically assigning the computed date on new records.

### 2. Subscription Renewal Logic
- **Active Members (`membershipExpiryDate > now`)**: The extension starts from their existing `membershipExpiryDate`, adding $\text{additionalMonths} \times 30$ days.
- **Expired Members (`membershipExpiryDate <= now`)**: The extension starts from the current date (`now`), adding $\text{additionalMonths} \times 30$ days.
- Status is automatically reactivated (`membershipStatus: 'active'`).

### 3. Atomic Seat-Capacity Enforcement
- Class enrollment uses atomic MongoDB operations to prevent race conditions during high concurrency:
```javascript
FitnessClass.findOneAndUpdate(
  {
    _id: classId,
    scheduleDate: { $gte: new Date() },
    enrolledMembers: { $ne: userId },
    $expr: { $lt: [{ $size: "$enrolledMembers" }, "$maxCapacity"] }
  },
  { $addToSet: { enrolledMembers: userId } },
  { new: true }
);
```
- If a class is full, the API immediately responds with `400 Bad Request: Class capacity reached`.

---

## 🔑 Seeded Credentials

Run `npm run seed` to populate your database with the following demo accounts:

| Role | Username | Password | Email | Tier | Status |
|---|---|---|---|---|---|
| **Admin** | `admin` | `Admin@123` | `admin@gym.com` | `Platinum` | `active` (365 days) |
| **Member** | `fit_sam` | `Password@123` | `sam@fit.com` | `Gold` | `active` (90 days) |
| **Member** | `yoga_amy` | `Password@123` | `amy@fit.com` | `Silver` | `active` (60 days) |
| **Member** | `lift_raj` | `Password@123` | `raj@fit.com` | `Bronze` | `active` (30 days) |
| **Member (Expired)** | `expired_bob` | `Password@123` | `bob@fit.com` | `Bronze` | `expired` (-15 days) |
| **Member (Frozen)** | `frozen_claire` | `Password@123` | `claire@fit.com` | `Silver` | `frozen` (30 days) |

---

## 📡 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Access | Description | Request Body Example | Status Codes |
|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new member with duration | `{"username":"fit_sam","email":"sam@fit.com","password":"Password@123","membershipTier":"Gold","durationMonths":3}` | `201 Created`<br>`400 Bad Request` |
| `POST` | `/api/auth/login` | Public | Login via Passport Local strategy | `{"username":"fit_sam","password":"Password@123"}` | `200 OK`<br>`401 Unauthorized` |
| `GET` | `/api/auth/me` | Logged In | Get profile & `remainingDays` | None | `200 OK`<br>`401 Unauthorized` |
| `POST` | `/api/auth/logout` | Logged In | Log out and destroy session | None | `200 OK` |

### 🏋️ Fitness Classes & Bookings (`/api/classes`)

| Method | Endpoint | Access | Description | Request Body Example | Status Codes |
|---|---|---|---|---|---|
| `GET` | `/api/classes` | Public | List upcoming classes (`?trainer=Maria`) | None | `200 OK` |
| `GET` | `/api/classes/:id` | Public | Get class details with enrolled members | None | `200 OK`<br>`404 Not Found` |
| `POST` | `/api/classes` | Admin | Create a new fitness class | `{"title":"Zumba Cardio","trainerName":"Maria","scheduleDate":"2026-05-15T09:00:00Z","maxCapacity":20,"durationMinutes":45}` | `201 Created`<br>`400 Bad Request`<br>`403 Forbidden` |
| `POST` | `/api/classes/:id/book` | Active Member | Book into a class (enforces capacity) | None | `200 OK`<br>`400 Class Full / Expired` |
| `DELETE` | `/api/classes/:id/cancel` | Enrolled Member | Cancel booking and release spot | None | `200 OK`<br>`400 Bad Request` |

### 💳 Membership Management (`/api/members`)

| Method | Endpoint | Access | Description | Request Body Example | Status Codes |
|---|---|---|---|---|---|
| `PATCH` | `/api/members/:id/renew` | Member/Admin | Extend expiry date by 30 days/mo | `{"additionalMonths": 6, "tier": "Platinum"}` | `200 OK`<br>`400 Bad Request`<br>`403 Forbidden`<br>`404 Not Found` |
| `GET` | `/api/members/expired` | Admin | List all members with expired plans | None | `200 OK`<br>`403 Forbidden` |

### 🩺 Health & Info

| Method | Endpoint | Access | Description | Response |
|---|---|---|---|---|
| `GET` | `/` | Public | API Root Info & version | `{"success":true,"message":"...","status":"online"}` |
| `GET` | `/health` | Public | Uptime & health check | `{"status":"ok","uptime":120}` |

---

## 💻 Local Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- Free MongoDB Atlas cluster or local MongoDB instance

### 2. Installation
```bash
# Navigate to the project directory
cd Kartik_Wagh

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 3. Configure `.env`
Open `.env` and configure your credentials:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/gym_db?retryWrites=true&w=majority
SESSION_SECRET=a_long_random_secure_secret_key_12345
CORS_ORIGIN=http://localhost:3000
```

### 4. Seed the Database
```bash
npm run seed
```
*(To wipe and reseed clean data, run: `node scripts/seed.js --reset`)*

### 5. Start the Server
```bash
# Development mode with hot-reload
npm run dev

# Production mode
npm start
```
The server will start at `http://localhost:5000`.

---

## 🧪 Automated Testing & Smoke Tests

The project includes an end-to-end automated test runner that verifies all grading rubric points:

```bash
npm test
```

### What the smoke test verifies:
1. ✅ Registration with `durationMonths: 1` sets `membershipExpiryDate` to **exactly 30 days** in the future.
2. ✅ Rejects duplicate usernames & emails with `400 Bad Request`.
3. ✅ Authenticates valid credentials, rejects invalid logins with `401 Unauthorized`, and verifies `/api/auth/me` includes `remainingDays`.
4. ✅ Enforces RBAC: Admins can create classes; non-admins receive `403 Forbidden`.
5. ✅ Enforces capacity constraints: In a class of capacity 2, 2 members succeed and the 3rd fails with `400 Bad Request: Class capacity reached`.
6. ✅ Double-booking attempts return `400 Bad Request`.
7. ✅ Booking cancellation increments `spotsLeft` and allows another member to claim the spot.
8. ✅ Expired members receive `400 Bad Request` when attempting to book.
9. ✅ Renewing an expired member adds 30 days/month, updates status to `active`, and restores booking privileges.
10. ✅ Database resets cleanly after test execution.

---

## 📬 Postman Collection & Running Guide

The `postman/` directory contains:
- `postman/Gym_API.postman_collection.json`
- `postman/Gym_API.postman_environment.json`

### Recommended Execution Order in Postman:
1. Import both `.json` files into Postman.
2. Select the **"Gym API - Local & Render"** environment.
3. If testing against Render, update the `baseUrl` variable to your Render URL (e.g. `https://itm-assignment-08-gym-api.onrender.com`).
4. Execute requests in the following sequence:
   - **1. Health & Overview:** `API Root Info` ➡️ `Health Check`
   - **2. Authentication:** `Register New Member` ➡️ `Login Member` ➡️ `Get Current Profile` ➡️ `Login Admin`
   - **3. Classes & Bookings:** `Create Workout Class [Admin]` ➡️ `List Upcoming Classes` ➡️ `Get Class by ID` ➡️ `Book Class` ➡️ `Double Booking Attempt` ➡️ `Cancel Booking`
   - **4. Membership:** `Renew Membership` ➡️ `List Expired Members [Admin]`

---

## ☁️ Render Deployment Guide (Step-by-Step)

### Step 1: Prepare MongoDB Atlas
1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 cluster**.
3. Under **Security ➡️ Database Access**, create a user with **Read and write to any database** permissions.
4. Under **Security ➡️ Network Access**, click **Add IP Address** ➡️ **Allow Access from Anywhere (`0.0.0.0/0`)** (Required for Render's dynamic IP ranges).
5. Copy your connection URI:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/gym_db?retryWrites=true&w=majority
   ```
6. Run `npm run seed` locally once using this Atlas URI to seed initial admin and class records.

### Step 2: Push to GitHub
```bash
git add .
git commit -m "feat: complete Gym & Fitness Club Management REST API"
git push -u origin main
```

### Step 3: Create Render Web Service
1. Log in to [render.com](https://render.com) and click **New + ➡️ Web Service**.
2. Connect your GitHub repository: `assignment-8-gym-management-api`.
3. Configure the service settings:
   - **Name:** `itm-assignment-08-gym-api`
   - **Language / Runtime:** `Node`
   - **Branch:** `main`
   - **Root Directory:** `Kartik_Wagh` *(or leave blank if repository root is Kartik_Wagh)*
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Under **Advanced Settings ➡️ Health Check Path**, set:
   ```text
   /health
   ```
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/gym_db?retryWrites=true&w=majority` |
   | `SESSION_SECRET` | `a_long_random_production_secret_key_8f3d81b9` |

6. Click **Create Web Service**.

### Step 4: Verify Live Service
Once the deployment displays **Live**, test with curl:
```bash
BASE=https://<your-service-name>.onrender.com

# 1. Health check
curl $BASE/health

# 2. List upcoming classes
curl $BASE/api/classes

# 3. Register a member
curl -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"live_user","email":"live@gym.com","password":"Password@123","durationMonths":1}'
```

---

## 🔧 Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `MongooseServerSelectionError` / Timeout | Atlas IP whitelist does not allow Render | In Atlas ➡️ Network Access, add `0.0.0.0/0`. |
| `bad auth: Authentication failed` | Incorrect password or unescaped characters in URI | Check Atlas DB user credentials. URL-encode special characters in password (`@` $\rightarrow$ `%40`, `#` $\rightarrow$ `%23`). |
| Session lost / `/api/auth/me` returns 401 | Secure cookie over HTTP or missing proxy setting | Ensure `app.set('trust proxy', 1)` is enabled and test with `https://` URL on Render. |
| Cold start delay (30-60s) | Render free tier spins down after 15 min of inactivity | Normal on free tier. The first ping wakes the instance. |
| Over-capacity booking allowed | Missing atomic check | The atomic `$expr: { $lt: [{ $size: "$enrolledMembers" }, "$maxCapacity"] }` prevents this. |

---

## 👨‍💻 Author & Submission Info
- **Developer:** Kartik Wagh
- **Repository:** `assignment-8-gym-management-api` / `itm-assignment-08-gym-api`
- **License:** ISC
