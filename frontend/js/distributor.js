/* =====================================================================
   distributor.js — Fair Ford Pharmaceuticals · Distributor portal
   Hardened login + 6-step KYC registration wizard (multipart) +
   fulfilment dashboard (client-computed metrics, order search/filter,
   order-state actions, read-only coverage).
   ===================================================================== */
'use strict';

var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function toast(msg) { var t = $('dtToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }

var ORDERS = [];
var FILTER = { q: '', status: '', days: '' };

/* ================= AUTH SCREEN TOGGLING ================= */
function showAuth() { $('dtAuth').style.display = ''; $('dtDash').style.display = 'none'; }
function showDash() { $('dtAuth').style.display = 'none'; $('dtDash').style.display = ''; loadProfile(); loadOrders(); }

function switchTab(which) {
  var login = which === 'login';
  $('tabLogin').classList.toggle('is-on', login);
  $('tabSignup').classList.toggle('is-on', !login);
  $('paneLogin').style.display = login ? '' : 'none';
  $('paneSignup').style.display = login ? 'none' : '';
  hideNotes();
}
function hideNotes() { $('authErr').classList.remove('is-on'); $('authWarn').classList.remove('is-on'); }
function showErr(msg) { $('authErrText').textContent = msg; $('authErr').classList.add('is-on'); $('authWarn').classList.remove('is-on'); }
function showWarn(msg) { $('authWarnText').textContent = msg; $('authWarn').classList.add('is-on'); $('authErr').classList.remove('is-on'); }

/* ================= SHARED VALIDATION ================= */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[6-9]\d{9}$/;
var PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

function fieldErr(input, msg) { var f = input.closest('.pf-field'); if (!f) return false; f.classList.add('is-invalid'); f.classList.remove('is-valid'); var e = f.querySelector('.pf-err'); if (e) e.textContent = msg; return false; }
function fieldOk(input) { var f = input.closest('.pf-field'); if (!f) return true; f.classList.remove('is-invalid'); f.classList.add('is-valid'); return true; }
function fieldClear(input) { var f = input.closest('.pf-field'); if (f) f.classList.remove('is-invalid', 'is-valid'); }

/* ================= PASSWORD show/hide + strength ================= */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-toggle]');
  if (!t) return;
  var inp = $(t.getAttribute('data-toggle'));
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  t.setAttribute('aria-label', inp.type === 'password' ? 'Show password' : 'Hide password');
});

function pwScore(v) {
  var s = 0;
  if (v.length >= 12) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[@$!%*?&]/.test(v)) s++;
  return s;
}
(function wirePwMeter() {
  var pass = $('rgPass');
  if (!pass) return;
  pass.addEventListener('input', function () {
    var bars = document.querySelectorAll('#paneSignup .pf-pw-bar');
    var s = pwScore(pass.value);
    bars.forEach(function (b, i) { b.className = 'pf-pw-bar' + (i < s ? ' on-' + s : ''); });
    var lbl = $('rgPassLabel');
    if (pass.value) lbl.textContent = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s] + ' — needs 12+ chars, upper, lower, number & symbol';
    else lbl.textContent = 'Min 12 characters · upper, lower, number & symbol (@$!%*?&)';
  });
})();

