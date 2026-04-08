// middleware/auth.js  — JWT verification & role guards
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* ── Verify JWT and attach user to req.user ── */
const protect = async (req, res, next) => {
  try {
    let token;

    // Accept token from Authorization header ("Bearer <token>")
    // or from a cookie named "tl_token" (if you add cookie-parser later)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised — please log in',
      });
    }

    // Verify signature + expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data (catches deleted/deactivated accounts)
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or deactivated',
      });
    }

    req.user = user;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired — please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/* ── Admin-only guard (use after protect) ── */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({
    success: false,
    message: 'Access denied — admins only',
  });
};

/* ── Helper: sign a JWT for a given user ── */
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = { protect, adminOnly, signToken };
