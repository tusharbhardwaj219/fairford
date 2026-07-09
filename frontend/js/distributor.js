/**
<<<<<<< HEAD
 * Fair Ford · Distributor page
 * Login/signup forms when unauthenticated; fulfillment dashboard when logged in.
 */
"use strict";

=======
 * Fair Ford · Distributor fulfillment page (minimal)
 * Shows the distributor's own coverage info (read-only — admin managed) and
 * the queue of orders routed to them by the nearest-distributor matcher, with
 * approve / dispatch / deliver / cancel actions against the existing
 * distributor-scoped order endpoints (GET/PUT /api/orders...).
 */
"use strict";

// ── Auth guard ──
(function () {
  if (!localStorage.getItem('ff_token')) window.location.replace('/login&signup.html');
})();

>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
const $ = (id) => document.getElementById(id);
let ORDERS = [];
let STATUS_FILTER = '';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function toast(msg) {
  const t = $('dtToast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function logout() {
  if (window.showLogoutConfirm) {
    window.showLogoutConfirm(function () {
<<<<<<< HEAD
      window.lcDoLogout();
      showAuth();
=======
      window.lcDoLogout('/login&signup.html');
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
    });
  } else {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    sessionStorage.removeItem('ff_user');
<<<<<<< HEAD
    showAuth();
  }
}

/* ══════════════════════════════════════════
   AUTH UI
══════════════════════════════════════════ */

function showAuth() {
  $('dtAuthSection').style.display = '';
  $('dtDashboard').style.display = 'none';
}

function showDashboard() {
  $('dtAuthSection').style.display = 'none';
  $('dtDashboard').style.display = '';
  loadProfile();
  loadOrders();
}

window.switchTab = function (tab) {
  const isLogin = tab === 'login';
  $('tabLogin').classList.toggle('active', isLogin);
  $('tabSignup').classList.toggle('active', !isLogin);
  $('loginForm').classList.toggle('active', isLogin);
  $('signupForm').classList.toggle('active', !isLogin);
  $('dtSwitch').innerHTML = isLogin
    ? 'Don\'t have an account? <a onclick="switchTab(\'signup\')">Sign up</a>'
    : 'Already have an account? <a onclick="switchTab(\'login\')">Login</a>';
  $('dtAuthErr').classList.remove('show');
};

function showErr(msg) {
  const el = $('dtAuthErr');
  const span = $('dtAuthErrText');
  if (span) span.textContent = msg;
  else el.textContent = msg;
  el.classList.add('show');
}

window.handleLogin = async function (e) {
  e.preventDefault();
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = 'Logging in…';
  $('dtAuthErr').classList.remove('show');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('loginEmail').value.trim(),
        password: $('loginPass').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.user && data.user.role !== 'dist') {
      throw new Error('This portal is for distributors only. Please use the appropriate login page.');
    }
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user', JSON.stringify(data.user));
    showDashboard();
  } catch (err) {
    showErr(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
  return false;
};

window.handleSignup = async function (e) {
  e.preventDefault();
  const btn = $('signupBtn');
  const pass = $('regPass').value;
  const confirm = $('regConfirm').value;
  if (pass !== confirm) { showErr('Passwords do not match'); return false; }

  btn.disabled = true; btn.textContent = 'Creating account…';
  $('dtAuthErr').classList.remove('show');
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('regName').value.trim(),
        email: $('regEmail').value.trim(),
        password: pass,
        confirmPassword: confirm,
        role: 'dist',
        businessName: $('regBusiness').value.trim(),
        phone: $('regPhone').value.trim(),
        gstNumber: $('regGst').value.trim(),
        address: $('regAddress').value.trim(),
        city: $('regCity').value.trim(),
        state: $('regState').value.trim(),
        pincode: $('regPincode').value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Signup failed');
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user', JSON.stringify(data.user));
    toast('Account created — awaiting admin approval');
    showDashboard();
  } catch (err) {
    showErr(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Create Distributor Account';
  }
  return false;
};

/* ══════════════════════════════════════════
   API HELPER
══════════════════════════════════════════ */

=======
    window.location.replace('/login&signup.html');
  }
}

>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
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

<<<<<<< HEAD
/* ══════════════════════════════════════════
   DASHBOARD — Profile + coverage (read-only)
══════════════════════════════════════════ */

