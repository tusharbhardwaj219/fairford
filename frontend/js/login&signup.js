const API = '/api/auth';

// ── Role selector ─────────────────────────────────────────────────────────────
const roles = {
  dist: { tag: '<i class="ri-shopping-bag-line"></i> DISTRIBUTOR / STOCKIST', tagClass: 'tag-dist', btn: 'Sign in as Distributor →' },
  ret:  { tag: '<i class="ri-price-tag-3-line"></i> RETAILER / CHEMIST',      tagClass: 'tag-ret',  btn: 'Sign in as Retailer →'    },
  hosp: { tag: '<i class="ri-hospital-line"></i> HOSPITAL / INSTITUTION',     tagClass: 'tag-hosp', btn: 'Sign in as Hospital →'    },
  mfr:  { tag: '<i class="ri-building-2-line"></i> MANUFACTURER',             tagClass: 'tag-mfr',  btn: 'Sign in as Manufacturer →'}
};

// Retailer is the only self-service role. Distributors/stockists are onboarded
// by an admin; hospital/manufacturer roles are not used.
let activeRole = 'ret';

function selectRole(btn, role) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeRole = role;
  const r = roles[role];
  const ctag = document.getElementById('contextTag');
  ctag.className = 'context-tag ' + r.tagClass;
  ctag.innerHTML = r.tag;
  document.getElementById('signinBtn').textContent = r.btn;
}

// ── Password toggle ───────────────────────────────────────────────────────────
// Inline SVGs (icon font is blocked by the site CSP, so we swap raw SVG markup).
const EYE_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.42M6.6 6.6C3.9 8.2 2 12 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.4-.6M3 3l18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

function togglePw() {
  const inp = document.getElementById('password');
  const btn = document.querySelector('.pw-toggle');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = EYE_OFF_SVG;
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    inp.type = 'password';
    btn.innerHTML = EYE_SVG;
    btn.setAttribute('aria-label', 'Show password');
  }
}

// ── Status message helpers ────────────────────────────────────────────────────
function showMsg(text, type) {
  type = type || 'error';
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.className = 'auth-msg auth-msg--' + type;
  el.style.display = 'block';
}
function hideMsg() {
  document.getElementById('authMessage').style.display = 'none';
}

// ── After-login redirect ──────────────────────────────────────────────────────
function getPostLoginRedirect() {
  const page = localStorage.getItem('ff_redirect');
  if (page) {
    localStorage.removeItem('ff_redirect');
    return page;
  }
  const productId = localStorage.getItem('ff_redirect_product');
  if (productId) {
    localStorage.removeItem('ff_redirect_product');
    return 'productdetail.html?id=' + encodeURIComponent(productId);
  }
  return 'index.html';
}

// ── Login handler ─────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  hideMsg();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('signinBtn');

  if (!email || !password) {
    showMsg('Please enter your email and password.');
    return;
  }

  const originalText = btn.textContent;
  btn.textContent   = 'Authenticating…';
  btn.disabled      = true;
  btn.style.opacity = '0.7';

  try {
    const res  = await fetch(API + '/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, role: activeRole })
    });
    const data = await res.json();

    if (!data.success) {
      showMsg(data.message || 'Login failed. Please try again.');
      btn.textContent  = originalText;
      btn.disabled     = false;
      btn.style.opacity = '1';
      return;
    }

    // Store token + user info. Use the account's REAL role from the response
    // (login is role-agnostic now), falling back to the selected role.
    const userData = Object.assign({}, data.user || {}, { role: (data.user && data.user.role) || activeRole });
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user',  JSON.stringify(userData));

    btn.textContent  = '✓ Redirecting…';
    btn.style.opacity = '1';
    btn.style.background = 'linear-gradient(135deg,#12b886,#0ca678)';
    btn.style.boxShadow  = '0 4px 22px rgba(18,184,134,0.45)';

    var saved = getPostLoginRedirect();
    var dest  = (saved && saved !== 'index.html') ? saved : (data.redirectTo || '/index.html');
    window.location.href = dest;

  } catch (err) {
    showMsg('Could not reach the server. Is it running on port 5000?');
    btn.textContent  = originalText;
    btn.disabled     = false;
    btn.style.opacity = '1';
  }
}

// ── Auto-redirect if already fully logged in ──────────────────────────────────
// Only redirect when BOTH ff_token AND ff_user are present.
// If only one exists, the session is corrupt — clear it and stay on login page.
(function checkSession() {
  const token = localStorage.getItem('ff_token');
  const user  = localStorage.getItem('ff_user');

  if (token && user) {
    // Already logged in — honour any pending redirect, then go home
    window.location.replace(getPostLoginRedirect());
    return;
  }

  if (token || user) {
    // Inconsistent state (one key missing) — clear both to avoid a redirect loop
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
  }
})();
