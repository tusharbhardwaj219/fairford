/**
 * Fair Ford · Retailer ordering page (minimal)
 * Browse products → cart (shared localStorage 'ff_cart') → cash-on-delivery
 * checkout via POST /api/orders. The backend routes each order to the nearest
 * serviceable distributor/stockist by the retailer's shop pincode/city.
 */
"use strict";

// ── Auth guard (retailer only) ──
(function () {
  var token = localStorage.getItem('ff_token');
  if (!token) { window.location.replace('/login&signup.html'); return; }
  try {
    var user = JSON.parse(localStorage.getItem('ff_user'));
    if (user && user.role === 'dist') { window.location.replace('/distributor.html'); return; }
    if (user && (user.role === 'admin' || user.role === 'superadmin')) { window.location.replace('/superadmin.html'); return; }
  } catch (e) {}
})();

const $ = (id) => document.getElementById(id);
let PRODUCTS = [];
let PROFILE = null;
let CART = readCart();          // [{ id, qty }]
let ORDERS = {};                // id → order (for Buy Again / View Details)
let searchTimer;
let ONLINE_PAY_ON = false;      // set on load from GET /api/payments/config

function readCart() { try { return JSON.parse(localStorage.getItem('ff_cart') || '[]'); } catch (e) { return []; } }
function writeCart() { localStorage.setItem('ff_cart', JSON.stringify(CART)); }

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function toast(msg) {
  const t = $('rtToast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function logout() {
  if (window.showLogoutConfirm) {
    window.showLogoutConfirm(function () {
      window.lcDoLogout('/login&signup.html');
    });
  } else {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    sessionStorage.removeItem('ff_user');
    window.location.replace('/login&signup.html');
  }
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ff_token');
  const res = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
  return data;
}

/* ── Profile + address ── */
async function loadProfile() {
  try {
    const { user } = await apiFetch('/retailer/profile');
    PROFILE = user;
    $('rtUserName').textContent = user.shopName || user.name || 'Retailer';
    const a = user.shopAddress || {};
    $('afShop').value = user.shopName || '';
    $('afStreet').value = a.street || '';
    $('afCity').value = a.city || '';
    $('afState').value = a.state || '';
    $('afPincode').value = a.pincode || '';
    $('rtBanner').classList.toggle('show', user.status !== 'active');
    updateCartUI();
  } catch (e) { toast('⚠ ' + e.message); }
}

async function saveAddress() {
  const btn = $('afSave'); btn.disabled = true;
  try {
    const body = {
      shopName: $('afShop').value.trim(),
      shopAddress: {
        street: $('afStreet').value.trim(),
        city: $('afCity').value.trim(),
        state: $('afState').value.trim(),
        pincode: $('afPincode').value.trim(),
      },
    };
    const { user } = await apiFetch('/retailer/profile', { method: 'PUT', body: JSON.stringify(body) });
    PROFILE = user;
    $('rtUserName').textContent = user.shopName || user.name || 'Retailer';
    toast('✓ Address saved');
  } catch (e) { toast('⚠ ' + e.message); }
  finally { btn.disabled = false; }
}

/* ── Products ── */
async function loadProducts(search) {
  try {
    const q = new URLSearchParams({ limit: '500' });
    if (search) q.set('search', search);
    const data = await apiFetch('/retailer/products?' + q.toString());
    PRODUCTS = (data.data && data.data.products) || [];
    renderProducts();
    // The cart panel resolves its rows against PRODUCTS, so it can only render
    // once the catalogue has arrived. Without this repaint a retailer who lands
    // here with items already in the cart (added from the storefront) sees an
    // empty cart until they touch something.
    updateCartUI();
  } catch (e) {
    $('rtProducts').innerHTML = '<p class="rt-empty">' + esc(e.message) + '</p>';
  }
}

const productById = (id) => PRODUCTS.find((p) => String(p._id) === String(id));

function renderProducts() {
  const box = $('rtProducts');
  if (!PRODUCTS.length) { box.innerHTML = '<p class="rt-empty">No products found.</p>'; return; }
  box.innerHTML = PRODUCTS.map((p) => {
    const out = (p.stock || 0) <= 0;
    const imgUrl = (p.image && p.image.url) || (p.images && p.images[0] && p.images[0].url);
    const img = imgUrl
      ? '<img src="' + esc(imgUrl) + '" alt="">'
      : esc((p.name || '?').charAt(0).toUpperCase());
    return '<div class="rt-prod">' +
      '<div class="rt-prod-thumb">' + img + '</div>' +
      '<p class="rt-prod-name">' + esc(p.name || 'Product') + '</p>' +
      '<p class="rt-prod-brand">' + esc(p.brand || '') + '</p>' +
      '<div class="rt-prod-foot">' +
        '<div><div class="rt-price">' + inr(p.retailerPrice) + '</div>' +
        '<div class="rt-stock' + (out ? ' out' : '') + '">' + (out ? 'Out of stock' : 'In stock') + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" data-add="' + p._id + '"' + (out ? ' disabled' : '') + '>Add</button>' +
      '</div></div>';
  }).join('');
}

/* ── Cart ── */
function addToCart(id) {
  const it = CART.find((c) => String(c.id) === String(id));
  if (it) it.qty += 1; else CART.push({ id: String(id), qty: 1 });
  writeCart(); updateCartUI(); toast('Added to cart');
}
function setQty(id, qty) {
  if (qty < 1) CART = CART.filter((c) => String(c.id) !== String(id));
  else { const it = CART.find((c) => String(c.id) === String(id)); if (it) it.qty = qty; }
  writeCart(); updateCartUI();
}
// Only cart items that map to a fetched product can be displayed/ordered
const cartDetailed = () => CART.map((c) => ({ c, p: productById(c.id) })).filter((x) => x.p);

function updateCartUI() {
  const body = $('rtCartBody'), totals = $('rtTotals'), placeBtn = $('rtPlace'), codNote = $('rtCodNote');
  const payBtn = $('rtPayOnline');
  const rows = cartDetailed();

  if (!rows.length) {
    body.innerHTML = '<p class="rt-empty">Your cart is empty.</p>';
    totals.style.display = 'none'; placeBtn.style.display = 'none'; codNote.style.display = 'none';
    if (payBtn) payBtn.style.display = 'none';
    return;
  }

  let subtotal = 0, gstAcc = 0;
  body.innerHTML = rows.map(({ c, p }) => {
    const lineTotal = (p.retailerPrice || 0) * c.qty;
    subtotal += lineTotal;
    // Per-item GST (5/12/18) to match how the backend computes the order total,
    // instead of a flat 12% that could disagree with the charged amount.
    gstAcc += lineTotal * ((p.gst || 12) / 100);
    return '<div class="rt-cart-line">' +
      '<div class="rt-cart-info">' +
        '<p class="rt-cart-name">' + esc(p.name) + '</p>' +
        '<p class="rt-cart-rate">' + inr(p.retailerPrice) + ' × ' + c.qty + '</p>' +
      '</div>' +
      '<div class="rt-qty">' +
        '<button data-minus="' + p._id + '">−</button>' +
        '<span>' + c.qty + '</span>' +
        '<button data-plus="' + p._id + '">+</button>' +
      '</div>' +
      '<button class="rt-cart-x" data-del="' + p._id + '">×</button>' +
    '</div>';
  }).join('');

  const gst = Math.round(gstAcc);
  $('ttSub').textContent = inr(subtotal);
  $('ttGst').textContent = inr(gst);
  $('ttGrand').textContent = inr(subtotal + gst);
  totals.style.display = 'block';

  const active = PROFILE && PROFILE.status === 'active';
  placeBtn.style.display = 'block';
  placeBtn.disabled = !active;
  placeBtn.textContent = active ? 'Place order · Cash on delivery' : 'Awaiting account approval';
  codNote.style.display = active ? 'block' : 'none';

  // Online payment is only offered when the account is approved AND the server
  // has Razorpay configured (ONLINE_PAY_ON is resolved once on page load).
  if (payBtn) {
    payBtn.style.display = active && ONLINE_PAY_ON ? 'block' : 'none';
    payBtn.disabled = !active;
  }
}

async function placeOrder() {
  const rows = cartDetailed();
  if (!rows.length) { toast('Your cart is empty'); return; }
  const btn = $('rtPlace'); const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Placing…';
  try {
    const items = rows.map(({ c }) => ({ product: c.id, quantity: c.qty }));
    const data = await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({ items, deliveryPriority: 'standard' }),
    });
    const ordered = new Set(rows.map((x) => String(x.c.id)));
    CART = CART.filter((c) => !ordered.has(String(c.id)));
    writeCart();
    const dist = data.order && data.order.distributor;
    toast('✓ Order ' + ((data.order && data.order.orderNumber) || 'placed') +
      (dist ? ' → ' + (dist.businessName || dist.name) : ''));
    updateCartUI();
    await loadOrders();
    const ordersSection = $('rtOrders');
    if (ordersSection) ordersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    toast('⚠ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
    updateCartUI();
  }
}

