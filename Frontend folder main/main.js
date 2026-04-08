
'use strict';

/* --------------------------------------------------
   0.  CONFIG — change API_BASE when you deploy
-------------------------------------------------- */
const API_BASE = 'https://taste-lounge-api.onrender.com/api';
// ↑ In production replace with your real server URL, e.g.:
// const API_BASE = 'https://api.tastelounge.com/api';

/* --------------------------------------------------
   1.  API HELPER
      Wraps fetch() with auth header + JSON parsing.
      Returns { success, data } or throws on network error.
-------------------------------------------------- */
const API = {

  /* Low-level request */
  async _request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token   = _getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res  = await fetch(API_BASE + path, opts);
    const data = await res.json();

    if (!res.ok) {
      // Attach HTTP status so callers can branch on it
      const err    = new Error(data.message || 'Request failed');
      err.status   = res.status;
      err.response = data;
      throw err;
    }
    return data;
  },

  get:    (path)        => API._request('GET',    path),
  post:   (path, body)  => API._request('POST',   path, body),
  put:    (path, body)  => API._request('PUT',    path, body),
  patch:  (path, body)  => API._request('PATCH',  path, body),
  delete: (path)        => API._request('DELETE', path),
};

/* --------------------------------------------------
   2.  TOKEN / SESSION HELPERS  (localStorage)
      Only the JWT and cart live in localStorage now.
      User profile is fetched fresh from the server.
-------------------------------------------------- */
const _getToken     = ()  => localStorage.getItem('tl_token') || null;
const _setToken     = (t) => localStorage.setItem('tl_token', t);
const _clearToken   = ()  => localStorage.removeItem('tl_token');

/* In-memory current user (fetched on page load) */
let _currentUser = null;

async function _loadCurrentUser() {
  const token = _getToken();
  if (!token) { _currentUser = null; return; }
  try {
    const res   = await API.get('/auth/me');
    _currentUser = res.user;
  } catch (err) {
    // Token expired or invalid — clear it
    if (err.status === 401) { _clearToken(); _currentUser = null; }
  }
}

/* --------------------------------------------------
   3.  CART STATE  (still localStorage — fast, offline-friendly)
-------------------------------------------------- */
let cart = _loadCart();

function _loadCart() {
  try { return JSON.parse(localStorage.getItem('tl_cart') || '[]'); }
  catch { return []; }
}
function _saveCart() { localStorage.setItem('tl_cart', JSON.stringify(cart)); }

/* --------------------------------------------------
   4.  CART MUTATIONS
-------------------------------------------------- */
function addToCart(name, price, emoji, category) {
  const existing = cart.find(i => i.name === name);
  if (existing) { existing.qty++; }
  else { cart.push({ name, price: Number(price), emoji, category, qty: 1 }); }
  _cartChanged();
  showToast(emoji + ' ' + name + ' added to cart!', 'success');
  const btn = document.querySelector('.floating-cart-btn');
  if (btn) { btn.style.transform = 'scale(1.35)'; setTimeout(() => { btn.style.transform = ''; }, 300); }
}

function changeQty(idx, delta) {
  if (!cart[idx]) return;
  cart[idx].qty = Math.max(1, cart[idx].qty + delta);
  _cartChanged();
}

function removeFromCart(idx) { cart.splice(idx, 1); _cartChanged(); }

function clearCart() { cart = []; _cartChanged(); }

function _cartChanged() {
  _saveCart();
  _renderCartCounts();
  _renderCartSidebar();
  _renderOrderPreview();
}

/* --------------------------------------------------
   5.  CART RENDERING
-------------------------------------------------- */
function _renderCartCounts() {
  const n = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-count, .floating-count').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'flex' : 'none';
  });
}

function _renderCartSidebar() {
  const body   = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <i class="bi bi-basket2"></i>
        <p><strong>Your cart is empty</strong></p>
        <p style="font-size:.85rem">Browse the menu and add something delicious!</p>
      </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  let grandTotal = 0;
  body.innerHTML = cart.map((item, idx) => {
    const sub = item.price * item.qty;
    grandTotal += sub;
    return `
    <div class="cart-item">
      <div class="cart-item-emoji">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">NGN ${sub.toLocaleString()}</div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="changeQty(${idx},-1)">&#8722;</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">&#43;</button>
        </div>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${idx})" title="Remove">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>`;
  }).join('');

  if (footer) {
    footer.style.display = 'block';
    const el = footer.querySelector('.cart-total .amount');
    if (el) el.textContent = 'NGN ' + grandTotal.toLocaleString();
  }
}