/* ================= LOGIN ================= */
(function wireLogin() {
  var form = $('loginForm');
  if (!form) return;
  // remember-me: prefill saved email
  try { var saved = localStorage.getItem('ff_dist_email'); if (saved) { $('loginEmail').value = saved; $('loginRemember').checked = true; } } catch (e) {}

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideNotes();
    var email = $('loginEmail'), pass = $('loginPass'), ok = true;
    if (!EMAIL_RE.test(email.value.trim())) ok = fieldErr(email, 'Enter a valid email'); else fieldOk(email);
    if (!pass.value) ok = fieldErr(pass, 'Enter your password'); else fieldOk(pass);
    if (!ok) return;

    var btn = $('loginBtn'); btn.classList.add('is-loading'); btn.disabled = true;
    fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), password: pass.value }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, ok: r.ok, b: b }; }); })
      .then(function (res) {
        if (!res.ok) {
          var m = (res.b && res.b.message) || 'Login failed';
          // surface lockout / suspension distinctly
          if (/lock/i.test(m) || res.status === 423) showWarn(m);
          else if (/pending|suspend|not.*active|approv/i.test(m)) showWarn(m);
          else showErr(m);
          return;
        }
        var user = res.b.user || {};
        if (user.role && user.role !== 'dist') {
          if (user.role === 'ret') { window.location.href = 'retailer.html'; return; }
          if (user.role === 'admin' || user.role === 'superadmin') { window.location.href = 'superadmin.html'; return; }
          showErr('This portal is for distributors. Use the correct login for your account type.');
          return;
        }
        localStorage.setItem('ff_token', res.b.token);
        localStorage.setItem('ff_user', JSON.stringify(user));
        try { if ($('loginRemember').checked) localStorage.setItem('ff_dist_email', email.value.trim()); else localStorage.removeItem('ff_dist_email'); } catch (e) {}
        showDash();
      })
      .catch(function () { showErr('Could not reach the server. Please try again.'); })
      .finally(function () { btn.classList.remove('is-loading'); btn.disabled = false; });
  });
})();

/* ================= SIGNUP WIZARD ================= */
var STEP = 1, LAST = 6;
var KYC_DOCS = [
  { key: 'drugLicense', label: 'Drug licence', req: true },
  { key: 'gstCertificate', label: 'GST certificate', req: true },
  { key: 'panCard', label: 'PAN card', req: false },
  { key: 'cancelledCheque', label: 'Cancelled cheque', req: false }
];
var KYC_FILES = {};

(function buildKyc() {
  var host = $('kycDrops');
  if (!host) return;
  host.innerHTML = KYC_DOCS.map(function (d) {
    return '<div class="pf-field"><label>' + esc(d.label) + (d.req ? '<span class="pf-req">*</span>' : ' <span class="pf-optional">(optional)</span>') + '</label>' +
      '<label class="pf-drop" data-doc="' + d.key + '">' +
        '<span class="pf-drop-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg></span>' +
        '<span class="pf-drop-body"><b>Upload ' + esc(d.label.toLowerCase()) + '</b><span data-name="' + d.key + '">JPG, PNG or PDF · up to 5 MB</span></span>' +
        '<input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf" data-file="' + d.key + '">' +
      '</label><span class="pf-err" role="alert"></span></div>';
  }).join('');
})();

document.addEventListener('change', function (e) {
  var inp = e.target.closest('[data-file]');
  if (!inp) return;
  var key = inp.getAttribute('data-file');
  var file = inp.files && inp.files[0];
  var drop = inp.closest('.pf-drop');
  var nameEl = drop.querySelector('[data-name="' + key + '"]');
  if (!file) { delete KYC_FILES[key]; drop.classList.remove('has-file'); nameEl.textContent = 'JPG, PNG or PDF · up to 5 MB'; return; }
  var okType = /\.(png|jpe?g|webp|pdf)$/i.test(file.name) || /^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.type);
  if (!okType) { drop.classList.add('is-invalid'); drop.parentNode.querySelector('.pf-err').textContent = 'Use JPG, PNG or PDF'; delete KYC_FILES[key]; return; }
  if (file.size > 5 * 1024 * 1024) { drop.classList.add('is-invalid'); drop.parentNode.querySelector('.pf-err').textContent = 'File exceeds 5 MB'; delete KYC_FILES[key]; return; }
  drop.classList.remove('is-invalid'); drop.classList.add('has-file');
  drop.parentNode.querySelector('.pf-err').textContent = '';
  nameEl.textContent = file.name;
  KYC_FILES[key] = file;
});

