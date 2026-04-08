// config/mailer.js — Nodemailer transporter + helper functions
'use strict';

const nodemailer = require('nodemailer');

/* ── Transporter ──────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Gmail App Password (not your real password)
  },
});

/* ── Generic send ─────────────────────────────────────────── */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured — skipping send.');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to, subject, text, html,
    });
    console.log('📧  Email sent:', info.messageId);
  } catch (err) {
    // Log but never crash the server over a failed email
    console.error('❌  Email send failed:', err.message);
  }
}

/* ── Order confirmation to customer ──────────────────────── */
async function sendOrderConfirmation(order) {
  const itemRows = order.items.map(i =>
    `<tr>
       <td style="padding:8px;border:1px solid #e8ddd0">${i.emoji || ''} ${i.name}</td>
       <td style="padding:8px;border:1px solid #e8ddd0;text-align:center">${i.qty}</td>
       <td style="padding:8px;border:1px solid #e8ddd0;text-align:right">NGN ${(i.price * i.qty).toLocaleString()}</td>
     </tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fdf6ec;border-radius:12px;overflow:hidden">
      <div style="background:#0D1F17;padding:30px;text-align:center">
        <h1 style="color:#C9922A;margin:0;font-size:28px">🍽️ Taste Lounge</h1>
        <p style="color:#fdf6ec;margin:6px 0 0;font-size:14px">Order Confirmation</p>
      </div>
      <div style="padding:30px">
        <h2 style="color:#1A3C2A">Hi ${order.customer.name}! 👋</h2>
        <p style="color:#555">Thank you for your order. We've received it and will confirm shortly via WhatsApp.</p>

        <div style="background:#fff;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e8ddd0">
          <p style="margin:0 0 8px"><strong>Order ID:</strong> <span style="color:#C9922A">${order.orderId}</span></p>
          <p style="margin:0 0 8px"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString('en-NG')}</p>
          <p style="margin:0"><strong>Delivery Address:</strong> ${order.customer.address || 'Not provided'}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead>
            <tr style="background:#1A3C2A;color:#fdf6ec">
              <th style="padding:10px;text-align:left;border:1px solid #0D1F17">Item</th>
              <th style="padding:10px;text-align:center;border:1px solid #0D1F17">Qty</th>
              <th style="padding:10px;text-align:right;border:1px solid #0D1F17">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr style="background:#fdf6ec;font-weight:bold">
              <td colspan="2" style="padding:10px;border:1px solid #e8ddd0;text-align:right">TOTAL</td>
              <td style="padding:10px;border:1px solid #e8ddd0;text-align:right;color:#C9922A;font-size:18px">
                NGN ${order.total.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <p style="color:#555">Questions? Reach us on WhatsApp: <strong>09092495502</strong></p>
      </div>
      <div style="background:#0D1F17;padding:20px;text-align:center">
        <p style="color:#C9922A;margin:0;font-size:13px">
          © 2025 Taste Lounge — Founded by Chef B. (Blessing Kalu)
        </p>
      </div>
    </div>`;

  if (order.customer.email) {
    await sendMail({
      to:      order.customer.email,
      subject: `Taste Lounge Order Confirmed — ${order.orderId}`,
      text:    `Your order ${order.orderId} for NGN ${order.total.toLocaleString()} has been received. We'll confirm via WhatsApp shortly.`,
      html,
    });
  }

  // Also notify the business email
  await sendMail({
    to:      process.env.BUSINESS_EMAIL,
    subject: `🛎️ New Order ${order.orderId} — NGN ${order.total.toLocaleString()}`,
    text:    `New order from ${order.customer.name} (${order.customer.phone}). Total: NGN ${order.total.toLocaleString()}.`,
    html,
  });
}

module.exports = { sendMail, sendOrderConfirmation };