function _renderOrderPreview() {
  const list = document.getElementById('orderCartList');
  if (!list) return;
  if (cart.length === 0) {
    list.innerHTML = '<em style="color:#999">No items yet — browse the menu and click Add!</em>';
    return;
  }
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  list.innerHTML =
    cart.map(i =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e8ddd0">
         <span>${i.emoji} ${i.name} &times;${i.qty}</span>
         <strong style="color:#C9922A">NGN ${(i.price * i.qty).toLocaleString()}</strong>
       </div>`
    ).join('') +
    `<div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700">
       <span>Total:</span>
       <span style="color:#C9922A;font-size:1.05rem">NGN ${total.toLocaleString()}</span>
     </div>`;
}

/* --------------------------------------------------
   6.  CART SIDEBAR OPEN / CLOSE
-------------------------------------------------- */
function openCart()  {
  document.getElementById('cartSidebar')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartSidebar')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* --------------------------------------------------
   7.  ORDER BUILDER  — saves to real DB then opens WhatsApp / Email
-------------------------------------------------- */
async function _buildAndSaveOrder(channel) {
  if (cart.length === 0) {
    showToast('Your cart is empty! Add items from the menu first.', 'warning');
    return null;
  }

  /* Collect form fields (all optional — fall back to logged-in user) */
  const nameEl  = document.getElementById('orderName');
  const phoneEl = document.getElementById('orderPhone');
  const addrEl  = document.getElementById('orderAddress');
  const notesEl = document.getElementById('orderNotes');

  const customerName  = (nameEl  && nameEl.value.trim())  || (_currentUser && _currentUser.name)  || 'Customer';
  const customerPhone = (phoneEl && phoneEl.value.trim()) || (_currentUser && _currentUser.phone) || '';
  const address       = (addrEl  && addrEl.value.trim())  || (_currentUser && _currentUser.address) || '';
  const notes         = (notesEl && notesEl.value.trim()) || '';

  const grandTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  /* ── Save order to real backend ── */
  let orderId = 'TL-' + Date.now();   // fallback if server unreachable
  try {
    const res = await API.post('/orders', {
      customer: {
        name:    customerName,
        phone:   customerPhone,
        email:   _currentUser?.email || '',
        address,
      },
      items:   cart.map(i => ({ name: i.name, price: i.price, qty: i.qty, emoji: i.emoji, category: i.category })),
      total:   grandTotal,
      notes,
      channel,
    });
    orderId = res.order.orderId;
    console.log('✅ Order saved to database:', orderId);
  } catch (err) {
    /* If backend is down, still let the WhatsApp/email go through */
    console.warn('⚠️ Could not save order to server (offline?):', err.message);
    showToast('Order saved locally — sending now...', 'info');
  }

  /* ── Build plain-text message ── */
  const itemLines = cart
    .map(i => '  - ' + i.name + ' x' + i.qty + '  =  NGN ' + (i.price * i.qty).toLocaleString())
    .join('\n');

  const body =
    '--- TASTE LOUNGE ORDER ---\n' +
    'Order ID : ' + orderId                             + '\n' +
    'Date     : ' + new Date().toLocaleString('en-NG') + '\n\n' +
    'CUSTOMER DETAILS\n' +
    'Name    : ' + customerName                          + '\n' +
    'Phone   : ' + (customerPhone || 'Not provided')    + '\n' +
    'Address : ' + (address       || 'Not provided')    + '\n\n' +
    'ORDER ITEMS\n' +
    itemLines + '\n\n' +
    'TOTAL   : NGN ' + grandTotal.toLocaleString()      + '\n\n' +
    (notes ? 'Special Notes: ' + notes + '\n\n' : '') +
    'Powered by Taste Lounge - Est. 2025 by Chef B. (Blessing Kalu)';

  return { body, orderId, grandTotal };
}

/* --------------------------------------------------
   8.  WHATSAPP & EMAIL ORDER TRIGGERS
-------------------------------------------------- */
async function orderViaWhatsApp() {
  const result = await _buildAndSaveOrder('whatsapp');
  if (!result) return;

  const url = 'https://wa.me/2349092495502?text=' + encodeURIComponent(result.body);
  const win = window.open(url, '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = url;

  showToast('Order #' + result.orderId + ' opened in WhatsApp!', 'success');
  clearCart();
  closeCart();
}

async function orderViaEmail() {
  const result = await _buildAndSaveOrder('email');
  if (!result) return;

  const subject = encodeURIComponent('Taste Lounge Order - ' + result.orderId);
  const body    = encodeURIComponent(result.body);
  const url     = 'mailto:kammapanasonic@gmail.com?subject=' + subject + '&body=' + body;
  const win     = window.open(url, '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') window.location.href = url;

  showToast('Order #' + result.orderId + ' ready via Email!', 'success');
  clearCart();
  closeCart();
}

/* --------------------------------------------------
   9.  AUTHENTICATION — calls real backend
-------------------------------------------------- */
async function register(event) {
  if (event) event.preventDefault();

  const name     = document.getElementById('regName')?.value.trim()                || '';
  const email    = document.getElementById('regEmail')?.value.trim().toLowerCase() || '';
  const phone    = document.getElementById('regPhone')?.value.trim()               || '';
  const password = document.getElementById('regPassword')?.value                   || '';

  if (!name || !email || !password) { showToast('Please fill all required fields', 'warning'); return; }
  if (password.length < 6)          { showToast('Password must be at least 6 characters', 'warning'); return; }

  const btn = document.querySelector('#registerModal .btn-gold');
  _setLoading(btn, true, 'Creating account...');

  try {
    const res = await API.post('/auth/register', { name, email, phone, password });
    _setToken(res.token);
    _currentUser = res.user;
    _updateAuthUI();
    bootstrap.Modal.getInstance(document.getElementById('registerModal'))?.hide();
    showToast('Welcome to Taste Lounge, ' + name + '!', 'success');
  } catch (err) {
    showToast(err.message || 'Registration failed. Please try again.', 'error');
  } finally {
    _setLoading(btn, false, 'Create Account');
  }
}

async function login(event) {
  if (event) event.preventDefault();

  const email    = document.getElementById('loginEmail')?.value.trim().toLowerCase() || '';
  const password = document.getElementById('loginPassword')?.value                   || '';

  if (!email || !password) { showToast('Please enter your email and password', 'warning'); return; }

  const btn = document.querySelector('#loginModal .btn-gold');
  _setLoading(btn, true, 'Logging in...');

  try {
    const res = await API.post('/auth/login', { email, password });
    _setToken(res.token);
    _currentUser = res.user;
    _updateAuthUI();
    bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();

    if (res.user.role === 'admin') {
      showToast('Welcome back, Admin!', 'success');
      setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
    } else {
      showToast('Welcome back, ' + res.user.name + '!', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Login failed. Check your credentials.', 'error');
  } finally {
    _setLoading(btn, false, 'Log In');
  }
}

function logout() {
  _clearToken();
  _currentUser = null;
  _updateAuthUI();
  showToast('Logged out successfully', 'info');
  if (window.location.pathname.includes('admin')) window.location.href = 'index.html';
}

/* --------------------------------------------------
   10. AUTH UI UPDATE
-------------------------------------------------- */
function _updateAuthUI() {
  const user = _currentUser;
  document.querySelectorAll('.nav-guest').forEach(el => el.style.display = user ? 'none' : '');
  document.querySelectorAll('.nav-user').forEach(el  => el.style.display = user ? '' : 'none');
  document.querySelectorAll('.nav-admin').forEach(el => el.style.display = (user?.role === 'admin') ? '' : 'none');
  document.querySelectorAll('.user-display-name').forEach(el => el.textContent = user ? user.name.split(' ')[0] : '');

  if (user) {
    const nf = document.getElementById('orderName');
    const pf = document.getElementById('orderPhone');
    if (nf && !nf.value) nf.value = user.name  || '';
    if (pf && !pf.value) pf.value = user.phone || '';
  }
}

/* --------------------------------------------------
   11. LOADING BUTTON HELPER
-------------------------------------------------- */
function _setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm me-2"></span>' + label
    : '<i class="bi bi-box-arrow-in-right me-2"></i>' + label;
}

/* --------------------------------------------------
   12. MENU FILTER
-------------------------------------------------- */
function filterMenu(category) {
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === category));
  document.querySelectorAll('.menu-category-section').forEach(sec =>
    sec.style.display = (category === 'all' || sec.dataset.category === category) ? '' : 'none');
}

/* --------------------------------------------------
   13. TOAST NOTIFICATIONS
-------------------------------------------------- */
function showToast(message, type) {
  type = type || 'success';
  const colors = { success:'#2D6A4F', error:'#C0392B', warning:'#9A6F1A', info:'#1A3C2A' };
  const icons  = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const wrap   = document.createElement('div');
  wrap.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:99999';
  wrap.innerHTML =
    '<div style="background:' + (colors[type]||colors.success) + ';color:#fff;' +
    'min-width:260px;max-width:340px;border-radius:10px;padding:14px 18px 14px 14px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;' +
    'font-family:Outfit,sans-serif;font-size:.92rem;font-weight:600">' +
    '<span style="font-size:1.1rem">' + (icons[type]||'') + '</span>' +
    '<span style="flex:1">' + message + '</span>' +
    '<button onclick="this.closest(\'div\').parentElement.remove()" ' +
    'style="background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer;padding:0;opacity:.7">&times;</button></div>';
  document.body.appendChild(wrap);
  setTimeout(() => { if (wrap.parentNode) wrap.remove(); }, 4500);
}

/* --------------------------------------------------
   14. SCROLL ANIMATIONS
-------------------------------------------------- */
function _initAnimations() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.menu-item-card,.category-card,.testimonial-card,.stat-card').forEach(el => {
    el.style.cssText += 'opacity:0;transform:translateY(24px);transition:opacity .55s ease,transform .55s ease';
    obs.observe(el);
  });
}

/* --------------------------------------------------
   15. HERO COUNTER ANIMATION
-------------------------------------------------- */
function _initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      document.querySelectorAll('.counter-num').forEach(el => {
        const target = parseInt(el.dataset.target, 10) || 0;
        const suffix = el.dataset.suffix || '';
        let cur = 0;
        const step = Math.max(1, Math.ceil(target / 60));
        const t = setInterval(() => {
          cur = Math.min(cur + step, target);
          el.textContent = cur + suffix;
          if (cur >= target) clearInterval(t);
        }, 22);
      });
    });
  }, { threshold: 0.4 });
  const s = document.querySelector('.hero-stats');
  if (s) obs.observe(s);
}

/* --------------------------------------------------
   16. SMOOTH SCROLL
-------------------------------------------------- */
function _initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const t = document.querySelector(href);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const nc = document.querySelector('.navbar-collapse');
      if (nc && nc.classList.contains('show')) bootstrap.Collapse.getInstance(nc)?.hide();
    });
  });
}

/* --------------------------------------------------
   17. NAVBAR SCROLL STYLE
-------------------------------------------------- */
function _initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 60), { passive: true });
}

/* --------------------------------------------------
   18. PRELOADER
-------------------------------------------------- */
function _initPreloader() {
  window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('preloader')?.classList.add('hidden'), 1100);
  });
}

/* --------------------------------------------------
   19. MAIN INIT
-------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async function () {
  cart = _loadCart();

  _initPreloader();
  _initNavbar();
  _initSmoothScroll();
  _initAnimations();
  _initCounters();

  /* Cart overlay close */
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

  /* Fetch session from server (resolves quickly if token exists, skips if not) */
  await _loadCurrentUser();

  /* Sync all UI */
  _renderCartCounts();
  _renderCartSidebar();
  _renderOrderPreview();
  _updateAuthUI();

  /* App download toast — shows every visit until APK is downloaded */
  _initAppDownloadToast();

  console.log('🍽️ Taste Lounge frontend initialised. API:', API_BASE);
});


/* --------------------------------------------------
   APP DOWNLOAD TOAST
   Shows a rich animated banner prompting visitors to
   download the APK. Disappears permanently once the
   visitor clicks "Download App". Reappears on every
   page load until then.
-------------------------------------------------- */
function _initAppDownloadToast() {
  if (localStorage.getItem('tl_app_downloaded') === 'yes') return;

  const toast = document.createElement('div');
  toast.id = 'appDownloadToast';
  toast.innerHTML = `
    <div id="adt-inner">
      <div id="adt-icon-wrap">
        <div id="adt-pulse"></div>
        <div id="adt-icon">📲</div>
      </div>
      <div id="adt-body">
        <div id="adt-title">Get the Taste Lounge App!</div>
        <div id="adt-sub">Order faster &bull; Track meals &bull; Exclusive deals</div>
        <div id="adt-bar-track"><div id="adt-bar"></div></div>
      </div>
      <div id="adt-actions">
        <button id="adt-download-btn" onclick="_appToastDownload()">&#11015;&#65039; Download App</button>
        <button id="adt-later-btn"    onclick="_appToastDismiss()">Later</button>
      </div>
      <button id="adt-close" onclick="_appToastDismiss()" title="Close">&#10005;</button>
    </div>`;

  const css = `
    #appDownloadToast{position:fixed;bottom:-180px;left:50%;transform:translateX(-50%);width:min(96vw,480px);z-index:999999;transition:bottom .55s cubic-bezier(.34,1.56,.64,1);font-family:'Outfit',sans-serif}
    #appDownloadToast.adt-visible{bottom:24px}
    #adt-inner{background:linear-gradient(135deg,#0D1F17 0%,#1A3C2A 100%);border:1.5px solid rgba(201,146,42,.45);border-radius:18px;padding:16px 16px 16px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 48px rgba(0,0,0,.55),0 0 0 1px rgba(201,146,42,.1);position:relative;overflow:hidden}
    #adt-inner::before{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(201,146,42,.07) 50%,transparent 60%);animation:adt-shimmer 3.5s infinite}
    @keyframes adt-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
    #adt-icon-wrap{position:relative;flex-shrink:0;width:52px;height:52px;display:flex;align-items:center;justify-content:center}
    #adt-pulse{position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(201,146,42,.5);animation:adt-pulse 2s ease-out infinite}
    @keyframes adt-pulse{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.4);opacity:0}}
    #adt-icon{width:52px;height:52px;background:linear-gradient(135deg,#C9922A,#9A6F1A);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.55rem;box-shadow:0 4px 14px rgba(201,146,42,.4);position:relative}
    #adt-body{flex:1;min-width:0}
    #adt-title{font-weight:800;font-size:.97rem;color:#E8B84B;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #adt-sub{font-size:.75rem;color:rgba(253,246,236,.65);margin:2px 0 7px}
    #adt-bar-track{height:3px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
    #adt-bar{height:100%;width:0%;background:linear-gradient(90deg,#C9922A,#E8B84B);border-radius:2px;transition:width linear}
    #adt-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
    #adt-download-btn{background:linear-gradient(135deg,#C9922A,#9A6F1A);color:#0D1F17;border:none;border-radius:50px;padding:8px 14px;font-size:.78rem;font-weight:800;cursor:pointer;white-space:nowrap;font-family:'Outfit',sans-serif;box-shadow:0 3px 12px rgba(201,146,42,.4);transition:transform .2s,box-shadow .2s;letter-spacing:.2px}
    #adt-download-btn:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(201,146,42,.55)}
    #adt-download-btn:active{transform:scale(.97)}
    #adt-later-btn{background:rgba(255,255,255,.07);color:rgba(253,246,236,.55);border:1px solid rgba(255,255,255,.12);border-radius:50px;padding:6px 14px;font-size:.72rem;font-weight:500;cursor:pointer;font-family:'Outfit',sans-serif;transition:background .2s,color .2s;text-align:center}
    #adt-later-btn:hover{background:rgba(255,255,255,.13);color:rgba(253,246,236,.85)}
    #adt-close{position:absolute;top:8px;right:10px;background:none;border:none;color:rgba(253,246,236,.35);font-size:.8rem;cursor:pointer;padding:2px 4px;line-height:1;transition:color .2s}
    #adt-close:hover{color:rgba(253,246,236,.8)}
    @media(max-width:600px){#appDownloadToast{width:94vw}#appDownloadToast.adt-visible{bottom:78px}#adt-title{font-size:.88rem}#adt-sub{font-size:.7rem}#adt-icon,#adt-icon-wrap{width:44px;height:44px}#adt-icon{font-size:1.3rem;border-radius:11px}#adt-download-btn{font-size:.74rem;padding:7px 11px}}
    @media(max-width:360px){#adt-sub{display:none}#adt-inner{gap:8px;padding:12px 12px 12px 10px}}`;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  document.body.appendChild(toast);

  setTimeout(() => { toast.classList.add('adt-visible'); _appToastStartBar(); }, 2000);
}

let _appToastBarTimer = null;
function _appToastStartBar() {
  const bar = document.getElementById('adt-bar');
  if (!bar) return;
  bar.style.transition = 'width 8s linear';
  bar.style.width = '100%';
  _appToastBarTimer = setTimeout(() => {
    const inner = document.getElementById('adt-inner');
    if (inner) { inner.style.transition = 'transform .3s'; inner.style.transform = 'scale(1.03)'; setTimeout(() => { inner.style.transform = ''; }, 300); }
    bar.style.transition = 'none';
    bar.style.width = '0%';
    setTimeout(_appToastStartBar, 200);
  }, 8000);
}

function _appToastDownload() {
  localStorage.setItem('tl_app_downloaded', 'yes');
  /* ── Replace this URL with your real APK download link ── */
  const apkUrl = 'https://taste-lounge.netlify.app/taste-lounge.apk';
  const a = document.createElement('a');
  a.href = apkUrl; a.download = 'TasteLounge.apk'; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  _appToastHide(true);
  showToast('📲 Download started! Install the Taste Lounge App.', 'success');
}

function _appToastDismiss() { _appToastHide(false); }

function _appToastHide() {
  clearTimeout(_appToastBarTimer);
  const toast = document.getElementById('appDownloadToast');
  if (!toast) return;
  toast.classList.remove('adt-visible');
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 600);
}
