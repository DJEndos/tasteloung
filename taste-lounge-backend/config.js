/* =====================================================
   TASTE LOUNGE — config.js
   ─────────────────────────────────────────────────
   This file controls which backend server the
   frontend talks to.

   HOW TO USE:
   ─────────────────────────────────────────────────
   1. While developing on your computer:
      Set MODE = 'local'
      Make sure your backend is running: npm run dev

   2. After you deploy backend to Render/Railway:
      Set MODE = 'live'
      Paste your Render URL in LIVE_URL below

   3. Included in BOTH index.html and admin.html
      BEFORE main.js — so main.js reads window.TL_API
===================================================== */

const MODE = 'local'; // ← change to 'live' after deploying

const URLS = {
  local: 'http://localhost:5000/api',
  live:  'https://YOUR-APP-NAME.onrender.com/api', // ← paste your Render URL here
};

// Expose globally so main.js picks it up
window.TL_API = URLS[MODE] || URLS.local;

console.log('🍽️ Taste Lounge config loaded. API →', window.TL_API);
