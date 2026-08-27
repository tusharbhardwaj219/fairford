/* =====================================================================
   retailer.js — Fair Ford Pharmaceuticals · Retailer portal
   Tabbed dashboard: Overview · Products · Cart · Orders · Wishlist · Profile.
   Backend-backed only (no invented wallet/rewards/invoice features).
   ===================================================================== */
'use strict';

/* auth guard (retailer only) */
(function () {
  var token = localStorage.getItem('ff_token');
  if (!token) { window.location.replace('/login&signup.html'); return; }
  try {
    var u = JSON.parse(localStorage.getItem('ff_user'));
    if (u && u.role === 'dist') { window.location.replace('/distributor.html'); return; }
    if (u && (u.role === 'admin' || u.role === 'superadmin')) { window.location.replace('/superadmin.html'); return; }
  } catch (e) {}
})();

var $ = function (id) { return document.getElementById(id); };
var PRODUCTS = [], PROFILE = null, ORDERS = [], ORDER_MAP = {};
var CART = readCart(), searchTimer, ONLINE_PAY_ON = false;

function readCart() { try { return JSON.parse(localStorage.getItem('ff_cart') || '[]'); } catch (e) { return []; } }
function writeCart() { localStorage.setItem('ff_cart', JSON.stringify(CART)); }
function readWish() { try { return JSON.parse(localStorage.getItem('ff_wish') || '[]'); } catch (e) { return []; } }
function writeWish(w) { localStorage.setItem('ff_wish', JSON.stringify(w)); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function toast(m) { var t = $('rtToast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }

function logout() {
  if (window.showLogoutConfirm) window.showLogoutConfirm(function () { window.lcDoLogout('/login&signup.html'); });
  else { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); sessionStorage.removeItem('ff_user'); window.location.replace('/login&signup.html'); }
}

function api(path, opts) {
  opts = opts || {};
  var token = localStorage.getItem('ff_token');
  return fetch('/api' + path, { method: opts.method || 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, opts.headers || {}), body: opts.body })
    .then(function (r) { if (r.status === 401) { logout(); throw new Error('Session expired'); } return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.message || ('HTTP ' + r.status)); return b; }); });
}

/* ================= SECTION NAV ================= */
function showSection(sec) {
  document.querySelectorAll('.pf-nav-btn').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-sec') === sec); });
  document.querySelectorAll('.pf-section').forEach(function (s) { s.classList.toggle('is-on', s.getAttribute('data-sec') === sec); });
  if (sec === 'wishlist') renderWishlist();
  if (sec === 'rewards') loadRewardsSection();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', function (e) {
  var nav = e.target.closest('.pf-nav-btn'); if (nav) { showSection(nav.getAttribute('data-sec')); return; }
  var go = e.target.closest('[data-go]'); if (go) { showSection(go.getAttribute('data-go')); return; }
});

/* ================= PROFILE ================= */
function loadProfile() {
  api('/retailer/profile').then(function (d) {
    var u = d.user || {}; PROFILE = u;
    var name = u.shopName || u.name || 'Retailer';
    $('rtUserName').textContent = name;
    $('rtAvatar').textContent = (name[0] || 'R').toUpperCase();
    $('rtHello').textContent = 'Welcome back, ' + (u.name || name).split(' ')[0];
    var a = u.shopAddress || {};
    $('afShop').value = u.shopName || ''; $('afStreet').value = a.street || '';
    $('afCity').value = a.city || ''; $('afState').value = a.state || ''; $('afPincode').value = a.pincode || '';
    $('rtBanner').style.display = (u.status && u.status !== 'active') ? '' : 'none';
    updateCartUI();
  }).catch(function (e) { toast('⚠ ' + e.message); });
}
function saveAddress() {
  var btn = $('afSave'); btn.disabled = true;
  api('/retailer/profile', { method: 'PUT', body: JSON.stringify({ shopName: $('afShop').value.trim(), shopAddress: { street: $('afStreet').value.trim(), city: $('afCity').value.trim(), state: $('afState').value.trim(), pincode: $('afPincode').value.trim() } }) })
    .then(function (d) { PROFILE = d.user; var n = d.user.shopName || d.user.name || 'Retailer'; $('rtUserName').textContent = n; toast('✓ Address saved'); updateCartUI(); })
    .catch(function (e) { toast('⚠ ' + e.message); })
    .finally(function () { btn.disabled = false; });
}

