require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const connectDB = require('./config/db');

// Import route handlers
const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const memberRoutes = require('./routes/memberRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enable trust proxy for Render and other reverse proxies to ensure secure cookies work
app.set('trust proxy', 1);

// Middleware: CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
};
app.use(cors(corsOptions));

// Middleware: Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Handle malformed JSON body errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body'
    });
  }
  next(err);
});

// Middleware: Session configuration with MongoDB persistence
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym_db',
  collectionName: 'sessions',
  ttl: 24 * 60 * 60 // 1 day in seconds
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'gym_management_api_super_secret_session_key_2026',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
      secure: NODE_ENV === 'production' // Only send over HTTPS in production
    }
  })
);

// Middleware: Initialize Passport authentication & session support
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// Base informational endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Gym & Fitness Club Management REST API',
    version: '1.0.0',
    documentation: {
      auth: '/api/auth',
      classes: '/api/classes',
      members: '/api/members'
    },
    status: 'online'
  });
});

// Health check endpoint for Render monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Mount application API routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/members', memberRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  // Log server errors in non-test mode
  if (NODE_ENV !== 'test') {
    console.error('API Error:', err);
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ')
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid format for field: ${err.path}`
    });
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({
      success: false,
      message: `An entry with this ${field} already exists`
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error'
  };

  // Only attach stack trace in non-production development
  if (NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
});

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT} (0.0.0.0:${PORT})`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start listening if run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
