/* =====================================================================
   registration.js — Fair Ford Pharmaceuticals · Retailer registration
   6-step KYC wizard (multipart) on the shared portal design system.
   Retailer-only signup (role='ret'); the backend maps businessName→
   shopName and address→shopAddress. Auto-logs in on success (account
   stays KYC-pending until an admin approves it).
   ===================================================================== */
'use strict';

var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
function toast(msg) { var t = $('rgToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3600); }

$('rgYear').textContent = new Date().getFullYear();

/* if already signed in, no need to register */
(function checkSession() {
  var token = localStorage.getItem('ff_token'), raw = localStorage.getItem('ff_user'), user = null;
  try { user = JSON.parse(raw); } catch (e) {}
  if (token && user && user.role) {
    var dest = user.role === 'ret' ? 'retailer.html' : (user.role === 'dist' ? 'distributor.html' : (user.role === 'admin' || user.role === 'superadmin') ? 'superadmin.html' : 'index.html');
    window.location.replace(dest);
  }
})();

/* ================= VALIDATION ================= */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[6-9]\d{9}$/;
var PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

function fieldErr(input, msg) { var f = input.closest('.pf-field'); if (!f) return false; f.classList.add('is-invalid'); f.classList.remove('is-valid'); var e = f.querySelector('.pf-err'); if (e) e.textContent = msg; return false; }
function fieldOk(input) { var f = input.closest('.pf-field'); if (!f) return true; f.classList.remove('is-invalid'); f.classList.add('is-valid'); return true; }

function showErr(msg) { $('regErrText').textContent = msg; $('regErr').classList.add('is-on'); try { $('regErr').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
function hideErr() { $('regErr').classList.remove('is-on'); }

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
    var bars = document.querySelectorAll('#regForm .pf-pw-bar');
    var s = pwScore(pass.value);
    bars.forEach(function (b, i) { b.className = 'pf-pw-bar' + (i < s ? ' on-' + s : ''); });
    var lbl = $('rgPassLabel');
    if (pass.value) lbl.textContent = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s] + ' — needs 12+ chars, upper, lower, number & symbol';
    else lbl.textContent = 'Min 12 characters · upper, lower, number & symbol (@$!%*?&)';
  });
})();

/* ================= KYC DROPZONES ================= */
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

/* ================= WIZARD ================= */
var STEP = 1, LAST = 6;

function gotoStep(n) {
  STEP = n;
  document.querySelectorAll('#regForm .pf-wstep').forEach(function (s) { s.classList.toggle('is-on', Number(s.getAttribute('data-wstep')) === n); });
  document.querySelectorAll('#wSteps .pf-step').forEach(function (s) {
    var d = Number(s.getAttribute('data-step'));
    s.classList.toggle('active', d === n);
    s.classList.toggle('done', d < n);
  });
  var card = document.querySelector('.pf-auth-panel'); if (card) card.scrollTo({ top: 0, behavior: 'smooth' });
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
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
    chk('rgShop', function (v) { return v.length >= 2; }, 'Enter your shop / pharmacy name');
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
  if (next) { hideErr(); if (validateStep(Number(next.getAttribute('data-next')))) { if (STEP === 5) buildReview(); gotoStep(STEP + 1); } return; }
  var prev = e.target.closest('[data-prev]');
  if (prev) { hideErr(); gotoStep(STEP - 1); return; }
});

/* live-clear field errors as the user types */
document.addEventListener('input', function (e) {
  var f = e.target.closest && e.target.closest('.pf-field.is-invalid');
  if (f) f.classList.remove('is-invalid');
});

function buildReview() {
  var rows = [
    ['Name', $('rgName').value], ['Email', $('rgEmail').value], ['Mobile', $('rgPhone').value],
    ['Shop', $('rgShop').value], ['GST', $('rgGst').value.toUpperCase()], ['Drug licence', $('rgLicence').value],
    ['PAN', $('rgPan').value.toUpperCase()],
    ['Shop address', [$('rgAddress').value, $('rgCity').value, $('rgState').value, $('rgPincode').value].filter(Boolean).join(', ')],
    ['Documents', Object.keys(KYC_FILES).length + ' uploaded']
  ];
  $('reviewGrid').innerHTML = rows.map(function (r) { return '<div class="pf-info-cell"><dt>' + esc(r[0]) + '</dt><dd>' + (esc(r[1]) || '—') + '</dd></div>'; }).join('');
}

/* ================= SUBMIT ================= */
$('regForm').addEventListener('submit', function (e) {
  e.preventDefault();
  hideErr();
  if (!$('rgConsent').checked) { showErr('Please accept the Terms & Conditions and Privacy Policy to continue.'); return; }
  for (var s = 1; s <= 5; s++) { if (!validateStep(s)) { gotoStep(s); return; } }

  var fd = new FormData();
  fd.append('role', 'ret');
  fd.append('name', $('rgName').value.trim());
  fd.append('email', $('rgEmail').value.trim());
  fd.append('password', $('rgPass').value);
  fd.append('confirmPassword', $('rgConfirm').value);
  fd.append('mobile', $('rgPhone').value.trim());
  fd.append('phone', $('rgPhone').value.trim());
  fd.append('businessName', $('rgShop').value.trim());       // → shopName (ret)
  fd.append('shopName', $('rgShop').value.trim());
  fd.append('gstNumber', $('rgGst').value.trim().toUpperCase());
  fd.append('drugLicenseNumber', $('rgLicence').value.trim());
  fd.append('panNumber', $('rgPan').value.trim().toUpperCase());
  fd.append('address', $('rgAddress').value.trim());          // → shopAddress (ret)
  fd.append('city', $('rgCity').value.trim());
  fd.append('state', $('rgState').value.trim());
  fd.append('pincode', $('rgPincode').value.trim());
  Object.keys(KYC_FILES).forEach(function (k) { fd.append(k, KYC_FILES[k]); });

  var btn = $('regBtn'); btn.classList.add('is-loading'); btn.disabled = true;
  fetch('/api/auth/signup', { method: 'POST', body: fd })   // no Content-Type — browser sets multipart boundary
    .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
    .then(function (res) {
      if (!res.ok || !res.b.success) {
        showErr((res.b && res.b.message) || 'Registration failed. Please check your details and try again.');
        return;
      }
      if (res.b.token) {
        localStorage.setItem('ff_token', res.b.token);
        localStorage.setItem('ff_user', JSON.stringify(res.b.user || { role: 'ret' }));
      }
      toast('Application submitted — your account is pending verification.');
      setTimeout(function () { window.location.href = res.b.token ? 'retailer.html' : 'login&signup.html'; }, 1400);
    })
    .catch(function () { showErr('Could not reach the server. Please try again.'); })
    .finally(function () { btn.classList.remove('is-loading'); btn.disabled = false; });
});