/* ================= PRODUCTS ================= */
function loadProducts(search) {
  var q = new URLSearchParams({ limit: '500' }); if (search) q.set('search', search);
  api('/retailer/products?' + q.toString()).then(function (d) { PRODUCTS = (d.data && d.data.products) || []; renderProducts(); updateCartUI(); })
    .catch(function (e) { $('rtProducts').innerHTML = '<div class="pf-empty" style="grid-column:1/-1"><p>' + esc(e.message) + '</p></div>'; });
}
function productById(id) { return PRODUCTS.find(function (p) { return String(p._id) === String(id); }); }
function prodCard(p) {
  var out = (p.stock || 0) <= 0;
  var url = (p.image && p.image.url) || (p.images && p.images[0] && p.images[0].url);
  var wished = readWish().indexOf(String(p._id)) >= 0;
  return '<div class="pf-prod">' +
    '<div class="pf-prod-thumb">' + (url ? '<img src="' + esc(url) + '" alt="' + esc(p.name) + '" loading="lazy">' : esc((p.name || '?').charAt(0).toUpperCase())) + '</div>' +
    '<div class="pf-prod-body">' +
      '<p class="pf-prod-name">' + esc(p.name || 'Product') + '</p>' +
      '<p class="pf-prod-brand">' + esc(p.brand || '') + '</p>' +
      '<div class="pf-prod-foot"><div><div class="pf-price">' + inr(p.retailerPrice) + '</div><div class="pf-stock' + (out ? ' out' : '') + '">' + (out ? 'Out of stock' : 'In stock') + '</div></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="pf-btn pf-btn-ghost pf-btn-sm" data-wish="' + p._id + '" aria-label="Wishlist" title="Wishlist" style="padding:7px 9px;color:' + (wished ? 'var(--err)' : 'inherit') + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="' + (wished ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.9 8.9 8.8-8.9a5.5 5.5 0 0 0 0-7.8z"/></svg></button>' +
          '<button class="pf-btn pf-btn-primary pf-btn-sm" data-add="' + p._id + '"' + (out ? ' disabled' : '') + '>Add</button>' +
        '</div>' +
      '</div>' +
    '</div></div>';
}
function renderProducts() {
  var box = $('rtProducts');
  if (!PRODUCTS.length) { box.innerHTML = '<div class="pf-empty" style="grid-column:1/-1"><p>No products found.</p></div>'; return; }
  box.innerHTML = PRODUCTS.map(prodCard).join('');
}

/* ================= WISHLIST ================= */
function updateWishBadge() { var n = readWish().length; $('rtWishBadge').textContent = n; $('rtWishBadge').style.display = n ? '' : 'none'; }
function toggleWish(id) {
  var w = readWish(), i = w.indexOf(String(id));
  if (i >= 0) { w.splice(i, 1); toast('Removed from wishlist'); } else { w.push(String(id)); toast('Saved to wishlist'); }
  writeWish(w); updateWishBadge(); renderProducts();
  if (document.querySelector('.pf-section[data-sec="wishlist"]').classList.contains('is-on')) renderWishlist();
}
function renderWishlist() {
  var box = $('rtWishlist'), w = readWish();
  var items = w.map(productById).filter(Boolean);
  if (!items.length) { box.innerHTML = '<div class="pf-empty" style="grid-column:1/-1"><div class="pf-empty-ico"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.9 8.9 8.8-8.9a5.5 5.5 0 0 0 0-7.8z"/></svg></div><h3>No saved products</h3><p>Tap the heart on a product to save it here.</p><button class="pf-btn pf-btn-primary" data-go="products">Browse products</button></div>'; return; }
  box.innerHTML = items.map(prodCard).join('');
}

