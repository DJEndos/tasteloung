// routes/users.js — /api/users/*   (admin management)
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

/* All routes in this file require admin */
router.use(protect, adminOnly);

/* ─────────────────────────────────────────────────
   GET /api/users          — list all customers
   GET /api/users?search=  — search by name/email
───────────────────────────────────────────────── */
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const filter = { role: 'customer' };

    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      pagination: { page: Number(page), limit: Number(limit), total },
      users,
    });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   GET /api/users/:id
───────────────────────────────────────────────── */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Attach their order count
    const Order      = require('../models/Order');
    const orderCount = await Order.countDocuments({ user: user._id });
    const totalSpent = await Order.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    res.json({
      success: true,
      user,
      orderCount,
      totalSpent: totalSpent[0]?.total || 0,
    });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   PATCH /api/users/:id/toggle-active
   Enable / disable a customer account
───────────────────────────────────────────────── */
router.patch('/:id/toggle-active', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot deactivate admin accounts' });
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `Account ${user.isActive ? 'activated' : 'deactivated'}`,
      isActive: user.isActive,
    });

  } catch (err) { next(err); }
});

module.exports = router;