/* ── Online payment (Razorpay) ──
   The cart is sent as product ids + quantities only; the server prices the
   order and tells Razorpay what to charge, so the amount can't be tampered
   with here. On success the cart is cleared and we land on payment-success. */
async function payOnline() {
  const rows = cartDetailed();
  if (!rows.length) { toast('Your cart is empty'); return; }
  if (!window.FFPayment) { toast('⚠ Payment module not loaded — please refresh'); return; }

  const btn = $('rtPayOnline'); const orig = btn.textContent;
  btn.disabled = true;

  const items = rows.map(({ c }) => ({ product: c.id, quantity: c.qty }));
  const ordered = new Set(rows.map((x) => String(x.c.id)));

  try {
    await window.FFPayment.payForCart(items, {
      deliveryPriority: 'standard',
      onStatus: (msg) => { btn.textContent = msg; },
      onSuccess: () => {
        // Clear only what was actually paid for, then let payment.js redirect.
        CART = CART.filter((c) => !ordered.has(String(c.id)));
        writeCart();
      },
    });
  } catch (e) {
    // Cancelled / failed — payment.js has already told the server. The order
    // stays in My Orders as unpaid so it can be retried.
    toast((e && e.cancelled ? '⚠ ' : '✕ ') + (e.message || 'Payment failed'));
    await loadOrders();
  } finally {
    btn.disabled = false; btn.textContent = orig;
    updateCartUI();
  }
}