function gotoStep(n) {
  STEP = n;
  document.querySelectorAll('#signupForm .pf-wstep').forEach(function (s) { s.classList.toggle('is-on', Number(s.getAttribute('data-wstep')) === n); });
  document.querySelectorAll('#wSteps .pf-step').forEach(function (s) {
    var d = Number(s.getAttribute('data-step'));
    s.classList.toggle('active', d === n);
    s.classList.toggle('done', d < n);
  });
  var card = document.querySelector('.pf-auth-panel'); if (card) card.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(n) {
  var ok = true, first = null;
  function chk(id, test, msg) { var el = $(id); if (!test(el.value.trim())) { ok = fieldErr(el, msg); if (!first) first = el; } else fieldOk(el); }
  if (n === 1) {
    chk('rgName', function (v) { return v.length >= 2; }, 'Enter your name');
    chk('rgPhone', function (v) { return PHONE_RE.test(v); }, 'Valid 10-digit mobile (starts 6–9)');
    chk('rgEmail', function (v) { return EMAIL_RE.test(v); }, 'Enter a valid email');
    chk('rgPass', function (v) { return PW_RE.test(v); }, 'Min 12 chars incl. upper, lower, number & symbol');
    var c = $('rgConfirm'); if (c.value !== $('rgPass').value || !c.value) { ok = fieldErr(c, 'Passwords do not match'); if (!first) first = c; } else fieldOk(c);
  } else if (n === 2) {
    chk('rgBusiness', function (v) { return v.length >= 2; }, 'Enter your business name');
  } else if (n === 3) {
    chk('rgGst', function (v) { return v.length >= 10; }, 'Enter your GST number');
    chk('rgLicence', function (v) { return v.length >= 3; }, 'Enter your drug licence number');
  } else if (n === 4) {
    chk('rgAddress', function (v) { return v.length >= 3; }, 'Enter your street address');
    chk('rgCity', function (v) { return !!v; }, 'City required');
    chk('rgState', function (v) { return !!v; }, 'State required');
    chk('rgPincode', function (v) { return /^[1-9]\d{5}$/.test(v); }, '6-digit PIN');
  } else if (n === 5) {
    KYC_DOCS.forEach(function (d) {
      if (!d.req) return;
      var drop = document.querySelector('.pf-drop[data-doc="' + d.key + '"]');
      if (!KYC_FILES[d.key]) { drop.classList.add('is-invalid'); drop.parentNode.querySelector('.pf-err').textContent = 'Please upload your ' + d.label.toLowerCase(); ok = false; if (!first) first = drop; }
    });
  }
  if (!ok && first && first.focus) first.focus();
  return ok;
}

document.addEventListener('click', function (e) {
  var next = e.target.closest('[data-next]');
  if (next) { if (validateStep(Number(next.getAttribute('data-next')))) { if (STEP === 5) buildReview(); gotoStep(STEP + 1); } return; }
  var prev = e.target.closest('[data-prev]');
  if (prev) { gotoStep(STEP - 1); return; }
  if (e.target.id === 'toSignup') { switchTab('signup'); return; }
  if (e.target.id === 'toLogin') { switchTab('login'); return; }
});
$('tabLogin').addEventListener('click', function () { switchTab('login'); });
$('tabSignup').addEventListener('click', function () { switchTab('signup'); });

function buildReview() {
  var rows = [
    ['Name', $('rgName').value], ['Email', $('rgEmail').value], ['Mobile', $('rgPhone').value],
    ['Business', $('rgBusiness').value], ['GST', $('rgGst').value.toUpperCase()], ['Drug licence', $('rgLicence').value],
    ['Address', [$('rgAddress').value, $('rgCity').value, $('rgState').value, $('rgPincode').value].filter(Boolean).join(', ')],
    ['Documents', Object.keys(KYC_FILES).length + ' uploaded']
  ];
  $('reviewGrid').innerHTML = rows.map(function (r) { return '<div class="pf-info-cell"><dt>' + esc(r[0]) + '</dt><dd>' + (esc(r[1]) || '—') + '</dd></div>'; }).join('');
}

$('signupForm').addEventListener('submit', function (e) {
  e.preventDefault();
  hideNotes();
  if (!$('rgConsent').checked) { showErr('Please accept the Terms & Conditions to continue.'); return; }
  // re-validate all gated steps
  for (var s = 1; s <= 5; s++) { if (!validateStep(s)) { gotoStep(s); return; } }

  var fd = new FormData();
  fd.append('role', 'dist');
  fd.append('name', $('rgName').value.trim());
  fd.append('email', $('rgEmail').value.trim());
  fd.append('password', $('rgPass').value);
  fd.append('confirmPassword', $('rgConfirm').value);
  fd.append('mobile', $('rgPhone').value.trim());
  fd.append('phone', $('rgPhone').value.trim());
  fd.append('businessName', $('rgBusiness').value.trim());
  fd.append('gstNumber', $('rgGst').value.trim().toUpperCase());
  fd.append('drugLicenseNumber', $('rgLicence').value.trim());
  fd.append('panNumber', $('rgPan').value.trim().toUpperCase());
  fd.append('address', $('rgAddress').value.trim());
  fd.append('city', $('rgCity').value.trim());
  fd.append('state', $('rgState').value.trim());
  fd.append('pincode', $('rgPincode').value.trim());
  Object.keys(KYC_FILES).forEach(function (k) { fd.append(k, KYC_FILES[k]); });

  var btn = $('signupBtn'); btn.classList.add('is-loading'); btn.disabled = true;
  fetch('/api/auth/signup', { method: 'POST', body: fd })  // no Content-Type — browser sets multipart boundary
    .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
    .then(function (res) {
      if (!res.ok) { showErr((res.b && res.b.message) || 'Registration failed'); return; }
      localStorage.setItem('ff_token', res.b.token);
      localStorage.setItem('ff_user', JSON.stringify(res.b.user || {}));
      toast('Application submitted — awaiting KYC approval');
      showDash();
    })
    .catch(function () { showErr('Could not reach the server. Please try again.'); })
    .finally(function () { btn.classList.remove('is-loading'); btn.disabled = false; });
});

/* live-clear field errors as the user types */
document.addEventListener('input', function (e) {
  var f = e.target.closest && e.target.closest('.pf-field.is-invalid');
  if (f) f.classList.remove('is-invalid');
});

/* ================= API HELPER ================= */
function api(path, opts) {
  opts = opts || {};
  var token = localStorage.getItem('ff_token');
  return fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, opts.headers || {}),
    body: opts.body
  }).then(function (r) {
    if (r.status === 401) { doLogout(); throw new Error('Session expired'); }
    return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.message || ('HTTP ' + r.status)); return b; });
  });
}

