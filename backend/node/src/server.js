// =====================================================
// MAIN SERVER FILE - Node.js Backend
// =====================================================
// FIX SUMMARY:
//   1. Moved /api/sos and /api/ai routes BEFORE the 404 handler
//      (previously unreachable — registered after 404 catch-all)
//   2. Removed duplicate startServer() call at bottom of file
//   3. PORT default changed to 5000 to match .env
//
// ARCH CHANGE:
//   Python/FastAPI backend removed entirely.
//   /api/ai now calls Groq API directly from this Node.js server.
//   Set GROQ_API_KEY in .env — no other service needed.
// =====================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const emergencyRoutes = require('./routes/emergency');
const sosRoutes = require('./routes/sos');   // FIX: was added after 404 handler
const aiRoutes  = require('./routes/ai');    // FIX: was added after 404 handler
const legalRoutes = require('./routes/legal');
// Import config
const { testConnection } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000; // FIX: default matches .env PORT=5000

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/legal', legalRoutes);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// =====================================================
// ROUTES  ← FIX: ALL routes must be before 404 handler
// =====================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Safety App API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/auth',               authLimiter, authRoutes);
app.use('/api/profile',            profileRoutes);
app.use('/api/emergency-contacts', emergencyRoutes);
app.use('/api/sos',                sosRoutes);   // FIX: moved before 404 handler
app.use('/api/ai',                 aiRoutes);    // FIX: moved before 404 handler

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Safety App API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login:    'POST /api/auth/login',
        logout:   'POST /api/auth/logout',
        me:       'GET /api/auth/me',
        refresh:  'POST /api/auth/refresh'
      },
      profile: {
        get:               'GET /api/profile',
        update:            'PUT /api/profile',
        preferences:       'GET /api/profile/preferences',
        updatePreferences: 'PUT /api/profile/preferences',
        languages:         'GET /api/profile/languages'
      },
      emergencyContacts: {
        list:   'GET /api/emergency-contacts',
        create: 'POST /api/emergency-contacts',
        get:    'GET /api/emergency-contacts/:id',
        update: 'PUT /api/emergency-contacts/:id',
        delete: 'DELETE /api/emergency-contacts/:id'
      },
      sos: {
        trigger:   'POST /api/sos/trigger',
        location:  'POST /api/sos/:incidentId/location',
        resolve:   'PATCH /api/sos/:incidentId/resolve',
        active:    'GET /api/sos/active',
        history:   'GET /api/sos/history',
        helplines: 'GET /api/sos/helplines',
        nearby:    'GET /api/sos/nearby'
      },
      ai: {
        chat:    'POST /api/ai/chat',
        analyze: 'POST /api/ai/analyze',
        history: 'GET /api/ai/history',
        context: 'DELETE /api/ai/context'
      }
    }
  });
});

// 404 handler — must be AFTER all route registrations
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

// =====================================================
// SERVER STARTUP — FIX: single call, no duplicate
// =====================================================

const startServer = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    const connected = await testConnection();
    if (!connected) {
      console.warn('⚠️  Supabase connection failed — starting server anyway');
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

startServer(); // FIX: called only ONCE

process.on('SIGTERM', () => { console.log('⚠️  SIGTERM received'); process.exit(0); });
process.on('SIGINT',  () => { console.log('⚠️  SIGINT received');  process.exit(0); });

module.exports = app;