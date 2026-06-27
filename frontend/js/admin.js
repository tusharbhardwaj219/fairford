/**
 * Fair Ford · Admin / ops panel
 * Self-contained login (POST /api/auth/login role=admin), then:
 *   • Orders — advance the fulfilment lifecycle
 *   • Retailers — approve / suspend (KYC gate)
 *   • Distributors — manage routing coverage (serviceable cities + pincodes)
 */
"use strict";

const $ = (id) => document.getElementById(id);
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function toast(msg) {
  const t = $('adToast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3000);
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
  return data;
}

/* ── Auth ── */
function isAdmin() {
  try {
    const u = JSON.parse(localStorage.getItem('ff_user') || '{}');
    return localStorage.getItem('ff_token') && (u.role === 'admin' || u.role === 'superadmin');
  } catch (e) { return false; }
}

async function doLogin() {
  const email = $('adEmail').value.trim();
  const password = $('adPass').value;
  const msg = $('adLoginMsg');
  msg.classList.remove('show');
  if (!email || !password) { msg.textContent = 'Enter email and password.'; msg.classList.add('show'); return; }

  const btn = $('adLoginBtn'); btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: 'admin' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Login failed');
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user', JSON.stringify(Object.assign({}, data.user, { role: (data.user && data.user.role) || 'admin' })));
    showApp();
  } catch (e) {
    msg.textContent = e.message; msg.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

function logout() {
  localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user');
  $('adApp').style.display = 'none';
  $('adLogin').style.display = 'flex';
}

function showApp() {
  // The admin panel is now the embedded Super Admin dashboard. admin.html acts
  // purely as the login gate and hands off to it once authenticated.
  window.location.replace('/superadmin.html');
}

/* ── Metrics ── */
async function loadMetrics() {
  try {
    const { metrics: m } = await apiFetch('/admin/metrics');
    const cells = [
      [m.orders.pending, 'Pending orders'],
      [m.orders.approved, 'Approved'],
      [m.orders.dispatched, 'Dispatched'],
      [m.orders.delivered, 'Delivered'],
      [m.retailers.pending, 'Retailers pending KYC'],
      [m.retailers.active, 'Active retailers'],
      [m.distributors, 'Distributors'],
      [inr(m.revenue), 'Revenue (disp.+del.)'],
    ];
    $('adMetrics').innerHTML = cells.map(([v, l]) =>
      '<div class="ad-metric"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>').join('');
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── Orders ── */
const NEXT_ACTIONS = {
  pending:    [['approved', 'Approve', 'btn-primary'], ['cancelled', 'Cancel', 'btn-danger']],
  approved:   [['dispatched', 'Dispatch', 'btn-primary'], ['cancelled', 'Cancel', 'btn-danger']],
  dispatched: [['delivered', 'Mark delivered', 'btn-green']],
};

async function loadOrders() {
  const status = $('ordFilter').value;
  try {
    const { orders } = await apiFetch('/admin/orders?status=' + encodeURIComponent(status));
    renderOrders(orders || []);
  } catch (e) {
    $('ordTable').innerHTML = '<tbody><tr><td class="ad-empty">' + esc(e.message) + '</td></tr></tbody>';
  }
}

function renderOrders(orders) {
  const head = '<thead><tr><th>Order</th><th>Retailer</th><th>Routed to</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>';
  if (!orders.length) { $('ordTable').innerHTML = head + '<tbody><tr><td colspan="7" class="ad-empty">No orders.</td></tr></tbody>'; return; }
  const rows = orders.map((o) => {
    const r = o.retailer || {};
    const shop = esc(r.shopName || r.name || '—');
    const city = esc((r.shopAddress && r.shopAddress.city) || '');
    const dist = o.distributor ? esc(o.distributor.businessName || o.distributor.name) : '—';
    const itemCount = (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
    const actions = (NEXT_ACTIONS[o.status] || [])
      .map(([s, label, cls]) => '<button class="btn ' + cls + ' btn-sm" data-order="' + o._id + '" data-to="' + s + '">' + label + '</button>')
      .join(' ') || '<span class="ad-muted">—</span>';
    return '<tr>' +
      '<td><strong>' + esc(o.orderNumber || '') + '</strong></td>' +
      '<td>' + shop + '<div class="ad-muted">' + city + '</div></td>' +
      '<td>' + dist + '</td>' +
      '<td>' + itemCount + ' units</td>' +
      '<td>' + inr(o.totalAmount) + '</td>' +
      '<td><span class="badge ' + esc(o.status) + '">' + esc(o.status) + '</span></td>' +
      '<td><div class="btn-row">' + actions + '</div></td>' +
    '</tr>';
  }).join('');
  $('ordTable').innerHTML = head + '<tbody>' + rows + '</tbody>';
}

async function advanceOrder(id, to) {
  try {
    await apiFetch('/admin/orders/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status: to }) });
    toast('Order ' + to);
    loadOrders(); loadMetrics();
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── Retailers ── */
async function loadRetailers() {
  const status = $('retFilter').value;
  try {
    const { retailers } = await apiFetch('/admin/retailers?status=' + encodeURIComponent(status));
    renderRetailers(retailers || []);
  } catch (e) {
    $('retTable').innerHTML = '<tbody><tr><td class="ad-empty">' + esc(e.message) + '</td></tr></tbody>';
  }
}

function renderRetailers(rets) {
  const head = '<thead><tr><th>Shop</th><th>Owner</th><th>City / Pincode</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>';
  if (!rets.length) { $('retTable').innerHTML = head + '<tbody><tr><td colspan="6" class="ad-empty">No retailers.</td></tr></tbody>'; return; }
  const rows = rets.map((r) => {
    const a = r.shopAddress || {};
    const actions = [];
    if (r.status !== 'active') actions.push('<button class="btn btn-green btn-sm" data-ret="' + r._id + '" data-act="approve">Approve</button>');
    if (r.status !== 'suspended') actions.push('<button class="btn btn-danger btn-sm" data-ret="' + r._id + '" data-act="suspend">Suspend</button>');
    return '<tr>' +
      '<td><strong>' + esc(r.shopName || '—') + '</strong></td>' +
      '<td>' + esc(r.name || '') + '<div class="ad-muted">' + esc(r.email || '') + '</div></td>' +
      '<td>' + esc(a.city || '') + '<div class="ad-muted">' + esc(a.pincode || '') + '</div></td>' +
      '<td>' + esc(r.phone || '') + '</td>' +
      '<td><span class="badge ' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
      '<td><div class="btn-row">' + (actions.join(' ') || '<span class="ad-muted">—</span>') + '</div></td>' +
    '</tr>';
  }).join('');
  $('retTable').innerHTML = head + '<tbody>' + rows + '</tbody>';
}

async function setRetailer(id, act) {
  try {
    await apiFetch('/admin/retailers/' + id + '/' + act, { method: 'PUT' });
    toast('Retailer ' + (act === 'approve' ? 'approved' : 'suspended'));
    loadRetailers(); loadMetrics();
  } catch (e) { toast('⚠ ' + e.message); }
}

/* ── Distributors ── */
async function loadDistributors() {
  try {
    const { distributors } = await apiFetch('/admin/distributors');
    renderDistributors(distributors || []);
  } catch (e) {
    $('distList').innerHTML = '<p class="ad-empty">' + esc(e.message) + '</p>';
  }
}

function renderDistributors(list) {
  if (!list.length) { $('distList').innerHTML = '<p class="ad-empty">No distributors yet — add one above.</p>'; return; }
  $('distList').innerHTML = list.map((d) => {
    const a = d.businessAddress || {};
    return '<div class="ad-dist" data-dist="' + d._id + '">' +
      '<div class="ad-dist-top">' +
        '<div><span class="ad-dist-name">' + esc(d.businessName || d.name) + '</span> ' +
          '<span class="ad-muted">· ' + esc(d.email) + '</span></div>' +
        '<span class="badge ' + esc(d.status) + '">' + esc(d.status) + '</span>' +
      '</div>' +
      '<div class="ad-muted" style="margin-top:4px;">Base: ' + esc(a.city || '—') + ' ' + esc(a.pincode || '') + '</div>' +
      '<div class="ad-dist-grid">' +
        '<div class="ad-field"><label>Serviceable cities</label><input class="d-terr" value="' + esc((d.territory || []).join(', ')) + '" /></div>' +
        '<div class="ad-field"><label>Serviceable pincodes</label><input class="d-pins" value="' + esc((d.serviceablePincodes || []).join(', ')) + '" /></div>' +
        '<div class="ad-field"><label>Status</label><select class="d-status">' +
          ['active', 'suspended', 'pending'].map((s) => '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm d-save" style="margin-top:10px;">Save coverage</button>' +
    '</div>';
  }).join('');
}

async function saveDistributor(card) {
  const id = card.dataset.dist;
  const body = {
    territory: card.querySelector('.d-terr').value,
    serviceablePincodes: card.querySelector('.d-pins').value,
    status: card.querySelector('.d-status').value,
  };
  try {
    await apiFetch('/admin/distributors/' + id, { method: 'PUT', body: JSON.stringify(body) });
    toast('Distributor updated');
    loadDistributors(); loadMetrics();
  } catch (e) { toast('⚠ ' + e.message); }
}

async function createDistributor() {
  const msg = $('distAddMsg'); msg.className = 'ad-msg';
  const body = {
    name: $('dNew_name').value.trim(),
    email: $('dNew_email').value.trim(),
    businessName: $('dNew_business').value.trim(),
    phone: $('dNew_phone').value.trim(),
    city: $('dNew_city').value.trim(),
    pincode: $('dNew_pincode').value.trim(),
    territory: $('dNew_territory').value,
    serviceablePincodes: $('dNew_pincodes').value,
  };
  if (!body.name || !body.email) { msg.textContent = 'Name and email are required.'; msg.className = 'ad-msg err show'; return; }
  const btn = $('distAddBtn'); btn.disabled = true;
  try {
    const data = await apiFetch('/admin/distributors', { method: 'POST', body: JSON.stringify(body) });
    msg.textContent = 'Created. Temp password: ' + (data.tempPassword || '—');
    msg.className = 'ad-msg ok show';
    ['name', 'email', 'business', 'phone', 'city', 'pincode', 'territory', 'pincodes'].forEach((k) => { $('dNew_' + k).value = ''; });
    loadDistributors(); loadMetrics();
  } catch (e) {
    msg.textContent = e.message; msg.className = 'ad-msg err show';
  } finally { btn.disabled = false; }
}

/* ── Tabs ── */
function switchTab(tab) {
  document.querySelectorAll('.ad-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.ad-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
  if (tab === 'retailers') loadRetailers();
  if (tab === 'distributors') loadDistributors();
}

/* ── Events ── */
$('adLoginBtn').addEventListener('click', doLogin);
$('adPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('adLogout').addEventListener('click', logout);
$('ordFilter').addEventListener('change', loadOrders);
$('ordRefresh').addEventListener('click', loadOrders);
$('retFilter').addEventListener('change', loadRetailers);
$('retRefresh').addEventListener('click', loadRetailers);
$('distAddBtn').addEventListener('click', createDistributor);

document.querySelectorAll('.ad-tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.order) advanceOrder(t.dataset.order, t.dataset.to);
  else if (t.dataset.ret) setRetailer(t.dataset.ret, t.dataset.act);
  else if (t.classList.contains('d-save')) saveDistributor(t.closest('.ad-dist'));
});

/* ── Init ── */
if (isAdmin()) { $('adLogin').style.display = 'none'; showApp(); }