/* ================= CART ================= */
function addToCart(id) {
  var it = CART.find(function (c) { return String(c.id) === String(id); });
  if (it) it.qty += 1; else CART.push({ id: String(id), qty: 1 });
  writeCart(); updateCartUI(); toast('Added to cart');
}
function setQty(id, qty) {
  if (qty < 1) CART = CART.filter(function (c) { return String(c.id) !== String(id); });
  else { var it = CART.find(function (c) { return String(c.id) === String(id); }); if (it) it.qty = qty; }
  writeCart(); updateCartUI();
}
function cartDetailed() { return CART.map(function (c) { return { c: c, p: productById(c.id) }; }).filter(function (x) { return x.p; }); }
function updateCartUI() {
  var body = $('rtCartBody'), totals = $('rtTotals'), place = $('rtPlace'), cod = $('rtCodNote'), pay = $('rtPayOnline');
  var rows = cartDetailed();
  var count = CART.reduce(function (s, c) { return s + c.qty; }, 0);
  $('rtCartBadge').textContent = count; $('rtCartBadge').style.display = count ? '' : 'none';
  if (!rows.length) {
    body.innerHTML = '<div class="pf-empty"><div class="pf-empty-ico"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></div><h3>Your cart is empty</h3><p>Add products to build an order.</p><button class="pf-btn pf-btn-primary" data-go="products">Browse products</button></div>';
    totals.style.display = 'none'; return;
  }
  var sub = 0, gstAcc = 0;
  body.innerHTML = rows.map(function (x) {
    var line = (x.p.retailerPrice || 0) * x.c.qty; sub += line; gstAcc += line * ((x.p.gst || 12) / 100);
    return '<div class="pf-cart-line"><div class="pf-cart-info"><p class="pf-cart-name">' + esc(x.p.name) + '</p><p class="pf-cart-rate">' + inr(x.p.retailerPrice) + ' × ' + x.c.qty + '</p></div>' +
      '<div class="pf-qty"><button data-minus="' + x.p._id + '">−</button><span>' + x.c.qty + '</span><button data-plus="' + x.p._id + '">+</button></div>' +
      '<button class="pf-cart-x" data-del="' + x.p._id + '">×</button></div>';
  }).join('');
  var gst = Math.round(gstAcc);
  $('ttSub').textContent = inr(sub); $('ttGst').textContent = inr(gst); $('ttGrand').textContent = inr(sub + gst);
  totals.style.display = 'block';
  var active = PROFILE && PROFILE.status === 'active';
  place.style.display = 'block'; place.disabled = !active; place.textContent = active ? 'Place order · Cash on delivery' : 'Awaiting account approval';
  cod.style.display = active ? 'block' : 'none';
  if (pay) { pay.style.display = active && ONLINE_PAY_ON ? 'block' : 'none'; pay.disabled = !active; }
}

function placeOrder() {
  var rows = cartDetailed(); if (!rows.length) { toast('Your cart is empty'); return; }
  var btn = $('rtPlace'), orig = btn.textContent; btn.disabled = true; btn.textContent = 'Placing…';
  api('/orders', { method: 'POST', body: JSON.stringify({ items: rows.map(function (x) { return { product: x.c.id, quantity: x.c.qty }; }), deliveryPriority: 'standard' }) })
    .then(function (d) {
      var ordered = {}; rows.forEach(function (x) { ordered[String(x.c.id)] = 1; });
      CART = CART.filter(function (c) { return !ordered[String(c.id)]; }); writeCart();
      var dist = d.order && d.order.distributor;
      toast('✓ Order ' + ((d.order && d.order.orderNumber) || 'placed') + (dist ? ' → ' + (dist.businessName || dist.name) : ''));
      updateCartUI(); loadOrders(); showSection('orders');
    })
    .catch(function (e) { toast('⚠ ' + e.message); })
    .finally(function () { btn.disabled = false; btn.textContent = orig; updateCartUI(); });
}
function payOnline() {
  var rows = cartDetailed(); if (!rows.length) { toast('Your cart is empty'); return; }
  if (!window.FFPayment) { toast('⚠ Payment module not loaded — refresh'); return; }
  var btn = $('rtPayOnline'), orig = btn.textContent; btn.disabled = true;
  var items = rows.map(function (x) { return { product: x.c.id, quantity: x.c.qty }; });
  var ordered = {}; rows.forEach(function (x) { ordered[String(x.c.id)] = 1; });
  window.FFPayment.payForCart(items, { deliveryPriority: 'standard', onStatus: function (m) { btn.textContent = m; }, onSuccess: function () { CART = CART.filter(function (c) { return !ordered[String(c.id)]; }); writeCart(); } })
    .catch(function (e) { toast((e && e.cancelled ? '⚠ ' : '✕ ') + (e.message || 'Payment failed')); loadOrders(); })
    .finally(function () { btn.disabled = false; btn.textContent = orig; updateCartUI(); });
}

/* ================= ORDERS ================= */
var STATUS_ORDER = ['pending', 'approved', 'dispatched', 'delivered'];
var STATUS_LABEL = { pending: 'Placed', approved: 'Accepted', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };

function loadOrders() {
  api('/orders?limit=50').then(function (d) { ORDERS = d.orders || []; ORDER_MAP = {}; ORDERS.forEach(function (o) { ORDER_MAP[o._id] = o; }); renderOrders(); renderMetrics(); renderRecent(); })
    .catch(function () { ORDERS = []; renderOrders(); renderMetrics(); renderRecent(); });
}

