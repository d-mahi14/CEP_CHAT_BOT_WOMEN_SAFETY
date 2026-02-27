// =====================================================
// MAIN SERVER FILE - Node.js Backend
// =====================================================
// Express server with Supabase integration
// Handles authentication, profiles, and emergency contacts
// =====================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const sosRoutes = require('./routes/sos');
const aiRoutes  = require('./routes/ai');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const emergencyRoutes = require('./routes/emergency');

// Import config
const { testConnection } = require('./config/supabase');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// =====================================================
// MIDDLEWARE CONFIGURATION
// =====================================================

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan('dev'));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all routes
app.use(limiter);

// Strict rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// =====================================================
// ROUTES
// =====================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Safety App API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/emergency-contacts', emergencyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Safety App API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh'
      },
      profile: {
        get: 'GET /api/profile',
        update: 'PUT /api/profile',
        preferences: 'GET /api/profile/preferences',
        updatePreferences: 'PUT /api/profile/preferences',
        languages: 'GET /api/profile/languages'
      },
      emergencyContacts: {
        list: 'GET /api/emergency-contacts',
        create: 'POST /api/emergency-contacts',
        get: 'GET /api/emergency-contacts/:id',
        update: 'PUT /api/emergency-contacts/:id',
        delete: 'DELETE /api/emergency-contacts/:id'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use('/api/sos', sosRoutes);
app.use('/api/ai',  aiRoutes);


// =====================================================
// SERVER STARTUP
// =====================================================

// =====================================================
// SERVER STARTUP
// =====================================================

let serverStarted = false;

const startServer = async () => {
  if (serverStarted) return; // prevents double start
  serverStarted = true;

  try {
    console.log('🔄 Testing Supabase connection...');

    const connected = await testConnection();

    if (!connected) {
      console.warn('⚠️ Supabase connection failed — starting server anyway');
    } else {
      console.log('✅ Supabase connected');
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(50));
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('Startup error:', error);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }
};

startServer();
// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;