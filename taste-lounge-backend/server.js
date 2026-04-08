// server.js — Taste Lounge API entry point
// Founded 2025 by Chef B. (Blessing Kalu)
// ─────────────────────────────────────────
cat > /mnt/user-data/outputs/taste-loung-backend/ServiceWorkerRegistration.js << 'JSEOF'
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const connectDB      = require('./config/db');
const authRoutes     = require('./routes/auth');
const orderRoutes    = require('./routes/orders');
const userRoutes     = require('./routes/users');
const errorHandler   = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ──────────────────────────────
connectDB();

// ── Security Headers ────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────
// During dev:  FRONTEND_ORIGIN=*  (allows any origin)
// In prod:     FRONTEND_ORIGIN=https://yourdomain.com
app.use(cors({
  origin:      process.env.FRONTEND_ORIGIN || '*',
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body Parser ─────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Request Logger ─────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.options('*', cors());
// ── Rate Limiting ────────────────────────────────────
// Auth endpoints: stricter (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,   // 15 minutes
  max:      150,                // 20 attempts per window
  message:  { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API: more lenient
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      120,
  message:  { success: false, message: 'Too many requests. Please slow down.' },
});

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 1000,
  max: 20,
  message: {success: false, message: 'Too many login attempts. try again in 15 minutes.'}
}))

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Health Check ─────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🍽️  Taste Lounge API is running',
    version: '1.0.0',
    founded: '2025 — Chef B. (Blessing Kalu)',
    docs:    'See SETUP_GUIDE.md for full API reference',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    status:    'healthy',
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

// ── API Routes ───────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users',  userRoutes);

// ── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global Error Handler (must be last) ──────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🍽️  ══════════════════════════════════════');
  console.log('    TASTE LOUNGE — Backend Server');
  console.log('    Founded 2025 by Chef B. (Blessing Kalu)');
  console.log('    ══════════════════════════════════════');
  console.log(`\n🚀  Server running on http://localhost:${PORT}`);
  console.log(`🌍  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗  CORS origin : ${process.env.FRONTEND_ORIGIN || '*'}`);
  console.log('\n📋  Available routes:');
  console.log('    POST   /api/auth/register');
  console.log('    POST   /api/auth/login');
  console.log('    GET    /api/auth/me');
  console.log('    PUT    /api/auth/me');
  console.log('    PUT    /api/auth/password');
  console.log('    POST   /api/orders');
  console.log('    GET    /api/orders/mine');
  console.log('    GET    /api/orders           (admin)');
  console.log('    PATCH  /api/orders/:id/status (admin)');
  console.log('    GET    /api/orders/admin/dashboard (admin)');
  console.log('    GET    /api/users             (admin)');
  console.log('    PATCH  /api/users/:id/toggle-active (admin)');
  console.log('\n⚡  Ready to receive requests!\n');
});

// Graceful shutdown on SIGTERM (e.g. from hosting platforms)
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received — shutting down gracefully...');
  process.exit(0);
});

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const errorHandler = require('.\/middleware\/errorHandler');