function renderMetrics() {
  var inProg = 0, delivered = 0, spent = 0;
  ORDERS.forEach(function (o) {
    if (['pending', 'approved', 'dispatched'].indexOf(o.status) >= 0) inProg++;
    if (o.status === 'delivered') delivered++;
    if (o.status !== 'cancelled' && o.status !== 'returned') spent += Number(o.totalAmount || 0);
  });
  var tiles = [['Total orders', ORDERS.length, 'box', ''], ['In progress', inProg, 'clock', 'warn'], ['Delivered', delivered, 'check', 'ok'], ['Total spent', inr(spent), 'rupee', '']];
  var icons = { box: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>', clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', check: '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/>', rupee: '<path d="M6 3h12M6 8h12M9 13h1a5 5 0 0 0 0-10M6 13h5l6 8"/>' };
  $('rtTiles').innerHTML = tiles.map(function (t) { return '<div class="pf-tile"><div class="pf-tile-top"><span class="pf-tile-ico' + (t[3] ? ' pf-tile-ico--' + t[3] : '') + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[t[2]] + '</svg></span></div><b>' + t[1] + '</b><span>' + t[0] + '</span></div>'; }).join('');
}

function orderCard(o, compact) {
  var items = (o.items || []).map(function (i) { return esc(i.productName) + ' ×' + i.quantity; }).join(', ');
  var dist = o.distributor ? (o.distributor.businessName || o.distributor.name) : '—';
  var when = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
  var paid = o.paymentStatus === 'paid';
  var canCancel = ['pending', 'approved'].indexOf(o.status) >= 0;
  var hasInvoice = ['dispatched', 'delivered', 'returned'].indexOf(o.status) >= 0;
  var actions = compact ? '' :
    '<div class="pf-order-actions"><button class="pf-btn pf-btn-ghost pf-btn-sm" data-again="' + o._id + '">Reorder</button><button class="pf-btn pf-btn-ghost pf-btn-sm" data-view="' + o._id + '">Track / details</button>' + (hasInvoice ? '<button class="pf-btn pf-btn-ghost pf-btn-sm" data-invoice="' + o._id + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>Invoice</button>' : '') + (canCancel ? '<button class="pf-btn pf-btn-danger pf-btn-sm" data-cancel="' + o._id + '">Cancel</button>' : '') + '</div>' +
    '<div id="ordDet-' + o._id + '" style="display:none"></div>';
  return '<div class="pf-order"><div class="pf-order-top"><span class="pf-order-id">' + esc(o.orderNumber || '') + '</span><span class="pf-badge pf-badge--' + esc(o.status) + '"><i></i>' + (STATUS_LABEL[o.status] || o.status) + '</span></div>' +
    '<p class="pf-order-items">' + (items || 'Items') + '</p>' +
    '<p class="pf-order-meta">' + inr(o.totalAmount) + ' · ' + (paid ? 'Paid' : 'COD / pending') + ' · ' + esc(dist) + ' · ' + when + '</p>' + actions + '</div>';
}
function renderOrders() {
  var box = $('rtOrders');
  if (!ORDERS.length) { box.innerHTML = '<div class="pf-empty"><div class="pf-empty-ico"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg></div><h3>No orders yet</h3><p>Browse products and place your first order.</p><button class="pf-btn pf-btn-primary" data-go="products">Browse products</button></div>'; return; }
  box.innerHTML = ORDERS.map(function (o) { return orderCard(o, false); }).join('');
}
function renderRecent() {
  var box = $('rtRecent');
  if (!ORDERS.length) { box.innerHTML = '<div class="pf-empty"><p>No orders yet.</p></div>'; return; }
  box.innerHTML = ORDERS.slice(0, 3).map(function (o) { return orderCard(o, true); }).join('');
}

function buyAgain(id) {
  var o = ORDER_MAP[id]; if (!o || !o.items) return;
  o.items.forEach(function (it) { var pid = String(it.product && (it.product._id || it.product)); var ex = CART.find(function (c) { return String(c.id) === pid; }); if (ex) ex.qty += it.quantity; else CART.push({ id: pid, qty: it.quantity }); });
  writeCart(); updateCartUI(); toast('Items added to cart'); showSection('cart');
}
function viewOrder(id) {
  var el = $('ordDet-' + id); if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  var o = ORDER_MAP[id], a = o.deliveryAddress || {};
  var addr = [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  // tracking timeline (unless cancelled)
  var track = '';
  if (o.status !== 'cancelled' && o.status !== 'returned') {
    var cur = STATUS_ORDER.indexOf(o.status);
    track = '<div class="pf-track">' + STATUS_ORDER.map(function (s, i) { return '<div class="pf-track-step' + (i <= cur ? ' on' : '') + '"><div class="pf-track-dot"></div>' + STATUS_LABEL[s] + '</div>'; }).join('') + '</div>';
  }
  var lines = (o.items || []).map(function (i) { return '<div class="pf-od-line"><span>' + esc(i.productName) + ' ×' + i.quantity + '</span><span>' + inr(i.totalPrice) + '</span></div>'; }).join('');
  el.innerHTML = track +
    '<div class="pf-od-sec"><strong>Items</strong>' + lines + '<div class="pf-od-line total"><span>Total</span><span>' + inr(o.totalAmount) + '</span></div></div>' +
    '<div class="pf-od-sec"><strong>Deliver to</strong><p style="font-size:.85rem">' + (esc(addr) || '—') + '</p></div>' +
    '<div class="pf-od-sec"><strong>Payment</strong><p style="font-size:.85rem">' + esc(o.paymentMethod || 'cash') + ' · ' + esc(o.paymentStatus || 'unpaid') + '</p></div>';
  el.style.display = 'block';
}
function cancelOrder(id) {
  if (!confirm('Cancel this order?')) return;
  api('/orders/' + id + '/cancel', { method: 'PUT', body: JSON.stringify({ reason: 'Cancelled by retailer' }) }).then(function () { toast('Order cancelled'); loadOrders(); }).catch(function (e) { toast('⚠ ' + e.message); });
}

/* ================= REWARDS + WALLET (Uphaar) ================= */
// Uphaar box slabs — mirrors js/uphaar.js RETAILER_SCHEMES (source of truth:
// the "Retailer Box Scheme 2026-27" PDF). Minimal copy for the progress widget;
// the full slab catalogue lives on uphaar.html.
var UPHAAR_SLABS = [
  { boxes: 3,   gift: '1 Kg Branded Rice',                 tier: 'Bronze' },
  { boxes: 6,   gift: '2 Pc Hand Towel Set',               tier: 'Bronze' },
  { boxes: 12,  gift: '1 Ltr Milton Steel Bottle',         tier: 'Bronze' },
  { boxes: 18,  gift: '3.5 Ltr Steel Casserole',           tier: 'Bronze' },
  { boxes: 24,  gift: '1.8 Ltr Electric Kettle',           tier: 'Bronze' },
  { boxes: 30,  gift: '3 Pc Cello Bathroom Set',           tier: 'Silver' },
  { boxes: 60,  gift: '65 Cm Luggage Bag',                 tier: 'Silver' },
  { boxes: 75,  gift: '48" Ceiling Fan',                   tier: 'Silver' },
  { boxes: 100, gift: 'Prestige 3 Pc Non-Stick Cookware',  tier: 'Gold' },
  { boxes: 150, gift: '4.2 Ltr Air Fryer',                 tier: 'Gold' },
  { boxes: 200, gift: 'Cello Copper Matka 10 Ltr',         tier: 'Gold' },
  { boxes: 250, gift: '36 Ltr Air Cooler',                 tier: 'Platinum' },
  { boxes: 325, gift: 'Branded Water Dispenser',           tier: 'Platinum' }
];
var REWARDS_LOADED = false;

function loadRewardsSection() {
  if (REWARDS_LOADED) return;          // lazy: load once on first visit
  REWARDS_LOADED = true;
  api('/retailer/rewards').then(function (d) { renderUphaar(d.rewards || {}); renderSchemes(d.schemes || []); })
    .catch(function (e) { $('rtUphaar').innerHTML = '<div class="pf-empty"><p>' + esc(e.message) + '</p></div>'; $('rtSchemes').innerHTML = ''; });
  api('/retailer/wallet').then(function (d) { renderWallet(d); })
    .catch(function (e) { $('rtWalletLedger').innerHTML = '<div class="pf-empty"><p>' + esc(e.message) + '</p></div>'; });
}

function renderUphaar(r) {
  var boxes = r.totalBoxes || 0, current = null, next = null;
  for (var i = 0; i < UPHAAR_SLABS.length; i++) {
    if (boxes >= UPHAAR_SLABS[i].boxes) current = UPHAAR_SLABS[i];
    else { next = UPHAAR_SLABS[i]; break; }
  }
  var base = current ? current.boxes : 0;
  var pct = next ? Math.max(0, Math.min(100, Math.round((boxes - base) / (next.boxes - base) * 100))) : 100;
  var tier = current ? current.tier : (r.tier || 'Silver');
  var toGo = next ? (next.boxes - boxes) : 0;
  $('rtUphaar').innerHTML =
    '<div class="pf-card pf-uphaar-card">' +
      '<div class="pf-uphaar-head">' +
        '<div><span class="pf-tierbadge pf-tier--' + esc(tier.toLowerCase()) + '">' + esc(tier) + ' tier</span>' +
          '<h2 class="pf-uphaar-boxes">' + boxes + ' <small>qualifying boxes</small></h2>' +
          '<p class="pf-sub">' + (r.orderCount || 0) + ' delivered order' + ((r.orderCount === 1) ? '' : 's') + ' · ' + inr(r.totalSpend || 0) + ' lifetime</p></div>' +
        '<div class="pf-uphaar-reward">' + (current
          ? '<span class="pf-sub">Reward unlocked</span><b>' + esc(current.gift) + '</b>'
          : '<span class="pf-sub">First reward at</span><b>' + UPHAAR_SLABS[0].boxes + ' boxes · ' + esc(UPHAAR_SLABS[0].gift) + '</b>') + '</div>' +
      '</div>' +
      '<div class="pf-progress"><span style="width:' + pct + '%"></span></div>' +
      '<p class="pf-uphaar-next">' + (next
        ? '<b>' + toGo + '</b> more box' + (toGo === 1 ? '' : 'es') + ' to reach <b>' + next.boxes + '</b> — ' + esc(next.gift)
        : 'You have reached the top slab. Thank you for your partnership!') + '</p>' +
    '</div>';
}

function renderWallet(d) {
  $('rtWalletBalance').textContent = inr(d.balance || 0);
  var txns = d.transactions || [], box = $('rtWalletLedger');
  if (!txns.length) { box.innerHTML = '<div class="pf-empty"><p>No wallet activity yet. Cashback from active Uphaar schemes is credited here once your orders are delivered.</p></div>'; return; }
  var rows = txns.map(function (t) {
    var when = t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
    var sign = t.type === 'credit' ? '+' : '−';
    return '<tr><td data-label="Date">' + when + '</td><td data-label="Detail">' + esc(t.description) + '</td>' +
      '<td data-label="Amount" class="pf-amt pf-amt--' + esc(t.type) + '">' + sign + inr(t.amount) + '</td>' +
      '<td data-label="Balance">' + inr(t.balance) + '</td></tr>';
  }).join('');
  box.innerHTML = '<div class="pf-table-wrap"><table class="pf-table pf-table--cards"><thead><tr><th>Date</th><th>Detail</th><th>Amount</th><th>Balance</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderSchemes(schemes) {
  var box = $('rtSchemes');
  if (!schemes.length) { box.innerHTML = '<div class="pf-empty"><p>No active schemes right now. Uphaar cashback offers run through the year — check back soon.</p></div>'; return; }
  box.innerHTML = '<div class="pf-scheme-grid">' + schemes.map(function (s) {
    var val = s.type === 'cashback' ? (s.cashbackPercentage + '% cashback')
            : s.type === 'discount' ? (s.discountPercentage + '% off')
            : s.type === 'flat_off' ? (inr(s.flatOff) + ' off') : 'Bonus';
    var until = s.validTo ? new Date(s.validTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    var meta = [];
    if (s.minOrderValue) meta.push('Min order ' + inr(s.minOrderValue));
    if (s.maxCashback) meta.push('up to ' + inr(s.maxCashback));
    if (until) meta.push('till ' + until);
    return '<div class="pf-scheme"><div class="pf-scheme-badge">' + esc(val) + '</div>' +
      '<b>' + esc(s.name) + '</b><p class="pf-sub">' + esc(s.description || '') + '</p>' +
      '<div class="pf-scheme-meta">' + esc(meta.join(' · ')) + '</div></div>';
  }).join('') + '</div>';
}

/* ================= INVOICE ================= */
var INVOICE_CSS =
  '.inv{max-width:760px;margin:0 auto;color:#0f2233;font-family:Arial,Helvetica,sans-serif}' +
  '.inv .r{text-align:right}' +
  '.inv-top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0F4C81;padding-bottom:14px}' +
  '.inv-co{font-size:18px;font-weight:700;color:#0F4C81}' +
  '.inv-cad{font-size:11px;color:#54687a;max-width:330px;line-height:1.5;margin-top:3px}' +
  '.inv-meta{text-align:right}.inv-meta h1{font-size:22px;margin:0 0 4px;color:#0F4C81;letter-spacing:1px}' +
  '.inv-meta div{font-size:12px;color:#33465a}.inv-stat{margin-top:4px;text-transform:capitalize;font-weight:700;color:#0F4C81}' +
  '.inv-parties{display:flex;justify-content:space-between;gap:20px;margin:16px 0}' +
  '.inv-parties b{display:block;margin-bottom:4px;color:#0F4C81;font-size:11px;text-transform:uppercase;letter-spacing:.4px}' +
  '.inv-parties div{font-size:12px;line-height:1.55;color:#22333f}' +
  '.inv-items{width:100%;border-collapse:collapse;margin:8px 0}' +
  '.inv-items th{background:#0F4C81;color:#fff;padding:7px 8px;font-size:11px;text-align:left}.inv-items th.r{text-align:right}' +
  '.inv-items td{padding:7px 8px;border-bottom:1px solid #e6eef7;font-size:12px;vertical-align:top}' +
  '.inv-items small{color:#7a8a99}' +
  '.inv-totals{margin-left:auto;width:270px;margin-top:12px}' +
  '.inv-totals>div{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#33465a}' +
  '.inv-totals .g{border-top:2px solid #0F4C81;margin-top:4px;padding-top:8px;font-weight:700;font-size:16px;color:#0F4C81}' +
  '.inv-foot{margin-top:22px;font-size:11px;color:#66788a;border-top:1px solid #e6eef7;padding-top:10px}';

function openInvoice(id) {
  api('/retailer/invoices/' + id).then(function (d) { showInvoiceModal(d.invoice); })
    .catch(function (e) { toast('⚠ ' + e.message); });
}
function invoiceHTML(inv) {
  function dd(x) { return x ? new Date(x).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  var b = inv.buyer || {}, s = inv.seller || {}, t = inv.totals || {};
  var items = (inv.items || []).map(function (i, n) {
    return '<tr><td>' + (n + 1) + '</td><td>' + esc(i.name) + (i.brand ? '<br><small>' + esc(i.brand) + '</small>' : '') + '</td>' +
      '<td class="r">' + i.quantity + '</td><td class="r">' + inr(i.unitPrice) + '</td><td class="r">' + i.gstRate + '%</td>' +
      '<td class="r">' + inr(i.taxableValue) + '</td><td class="r">' + inr(i.gstAmount) + '</td><td class="r">' + inr(i.lineTotal) + '</td></tr>';
  }).join('');
  return '<div class="inv">' +
    '<div class="inv-top"><div><div class="inv-co">' + esc(s.name) + '</div><div class="inv-cad">' + esc(s.address) + '</div>' +
      '<div class="inv-cad">' + esc(s.email) + ' · ' + esc(s.phone) + '</div></div>' +
      '<div class="inv-meta"><h1>INVOICE</h1><div>' + esc(inv.invoiceNumber) + '</div><div>Order ' + esc(inv.orderNumber) + '</div>' +
        '<div>Date: ' + dd(inv.orderDate) + '</div><div class="inv-stat">' + esc(inv.status) + '</div></div></div>' +
    '<div class="inv-parties"><div><b>Billed to</b><div>' + esc(b.name) + '</div>' + (b.contactName ? '<div>' + esc(b.contactName) + '</div>' : '') +
      '<div>' + (esc(b.address) || '—') + '</div>' + (b.gstNumber ? '<div>GSTIN: ' + esc(b.gstNumber) + '</div>' : '') +
      (b.drugLicenseNumber ? '<div>Drug Licence: ' + esc(b.drugLicenseNumber) + '</div>' : '') + (b.phone ? '<div>' + esc(b.phone) + '</div>' : '') + '</div>' +
      '<div class="r"><b>Payment</b><div>' + esc(inv.paymentMethod || 'cash') + ' · ' + esc(inv.paymentStatus || 'unpaid') + '</div>' +
        (inv.dispatchedAt ? '<div>Dispatched: ' + dd(inv.dispatchedAt) + '</div>' : '') + (inv.deliveredAt ? '<div>Delivered: ' + dd(inv.deliveredAt) + '</div>' : '') + '</div></div>' +
    '<table class="inv-items"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Taxable</th><th class="r">GST amt</th><th class="r">Total</th></tr></thead><tbody>' + items + '</tbody></table>' +
    '<div class="inv-totals"><div><span>Taxable value</span><span>' + inr(t.subtotal) + '</span></div>' +
      '<div><span>GST</span><span>' + inr(t.gstAmount) + '</span></div>' +
      (t.discount ? '<div><span>Discount</span><span>−' + inr(t.discount) + '</span></div>' : '') +
      '<div class="g"><span>Grand total</span><span>' + inr(t.grandTotal) + '</span></div></div>' +
    '<p class="inv-foot">Computer-generated invoice for your order — no signature required. Queries: ' + esc(s.email) + '.</p></div>';
}
function showInvoiceModal(inv) {
  closeInvoice();
  var overlay = document.createElement('div');
  overlay.className = 'pf-modal'; overlay.id = 'rtInvoiceModal';
  overlay.innerHTML =
    '<div class="pf-modal-card"><div class="pf-modal-head"><b>Invoice ' + esc(inv.invoiceNumber) + '</b>' +
      '<div class="pf-modal-actions"><button class="pf-btn pf-btn-primary pf-btn-sm" id="invPrint">Print / Save PDF</button>' +
      '<button class="pf-btn pf-btn-ghost pf-btn-sm" id="invClose">Close</button></div></div>' +
      '<div class="pf-modal-body" id="rtInvoiceDoc"><style>' + INVOICE_CSS + '</style>' + invoiceHTML(inv) + '</div></div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeInvoice(); });
  $('invClose').addEventListener('click', closeInvoice);
  $('invPrint').addEventListener('click', function () { printInvoice(inv); });
}
function closeInvoice() { var m = $('rtInvoiceModal'); if (m) m.remove(); document.body.style.overflow = ''; }
function printInvoice(inv) {
  var doc = $('rtInvoiceDoc'), html = doc ? doc.innerHTML : ('<style>' + INVOICE_CSS + '</style>' + invoiceHTML(inv));
  var w = window.open('', '_blank', 'width=840,height=1000');
  if (!w) { toast('Allow pop-ups to print the invoice'); return; }
  w.document.open();
  w.document.write('<!doctype html><html><head><title>' + esc(inv.invoiceNumber) + '</title><meta charset="utf-8"><style>body{margin:24px}</style></head><body>' + html + '</body></html>');
  w.document.close(); w.focus();
  setTimeout(function () { try { w.print(); } catch (e) {} }, 350);
}

/* ================= EVENTS ================= */
document.addEventListener('click', function (e) {
  var t = e.target;
  var inv = t.closest('[data-invoice]'); if (inv) { openInvoice(inv.getAttribute('data-invoice')); return; }
  var add = t.closest('[data-add]'); if (add) { addToCart(add.getAttribute('data-add')); return; }
  var wish = t.closest('[data-wish]'); if (wish) { toggleWish(wish.getAttribute('data-wish')); return; }
  var plus = t.closest('[data-plus]'); if (plus) { var pid = plus.getAttribute('data-plus'); var it = CART.find(function (c) { return String(c.id) === pid; }); setQty(pid, (it ? it.qty : 0) + 1); return; }
  var minus = t.closest('[data-minus]'); if (minus) { var mid = minus.getAttribute('data-minus'); var m = CART.find(function (c) { return String(c.id) === mid; }); setQty(mid, (m ? m.qty : 1) - 1); return; }
  var del = t.closest('[data-del]'); if (del) { setQty(del.getAttribute('data-del'), 0); return; }
  var again = t.closest('[data-again]'); if (again) { buyAgain(again.getAttribute('data-again')); return; }
  var view = t.closest('[data-view]'); if (view) { viewOrder(view.getAttribute('data-view')); return; }
  var cancel = t.closest('[data-cancel]'); if (cancel) { cancelOrder(cancel.getAttribute('data-cancel')); return; }
});
$('rtSearch').addEventListener('input', function (e) { clearTimeout(searchTimer); var v = e.target.value.trim(); searchTimer = setTimeout(function () { loadProducts(v); }, 300); });
$('afSave').addEventListener('click', saveAddress);
$('rtPlace').addEventListener('click', placeOrder);
if ($('rtPayOnline')) $('rtPayOnline').addEventListener('click', payOnline);
$('rtLogout').addEventListener('click', logout);
$('rtReorderLast').addEventListener('click', function () { if (ORDERS[0]) buyAgain(ORDERS[0]._id); else { toast('No previous order to reorder'); showSection('products'); } });

/* ================= INIT ================= */
(function initPay() { (window.FFPayment ? window.FFPayment.isEnabled() : Promise.resolve(false)).then(function (on) { ONLINE_PAY_ON = on; updateCartUI(); }).catch(function () { ONLINE_PAY_ON = false; updateCartUI(); }); })();
updateWishBadge();
loadProfile();
loadProducts();
loadOrders();