/* ── Orders ── */
async function loadOrders() {
  try {
    const data = await apiFetch('/orders?limit=50');
    renderOrders(data.orders || []);
  } catch (e) {
    // Pending (un-activated) accounts can't list orders yet — show neutral state
    $('rtOrders').innerHTML = '<p class="rt-empty">No orders yet.</p>';
  }
}

function renderOrders(orders) {
  const box = $('rtOrders');
  ORDERS = {};
  if (!orders.length) { box.innerHTML = '<p class="rt-empty">No orders yet.</p>'; return; }
  box.innerHTML = orders.map((o) => {
    ORDERS[o._id] = o;
    const items = (o.items || []).map((i) => esc(i.productName) + ' ×' + i.quantity).join(', ');
    const dist = o.distributor ? (o.distributor.businessName || o.distributor.name) : '—';
    const when = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
    const canCancel = ['pending', 'approved'].includes(o.status);
    const paid = o.paymentStatus === 'paid';
    return '<div class="rt-order">' +
      '<div class="rt-order-top">' +
        '<span class="rt-order-id">' + esc(o.orderNumber || '') + '</span>' +
        '<span class="badge ' + esc(o.status) + '">' + esc(o.status) + '</span>' +
      '</div>' +
      '<p class="rt-order-items">' + (items || 'Items') + '</p>' +
      '<p class="rt-order-meta">' + inr(o.totalAmount) + ' · COD · ' +
        (paid ? 'Paid' : 'Payment pending') + ' · routed to ' + esc(dist) + ' · ' + when + '</p>' +
      '<div class="rt-order-actions">' +
        '<button class="btn btn-ghost btn-sm" data-again="' + o._id + '">Buy Again</button>' +
        '<button class="btn btn-ghost btn-sm" data-view="' + o._id + '">View Details</button>' +
        (canCancel ? '<button class="btn btn-danger btn-sm" data-cancel="' + o._id + '">Cancel</button>' : '') +
      '</div>' +
      '<div class="rt-order-detail" id="ordDet-' + o._id + '" style="display:none"></div>' +
    '</div>';
  }).join('');
}

