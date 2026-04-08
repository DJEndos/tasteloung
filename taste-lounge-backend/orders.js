// routes/orders.js — /api/orders/*
const express   = require('express');
const router    = express.Router();
const Order     = require('../models/Order');
const { protect, adminOnly } = require('../middleware/auth');

/* ─────────────────────────────────────────────────
   POST /api/orders
   Public (guests can order without logging in)
   Body: { customer:{name,phone,email,address}, items:[], total, notes, channel }
───────────────────────────────────────────────── */
router.post('/', async (req, res, next) => {
  try {
    const { customer, items, total, notes, channel } = req.body;

    // Basic validation
    if (!customer?.name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // Calculate total server-side for security (don't trust client total)
    const serverTotal = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.qty)), 0);

    // Attach user if logged in (optional)
    const userId = req.headers.authorization ? await _extractUserId(req) : null;

    const order = await Order.create({
      customer,
      items,
      total: serverTotal,
      notes: notes || '',
      channel: channel || 'website',
      user: userId,
    });

    res.status(201).json({ success: true, order });

  } catch (err) { next(err); }
});

/* Helper: extract userId from JWT without blocking on failure */
const jwt = require('jsonwebtoken');
async function _extractUserId(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────
   GET /api/orders/mine
   Protected — customer sees their own orders
───────────────────────────────────────────────── */
router.get('/mine', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: orders.length, orders });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   GET /api/orders                (admin)
   GET /api/orders?status=pending (admin, filtered)
   GET /api/orders?page=2         (admin, paginated)
───────────────────────────────────────────────── */
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30, search } = req.query;

    const filter = {};
    if (status)  filter.status = status;
    if (search)  filter['customer.name'] = { $regex: search, $options: 'i' };

    const skip   = (Number(page) - 1) * Number(limit);
    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email phone');

    // Summary stats in the same response (useful for admin dashboard)
    const stats = await Order.aggregate([
      { $group: {
          _id:           '$status',
          count:         { $sum: 1 },
          totalRevenue:  { $sum: '$total' },
      }},
    ]);

    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    res.json({
      success: true,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
      stats,
      totalRevenue: totalRevenue[0]?.total || 0,
      orders,
    });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   GET /api/orders/:id    (admin or order owner)
───────────────────────────────────────────────── */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id })
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only admin or the order's owner can view it
    const isOwner = order.user && order.user._id.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorised to view this order' });
    }

    res.json({ success: true, order });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   PATCH /api/orders/:id/status   (admin only)
   Body: { status, adminNote? }
───────────────────────────────────────────────── */
router.patch('/:id/status', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const allowed = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const update = { status };
    if (adminNote !== undefined) update.adminNote = adminNote;

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.id },
      update,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, message: `Order ${req.params.id} marked as "${status}"`, order });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   DELETE /api/orders/:id   (admin only)
───────────────────────────────────────────────── */
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await Order.findOneAndDelete({ orderId: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted', orderId: req.params.id });

  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────
   GET /api/orders/admin/dashboard   (admin only)
   Returns summary stats for the dashboard cards
───────────────────────────────────────────────── */
router.get('/admin/dashboard', protect, adminOnly, async (req, res, next) => {
  try {
    const User = require('../models/User');

    const [totalOrders, totalRevenue, pendingOrders, totalCustomers, topItems, recentOrders] =
      await Promise.all([
        Order.countDocuments(),
        Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
        Order.countDocuments({ status: 'pending' }),
        User.countDocuments({ role: 'customer' }),

        // Top 5 selling items across all orders
        Order.aggregate([
          { $unwind: '$items' },
          { $group: { _id: '$items.name', emoji: { $first: '$items.emoji' }, totalSold: { $sum: '$items.qty' } } },
          { $sort: { totalSold: -1 } },
          { $limit: 5 },
        ]),

        // 10 most recent orders
        Order.find().sort({ createdAt: -1 }).limit(10),
      ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue:   totalRevenue[0]?.total || 0,
        pendingOrders,
        totalCustomers,
      },
      topItems,
      recentOrders,
    });

  } catch (err) { next(err); }
});

module.exports = router;
