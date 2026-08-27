/* =====================================================================
   login&signup.js — Fair Ford Pharmaceuticals · Sign in
   Role-agnostic login: the server returns the account's real role and a
   redirect target. Hardened with show/hide, remember-me, per-field
   validation, loading state, and distinct lockout/suspension messaging.
   ===================================================================== */
'use strict';

var $ = function (id) { return document.getElementById(id); };
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

$('lgYear').textContent = new Date().getFullYear();

/* already signed in → honour any pending redirect, else go home */
(function checkSession() {
  var token = localStorage.getItem('ff_token'), user = localStorage.getItem('ff_user');
  if (token && user) { window.location.replace(postLoginRedirect()); return; }
  if (token || user) { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); }
})();

function postLoginRedirect() {
  var page = localStorage.getItem('ff_redirect');
  if (page) { localStorage.removeItem('ff_redirect'); return page; }
  var pid = localStorage.getItem('ff_redirect_product');
  if (pid) { localStorage.removeItem('ff_redirect_product'); return 'productdetail.html?id=' + encodeURIComponent(pid); }
  return 'index.html';
}

/* show/hide password */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-toggle]'); if (!t) return;
  var inp = $(t.getAttribute('data-toggle')); if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  t.setAttribute('aria-label', inp.type === 'password' ? 'Show password' : 'Hide password');
});

function note(kind, msg) {
  ['lgErr', 'lgWarn', 'lgOk'].forEach(function (id) { $(id).classList.remove('is-on'); });
  var map = { err: 'lgErr', warn: 'lgWarn', ok: 'lgOk' };
  $(map[kind] + 'Text').textContent = msg;
  $(map[kind]).classList.add('is-on');
}
function clearNotes() { ['lgErr', 'lgWarn', 'lgOk'].forEach(function (id) { $(id).classList.remove('is-on'); }); }

function fieldErr(input, msg) { var f = input.closest('.pf-field'); f.classList.add('is-invalid'); f.classList.remove('is-valid'); f.querySelector('.pf-err').textContent = msg; return false; }
function fieldOk(input) { var f = input.closest('.pf-field'); f.classList.remove('is-invalid'); f.classList.add('is-valid'); return true; }

/* remember-me: prefill saved email */
try { var saved = localStorage.getItem('ff_login_email'); if (saved) { $('email').value = saved; $('lgRemember').checked = true; } } catch (e) {}

document.addEventListener('input', function (e) { var f = e.target.closest && e.target.closest('.pf-field.is-invalid'); if (f) f.classList.remove('is-invalid'); });

$('lgForm').addEventListener('submit', function (e) {
  e.preventDefault();
  clearNotes();
  var email = $('email'), pass = $('password'), ok = true;
  if (!EMAIL_RE.test(email.value.trim())) ok = fieldErr(email, 'Enter a valid email'); else fieldOk(email);
  if (!pass.value) ok = fieldErr(pass, 'Enter your password'); else fieldOk(pass);
  if (!ok) return;

  var btn = $('lgBtn'); btn.classList.add('is-loading'); btn.disabled = true;
  fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), password: pass.value }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, ok: r.ok, b: b }; }); })
    .then(function (res) {
      if (!res.ok || !res.b.success) {
        var m = (res.b && res.b.message) || 'Login failed. Please try again.';
        if (/lock/i.test(m) || res.status === 423) note('warn', m + ' If this continues, contact support.');
        else if (/pending|suspend|not.*active|approv|deactivat/i.test(m)) note('warn', m);
        else note('err', m);
        return;
      }
      var user = Object.assign({}, res.b.user || {}, { role: (res.b.user && res.b.user.role) || 'ret' });
      localStorage.setItem('ff_token', res.b.token);
      localStorage.setItem('ff_user', JSON.stringify(user));
      try { if ($('lgRemember').checked) localStorage.setItem('ff_login_email', email.value.trim()); else localStorage.removeItem('ff_login_email'); } catch (e) {}
      note('ok', 'Signed in — redirecting…');
      var savedRedirect = postLoginRedirect();
      var dest = (savedRedirect && savedRedirect !== 'index.html') ? savedRedirect : (res.b.redirectTo || 'index.html');
      window.location.href = dest.replace(/^\//, '');
    })
    .catch(function () { note('err', 'Could not reach the server. Please try again.'); })
    .finally(function () { btn.classList.remove('is-loading'); btn.disabled = false; });
});