/* Add every item from a past order back into the cart ("Add More" / reorder). */
function buyAgain(id) {
  const o = ORDERS[id];
  if (!o || !o.items || !o.items.length) return;
  o.items.forEach((it) => {
    const pid = String(it.product);
    const ex = CART.find((c) => String(c.id) === pid);
    if (ex) ex.qty += it.quantity; else CART.push({ id: pid, qty: it.quantity });
  });
  writeCart(); updateCartUI();
  toast('Items added to cart — review & place order');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Expand/collapse an inline breakdown for a past order. */
function viewOrder(id) {
  const el = $('ordDet-' + id);
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  const o = ORDERS[id];
  const addr = o.deliveryAddress || {};
  const addrLine = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  const lines = (o.items || []).map((i) =>
    '<div class="rt-od-line"><span>' + esc(i.productName) + ' ×' + i.quantity + '</span><span>' + inr(i.totalPrice) + '</span></div>'
  ).join('');
  const tl = (o.timeline || []).slice().reverse().map((t) =>
    '<div class="rt-od-tl">' + esc(t.status) + (t.note ? ' — ' + esc(t.note) : '') + '</div>'
  ).join('');
  el.innerHTML =
    '<div class="rt-od-sec"><strong>Items</strong>' + lines +
      '<div class="rt-od-line rt-od-total"><span>Total (COD)</span><span>' + inr(o.totalAmount) + '</span></div></div>' +
    '<div class="rt-od-sec"><strong>Deliver to</strong><p>' + (esc(addrLine) || '—') + '</p></div>' +
    '<div class="rt-od-sec"><strong>Payment</strong><p>' + esc((o.paymentMethod || 'cash')) + ' · ' + esc((o.paymentStatus || 'unpaid')) + '</p></div>' +
    (tl ? '<div class="rt-od-sec"><strong>Status history</strong>' + tl + '</div>' : '');
  el.style.display = 'block';
}

async function cancelOrder(id) {
  if (!confirm('Cancel this order?')) return;
  try {
    await apiFetch('/orders/' + id + '/cancel', { method: 'PUT', body: JSON.stringify({ reason: 'Cancelled by retailer' }) });
    toast('Order cancelled'); loadOrders();
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── Events ── */
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.add) addToCart(t.dataset.add);
  else if (t.dataset.plus) { const it = CART.find((c) => String(c.id) === t.dataset.plus); setQty(t.dataset.plus, (it ? it.qty : 0) + 1); }
  else if (t.dataset.minus) { const it = CART.find((c) => String(c.id) === t.dataset.minus); setQty(t.dataset.minus, (it ? it.qty : 1) - 1); }
  else if (t.dataset.del) setQty(t.dataset.del, 0);
  else if (t.dataset.cancel) cancelOrder(t.dataset.cancel);
  else if (t.dataset.again) buyAgain(t.dataset.again);
  else if (t.dataset.view) viewOrder(t.dataset.view);
});
$('rtSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value.trim();
  searchTimer = setTimeout(() => loadProducts(v), 300);
});
$('afSave').addEventListener('click', saveAddress);
$('rtPlace').addEventListener('click', placeOrder);
if ($('rtPayOnline')) $('rtPayOnline').addEventListener('click', payOnline);
$('rtLogout').addEventListener('click', logout);

/* ── Init ── */
// Ask the server whether online payment is switched on, then repaint the cart
// so the "Pay online" button appears (or stays hidden on a COD-only deploy).
(async function initOnlinePayment() {
  try {
    ONLINE_PAY_ON = window.FFPayment ? await window.FFPayment.isEnabled() : false;
  } catch (e) {
    ONLINE_PAY_ON = false;
  }
  updateCartUI();
})();

loadProfile();
loadProducts();
loadOrders();