/* ================= DASHBOARD: profile + coverage ================= */
function loadProfile() {
  api('/auth/profile').then(function (d) {
    var u = d.user || {};
    var name = u.businessName || u.name || 'Distributor';
    $('dtName').firstChild.textContent = name;
    $('dtEmail').textContent = u.email || '';
    $('dtAvatar').textContent = (name[0] || 'D').toUpperCase();
    $('dtBanner').style.display = (u.status && u.status !== 'active') ? '' : 'none';
    var a = u.businessAddress || {};
    var cov = [
      ['Business name', u.businessName || u.name || '—'],
      ['Base address', [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ') || '—'],
      ['Territory', (u.territory || []).join(', ') || 'Assigned on approval'],
      ['Serviceable pincodes', (u.serviceablePincodes || []).join(', ') || 'Assigned on approval'],
      ['Contact', [u.email, u.phone].filter(Boolean).join(' · ') || '—'],
      ['Account status', (u.status || 'pending')]
    ];
    $('dtCoverage').innerHTML = cov.map(function (r) { return '<div class="pf-info-cell"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
  }).catch(function (e) { toast('⚠ ' + e.message); });
}

/* ================= DASHBOARD: orders + metrics ================= */
function loadOrders() {
  api('/orders?limit=200').then(function (d) { ORDERS = d.orders || []; renderMetrics(); renderOrders(); })
    .catch(function () { ORDERS = []; renderMetrics(); $('dtOrders').innerHTML = emptyOrders(); });
}

function renderMetrics() {
  var by = { pending: 0, approved: 0, dispatched: 0, delivered: 0, cancelled: 0 };
  var value = 0, retailers = {};
  ORDERS.forEach(function (o) {
    if (by[o.status] != null) by[o.status]++;
    if (o.status !== 'cancelled' && o.status !== 'returned') value += Number(o.totalAmount || 0);
    var rid = o.retailer && (o.retailer._id || o.retailer); if (rid) retailers[String(rid)] = 1;
  });
  var tiles = [
    ['Total orders', ORDERS.length, 'box', ''],
    ['Pending', by.pending, 'clock', 'warn'],
    ['To dispatch', by.approved, 'truck', ''],
    ['Delivered', by.delivered, 'check', 'ok'],
    ['Order value', inr(value), 'rupee', ''],
    ['Active retailers', Object.keys(retailers).length, 'users', '']
  ];
  var icons = {
    box: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    truck: '<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    check: '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/>',
    rupee: '<path d="M6 3h12M6 8h12M9 13h1a5 5 0 0 0 0-10M6 13h5l6 8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'
  };
  $('dtTiles').innerHTML = tiles.map(function (t) {
    return '<div class="pf-tile"><div class="pf-tile-top"><span class="pf-tile-ico' + (t[3] ? ' pf-tile-ico--' + t[3] : '') + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[t[2]] + '</svg></span></div><b>' + t[1] + '</b><span>' + t[0] + '</span></div>';
  }).join('');
}

var STATUS_LABEL = { pending: 'Pending', approved: 'Accepted', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };

function filteredOrders() {
  var now = Date.now();
  return ORDERS.filter(function (o) {
    if (FILTER.status && o.status !== FILTER.status) return false;
    if (FILTER.days) { var t = new Date(o.createdAt).getTime(); if (!(t >= now - Number(FILTER.days) * 864e5)) return false; }
    if (FILTER.q) {
      var shop = o.retailer ? (o.retailer.shopName || o.retailer.name || '') : '';
      var hay = ((o.orderNumber || '') + ' ' + shop).toLowerCase();
      if (hay.indexOf(FILTER.q.toLowerCase()) < 0) return false;
    }
    return true;
  });
}

function emptyOrders() {
  return '<div class="pf-empty"><div class="pf-empty-ico"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg></div><h3>No orders' + (FILTER.q || FILTER.status || FILTER.days ? ' match your filters' : ' yet') + '</h3><p>' + (FILTER.q || FILTER.status || FILTER.days ? 'Try clearing search or filters.' : 'Orders routed to your territory will appear here.') + '</p></div>';
}

function renderOrders() {
  var box = $('dtOrders');
  var list = filteredOrders();
  $('dtOrderCount').textContent = list.length + ' of ' + ORDERS.length + ' orders';
  if (!list.length) { box.innerHTML = emptyOrders(); return; }
  var rows = list.map(function (o) {
    var items = (o.items || []).map(function (i) { return esc(i.productName) + ' ×' + i.quantity; }).join(', ');
    var shop = o.retailer ? (o.retailer.shopName || o.retailer.name || '—') : '—';
    var a = o.deliveryAddress || {};
    var loc = [a.city, a.state, a.pincode].filter(Boolean).join(', ');
    var when = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
    var actions = '';
    if (o.status === 'pending') actions = '<button class="pf-btn pf-btn-primary pf-btn-sm" data-approve="' + o._id + '">Approve</button><button class="pf-btn pf-btn-danger pf-btn-sm" data-cancel="' + o._id + '">Decline</button>';
    else if (o.status === 'approved') actions = '<button class="pf-btn pf-btn-primary pf-btn-sm" data-dispatch="' + o._id + '">Dispatch</button><button class="pf-btn pf-btn-danger pf-btn-sm" data-cancel="' + o._id + '">Cancel</button>';
    else if (o.status === 'dispatched') actions = '<button class="pf-btn pf-btn-primary pf-btn-sm" data-deliver="' + o._id + '">Mark delivered</button>';
    else actions = '<span style="color:var(--muted);font-size:.8rem">—</span>';
    return '<tr>' +
      '<td data-label="Order"><span class="pf-t-id">' + esc(o.orderNumber || '') + '</span><span class="pf-t-sub">' + when + ' · COD</span></td>' +
      '<td data-label="Retailer">' + esc(shop) + (loc ? '<span class="pf-t-sub">' + esc(loc) + '</span>' : '') + '</td>' +
      '<td data-label="Items">' + (items || '—') + '</td>' +
      '<td data-label="Value"><b>' + inr(o.totalAmount) + '</b></td>' +
      '<td data-label="Status"><span class="pf-badge pf-badge--' + esc(o.status) + '"><i></i>' + (STATUS_LABEL[o.status] || o.status) + '</span></td>' +
      '<td data-label=""><div class="pf-t-actions">' + actions + '</div></td>' +
      '</tr>';
  }).join('');
  box.innerHTML = '<div class="pf-table-wrap"><table class="pf-table pf-table--cards"><thead><tr><th>Order</th><th>Retailer</th><th>Items</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* order actions */
function act(id, path, msg) { api('/orders/' + id + path, { method: 'PUT', body: path === '/cancel' ? JSON.stringify({ reason: 'Declined by distributor' }) : undefined }).then(function () { toast('✓ ' + msg); loadOrders(); }).catch(function (e) { toast('⚠ ' + e.message); }); }
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-approve],[data-dispatch],[data-deliver],[data-cancel]');
  if (!t) return;
  if (t.dataset.approve) act(t.dataset.approve, '/approve', 'Order approved');
  else if (t.dataset.dispatch) act(t.dataset.dispatch, '/dispatch', 'Marked dispatched');
  else if (t.dataset.deliver) act(t.dataset.deliver, '/deliver', 'Marked delivered');
  else if (t.dataset.cancel) { if (confirm('Cancel / decline this order?')) act(t.dataset.cancel, '/cancel', 'Order cancelled'); }
});

/* filters */
var searchTimer;
$('dtSearch').addEventListener('input', function () { clearTimeout(searchTimer); var v = this.value; searchTimer = setTimeout(function () { FILTER.q = v; renderOrders(); }, 150); });
$('dtStatusFilter').addEventListener('change', function () { FILTER.status = this.value; renderOrders(); });
$('dtDateFilter').addEventListener('change', function () { FILTER.days = this.value; renderOrders(); });
$('dtRefresh').addEventListener('click', function () { loadOrders(); loadProfile(); toast('Refreshed'); });

/* ================= LOGOUT ================= */
function doLogout() { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); sessionStorage.removeItem('ff_user'); showAuth(); switchTab('login'); }
$('dtLogout').addEventListener('click', function () {
  if (window.showLogoutConfirm) window.showLogoutConfirm(function () { if (window.lcDoLogout) window.lcDoLogout(); doLogout(); });
  else doLogout();
});

/* ================= INIT ================= */
$('dtYear').textContent = new Date().getFullYear();
(function init() {
  var token = localStorage.getItem('ff_token'), raw = localStorage.getItem('ff_user'), user = null;
  try { user = JSON.parse(raw); } catch (e) {}
  if (token && user && user.role === 'dist') showDash();
  else if (token && user && user.role === 'ret') window.location.replace('retailer.html');
  else if (token && user && (user.role === 'admin' || user.role === 'superadmin')) window.location.replace('superadmin.html');
  else { if (token) { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); } showAuth(); switchTab('login'); }
})();