=======
/* ── Profile + coverage (read-only) ── */
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
async function loadProfile() {
  try {
    const { user } = await apiFetch('/auth/profile');
    $('dtUserName').textContent = user.businessName || user.name || 'Distributor';
    $('dfBusiness').value = user.businessName || user.name || '';
    const a = user.businessAddress || {};
    $('dfAddress').value = [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ');
    $('dfTerritory').value = (user.territory || []).join(', ') || '—';
    $('dfPincodes').value = (user.serviceablePincodes || []).join(', ') || '—';
    $('dfContact').value = [user.email, user.phone].filter(Boolean).join(' · ');
    $('dtBanner').classList.toggle('show', user.status !== 'active');
  } catch (e) { toast('⚠ ' + e.message); }
}

<<<<<<< HEAD
/* ══════════════════════════════════════════
   DASHBOARD — Orders
══════════════════════════════════════════ */

=======
/* ── Orders ── */
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
async function loadOrders() {
  try {
    const q = new URLSearchParams({ limit: '100' });
    if (STATUS_FILTER) q.set('status', STATUS_FILTER);
    const data = await apiFetch('/orders?' + q.toString());
    ORDERS = data.orders || [];
    renderOrders();
  } catch (e) {
<<<<<<< HEAD
=======
    // Pending (un-activated) accounts can't list orders yet — show neutral state
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
    $('dtOrders').innerHTML = '<p class="rt-empty">No orders yet.</p>';
  }
}

function renderOrders() {
  const box = $('dtOrders');
  if (!ORDERS.length) { box.innerHTML = '<p class="rt-empty">No orders yet.</p>'; return; }
  box.innerHTML = ORDERS.map((o) => {
    const items = (o.items || []).map((i) => esc(i.productName) + ' ×' + i.quantity).join(', ');
    const shop  = o.retailer ? (o.retailer.shopName || o.retailer.name) : '—';
    const phone = o.retailer && o.retailer.phone ? ' · ' + esc(o.retailer.phone) : '';
    const addr  = o.deliveryAddress || {};
    const addrLine = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    const when = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';

    let actions = '';
    if (o.status === 'pending') {
      actions = '<button class="btn btn-primary btn-sm" data-approve="' + o._id + '">Approve</button>' +
        ' <button class="btn btn-danger btn-sm" data-cancel="' + o._id + '">Decline</button>';
    } else if (o.status === 'approved') {
      actions = '<button class="btn btn-primary btn-sm" data-dispatch="' + o._id + '">Mark dispatched</button>' +
        ' <button class="btn btn-danger btn-sm" data-cancel="' + o._id + '">Cancel</button>';
    } else if (o.status === 'dispatched') {
      actions = '<button class="btn btn-primary btn-sm" data-deliver="' + o._id + '">Mark delivered</button>';
    }

    return '<div class="rt-order">' +
      '<div class="rt-order-top">' +
        '<span class="rt-order-id">' + esc(o.orderNumber || '') + '</span>' +
        '<span class="badge ' + esc(o.status) + '">' + esc(o.status) + '</span>' +
      '</div>' +
      '<p class="rt-order-items">' + (items || 'Items') + '</p>' +
      '<p class="rt-order-meta">' + esc(shop) + phone + (addrLine ? ' · ' + esc(addrLine) : '') + '</p>' +
      '<p class="rt-order-meta">' + inr(o.totalAmount) + ' · COD · ' + when + '</p>' +
      (actions ? '<div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">' + actions + '</div>' : '') +
    '</div>';
  }).join('');
}

async function approveOrder(id) {
  try { await apiFetch('/orders/' + id + '/approve', { method: 'PUT' }); toast('✓ Order approved'); loadOrders(); }
  catch (e) { toast('⚠ ' + e.message); }
}
async function dispatchOrder(id) {
  try { await apiFetch('/orders/' + id + '/dispatch', { method: 'PUT' }); toast('✓ Marked dispatched'); loadOrders(); }
  catch (e) { toast('⚠ ' + e.message); }
}
async function deliverOrder(id) {
  try { await apiFetch('/orders/' + id + '/deliver', { method: 'PUT' }); toast('✓ Marked delivered'); loadOrders(); }
  catch (e) { toast('⚠ ' + e.message); }
}
async function cancelOrder(id) {
  if (!confirm('Cancel/decline this order?')) return;
  try {
    await apiFetch('/orders/' + id + '/cancel', { method: 'PUT', body: JSON.stringify({ reason: 'Declined by distributor' }) });
    toast('Order cancelled'); loadOrders();
  } catch (e) { toast('⚠ ' + e.message); }
}

<<<<<<< HEAD
/* ══════════════════════════════════════════
   EVENTS
══════════════════════════════════════════ */

=======
/* ── Events ── */
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.approve) approveOrder(t.dataset.approve);
  else if (t.dataset.dispatch) dispatchOrder(t.dataset.dispatch);
  else if (t.dataset.deliver) deliverOrder(t.dataset.deliver);
  else if (t.dataset.cancel) cancelOrder(t.dataset.cancel);
});
$('dtStatusFilter').addEventListener('change', (e) => { STATUS_FILTER = e.target.value; loadOrders(); });
$('dtLogout').addEventListener('click', logout);

<<<<<<< HEAD
/* ══════════════════════════════════════════
   INIT — decide auth vs dashboard
══════════════════════════════════════════ */

(function init() {
  const token = localStorage.getItem('ff_token');
  const raw = localStorage.getItem('ff_user');
  let user = null;
  try { user = JSON.parse(raw); } catch (_) {}

  if (token && user && user.role === 'dist') {
    showDashboard();
  } else if (token && user && user.role === 'ret') {
    window.location.replace('/retailer.html');
  } else if (token && user && (user.role === 'admin' || user.role === 'superadmin')) {
    window.location.replace('/superadmin.html');
  } else {
    if (token) {
      localStorage.removeItem('ff_token');
      localStorage.removeItem('ff_user');
    }
    showAuth();
  }
})();
=======
/* ── Init ── */
loadProfile();
loadOrders();
>>>>>>> 97ed528f357d5809933e40419aa9027881cc3eb3
