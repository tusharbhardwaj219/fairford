/* =====================================================================
   GLOBAL LOGOUT CONFIRMATION MODAL  —  logout-confirm.js
   Self-contained: injects own CSS, builds DOM, exposes two globals.

   window.showLogoutConfirm(onConfirm)
     – Show the modal; call onConfirm() (sync or async) on user confirm.
     – If onConfirm returns a rejected Promise, shows inline error.

   window.lcDoLogout(redirectUrl)
     – Standard logout helper: clears all auth storage, transitions the
       modal to a success state, then redirects after ~700 ms.
     – Call this FROM inside your onConfirm callback.
   ===================================================================== */
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────────
     CSS  (injected once as a <style id="lc--css"> in <head>)
  ────────────────────────────────────────────────────────────────── */
  var STYLES = [
    /* overlay */
    '.lc-overlay{position:fixed;inset:0;background:rgba(10,20,40,.65);',
    'backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);',
    'z-index:99999;display:flex;align-items:center;justify-content:center;',
    'padding:16px;opacity:0;pointer-events:none;',
    'transition:opacity .25s ease;}',
    '.lc-overlay.lc-show{opacity:1;pointer-events:all;}',

    /* modal card */
    '.lc-modal{background:#fff;border-radius:24px;',
    'box-shadow:0 32px 80px rgba(10,20,40,.22),0 8px 24px rgba(10,20,40,.1),',
    '0 0 0 1px rgba(15,76,129,.06);',
    'width:100%;max-width:460px;padding:44px 40px 36px;text-align:center;',
    'transform:scale(.92) translateY(16px);',
    'transition:transform .28s cubic-bezier(.34,1.4,.64,1);}',
    '.lc-overlay.lc-show .lc-modal{transform:scale(1) translateY(0);}',

    /* icon ring */
    '.lc-icon{width:76px;height:76px;border-radius:50%;',
    'background:linear-gradient(135deg,#fff1f1,#ffe4e4);',
    'border:2px solid rgba(220,38,38,.14);',
    'display:flex;align-items:center;justify-content:center;',
    'margin:0 auto 24px;transition:background .3s,border-color .3s;}',
    '.lc-icon--ok{background:linear-gradient(135deg,#f0fdf4,#dcfce7);',
    'border-color:rgba(34,197,94,.2);}',

    /* text */
    '.lc-title{font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;',
    'font-size:1.5rem;font-weight:700;color:#0f172a;margin:0 0 12px;',
    'letter-spacing:-.3px;transition:color .3s;}',
    '.lc-title--ok{color:#15803d;}',
    '.lc-desc{font-family:"Inter",system-ui,sans-serif;font-size:.9rem;',
    'color:#64748b;line-height:1.65;margin:0 0 32px;}',

    /* action buttons row */
    '.lc-actions{display:flex;gap:12px;}',
    '.lc-btn{flex:1;height:50px;border-radius:12px;',
    'font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;',
    'font-size:.95rem;font-weight:600;letter-spacing:.1px;',
    'cursor:pointer;border:none;',
    'display:inline-flex;align-items:center;justify-content:center;gap:8px;',
    'transition:all .2s ease;}',
    '.lc-btn:disabled{opacity:.6;cursor:not-allowed;pointer-events:none;}',
    '.lc-btn:focus-visible{outline:3px solid rgba(59,130,246,.55);outline-offset:2px;}',

    /* cancel */
    '.lc-btn--cancel{background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569;}',
    '.lc-btn--cancel:hover:not(:disabled){background:#f1f5f9;border-color:#cbd5e1;color:#1e293b;}',

    /* confirm / logout */
    '.lc-btn--logout{background:#dc2626;border:1.5px solid #dc2626;color:#fff;',
    'box-shadow:0 4px 12px rgba(220,38,38,.25);}',
    '.lc-btn--logout:hover:not(:disabled){background:#b91c1c;border-color:#b91c1c;',
    'transform:translateY(-2px);box-shadow:0 8px 20px rgba(220,38,38,.35);}',
    '.lc-btn--logout:active:not(:disabled){transform:translateY(0);',
    'box-shadow:0 2px 8px rgba(220,38,38,.2);}',

    /* spinner */
    '.lc-spin{width:18px;height:18px;border:2.5px solid rgba(255,255,255,.3);',
    'border-top-color:#fff;border-radius:50%;',
    'animation:lc-spin .6s linear infinite;flex-shrink:0;}',
    '@keyframes lc-spin{to{transform:rotate(360deg)}}',

    /* error bar */
    '.lc-error{margin-top:14px;padding:10px 14px;background:#fef2f2;',
    'border:1px solid rgba(220,38,38,.2);border-radius:8px;',
    'font-size:.85rem;color:#dc2626;text-align:center;display:none;}',

    /* mobile */
    '@media(max-width:520px){',
    '.lc-modal{padding:32px 20px 28px;border-radius:20px;}',
    '.lc-actions{flex-direction:column;}',
    '.lc-title{font-size:1.3rem;}}'
  ].join('');

  /* ──────────────────────────────────────────────────────────────────
     DOM icons
  ────────────────────────────────────────────────────────────────── */
  var ICON_LOGOUT = [
    '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#DC2626" stroke-width="2"',
    ' stroke-linecap="round" stroke-linejoin="round"/>',
    '<polyline points="16 17 21 12 16 7" stroke="#DC2626" stroke-width="2"',
    ' stroke-linecap="round" stroke-linejoin="round"/>',
    '<line x1="21" y1="12" x2="9" y2="12" stroke="#DC2626" stroke-width="2"',
    ' stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>'
  ].join('');

  var ICON_OK = [
    '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<circle cx="12" cy="12" r="10" stroke="#16A34A" stroke-width="2"/>',
    '<polyline points="8 12 11 15 16 9" stroke="#16A34A" stroke-width="2.2"',
    ' stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>'
  ].join('');

  /* ──────────────────────────────────────────────────────────────────
     Private state
  ────────────────────────────────────────────────────────────────── */
  var _overlay = null;
  var _kh = null;   /* active keydown handler */

  /* ──────────────────────────────────────────────────────────────────
     Bootstrap helpers
  ────────────────────────────────────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('lc--css')) return;
    var s = document.createElement('style');
    s.id = 'lc--css';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function _buildDOM() {
    if (document.getElementById('lc--overlay')) {
      _overlay = document.getElementById('lc--overlay');
      return;
    }
    var el = document.createElement('div');
    el.id = 'lc--overlay';
    el.className = 'lc-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'lc--title');
    el.setAttribute('aria-describedby', 'lc--desc');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="lc-modal" id="lc--modal">' +
        '<div class="lc-icon" id="lc--icon">' + ICON_LOGOUT + '</div>' +
        '<h2 class="lc-title" id="lc--title">Log Out?</h2>' +
        '<p class="lc-desc" id="lc--desc">Are you sure you want to log out of your account?<br>' +
          'You will need to sign in again to access your dashboard, orders, and account information.</p>' +
        '<div class="lc-actions" id="lc--actions">' +
          '<button class="lc-btn lc-btn--cancel" id="lc--cancel" type="button">Cancel</button>' +
          '<button class="lc-btn lc-btn--logout" id="lc--confirm" type="button">' +
            '<span id="lc--btn-text">Log Out</span>' +
            '<span class="lc-spin" id="lc--spin" style="display:none" aria-hidden="true"></span>' +
          '</button>' +
        '</div>' +
        '<div class="lc-error" id="lc--error"></div>' +
      '</div>';
    document.body.appendChild(el);
    _overlay = el;
  }

  /* ──────────────────────────────────────────────────────────────────
     Open / close
  ────────────────────────────────────────────────────────────────── */
  function _open() {
    _overlay.setAttribute('aria-hidden', 'false');
    _overlay.classList.add('lc-show');
    setTimeout(function () {
      var cb = document.getElementById('lc--cancel');
      if (cb) cb.focus();
    }, 60);
  }

  function _close() {
    _overlay.classList.remove('lc-show');
    _overlay.setAttribute('aria-hidden', 'true');
    if (_kh) { document.removeEventListener('keydown', _kh); _kh = null; }
  }

  function _resetContent() {
    var icon    = document.getElementById('lc--icon');
    var title   = document.getElementById('lc--title');
    var desc    = document.getElementById('lc--desc');
    var actions = document.getElementById('lc--actions');
    var btnText = document.getElementById('lc--btn-text');
    var spin    = document.getElementById('lc--spin');
    var cancel  = document.getElementById('lc--cancel');
    var confirm = document.getElementById('lc--confirm');
    var error   = document.getElementById('lc--error');

    if (icon)    { icon.className = 'lc-icon'; icon.innerHTML = ICON_LOGOUT; }
    if (title)   { title.className = 'lc-title'; title.textContent = 'Log Out?'; }
    if (desc)    { desc.className = 'lc-desc'; desc.innerHTML = 'Are you sure you want to log out of your account?<br>You will need to sign in again to access your dashboard, orders, and account information.'; }
    if (actions) actions.style.display = '';
    if (btnText) btnText.textContent = 'Log Out';
    if (spin)    spin.style.display = 'none';
    if (cancel)  { cancel.disabled = false; cancel.textContent = 'Cancel'; }
    if (confirm) confirm.disabled = false;
    if (error)   { error.style.display = 'none'; error.textContent = ''; }
  }

  /* ──────────────────────────────────────────────────────────────────
     Error display helper
  ────────────────────────────────────────────────────────────────── */
  function _showError() {
    var error   = document.getElementById('lc--error');
    var btnText = document.getElementById('lc--btn-text');
    var spin    = document.getElementById('lc--spin');
    var cancel  = document.getElementById('lc--cancel');
    var confirm = document.getElementById('lc--confirm');
    if (error)   { error.textContent = 'Unable to log out. Please try again.'; error.style.display = 'block'; }
    if (btnText) btnText.textContent = 'Log Out';
    if (spin)    spin.style.display = 'none';
    if (cancel)  cancel.disabled = false;
    if (confirm) confirm.disabled = false;
  }

  /* ──────────────────────────────────────────────────────────────────
     Core show logic
  ────────────────────────────────────────────────────────────────── */
  function _show(onConfirm) {
    _resetContent();

    /* Clone buttons to strip stale event listeners */
    ['lc--cancel', 'lc--confirm'].forEach(function (id) {
      var old = document.getElementById(id);
      if (!old) return;
      var clone = old.cloneNode(true);
      old.parentNode.replaceChild(clone, old);
    });

    var cancelBtn  = document.getElementById('lc--cancel');
    var confirmBtn = document.getElementById('lc--confirm');
    var btnText    = document.getElementById('lc--btn-text');
    var spin       = document.getElementById('lc--spin');
    var errorEl    = document.getElementById('lc--error');

    _open();

    /* Cancel — close modal, keep user logged in */
    cancelBtn.addEventListener('click', _close);

    /* Click outside modal */
    _overlay.addEventListener('click', function onBg(e) {
      if (e.target === _overlay) { _close(); _overlay.removeEventListener('click', onBg); }
    });

    /* Keyboard: Escape + Tab-trap */
    _kh = function (e) {
      if (e.key === 'Escape') { _close(); return; }
      if (e.key === 'Tab') {
        var focusable = [cancelBtn, confirmBtn].filter(function (b) { return !b.disabled; });
        if (!focusable.length) { e.preventDefault(); return; }
        var cur = focusable.indexOf(document.activeElement);
        e.preventDefault();
        focusable[(cur + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
      }
    };
    document.addEventListener('keydown', _kh);

    /* Confirm — show spinner, invoke callback */
    confirmBtn.addEventListener('click', function () {
      btnText.textContent   = '';
      spin.style.display    = 'inline-block';
      cancelBtn.disabled    = true;
      confirmBtn.disabled   = true;
      errorEl.style.display = 'none';

      var result;
      try { result = onConfirm(); } catch (_) { _showError(); return; }

      if (result && typeof result.then === 'function') {
        result['catch'](function () { _showError(); });
      } else {
        /* Sync callback: if page didn't navigate, close modal after brief pause */
        setTimeout(function () {
          var still = document.getElementById('lc--overlay');
          if (still && still.classList.contains('lc-show')) { _close(); }
        }, 400);
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────────
     Public API
  ────────────────────────────────────────────────────────────────── */

  /**
   * showLogoutConfirm(onConfirm)
   * Displays the confirmation modal. onConfirm is called when the user
   * clicks "Log Out". It may be sync or return a Promise.
   */
  window.showLogoutConfirm = function (onConfirm) {
    var run = function () {
      _injectStyles();
      _buildDOM();
      _show(onConfirm);
    };
    if (document.body) { run(); }
    else { document.addEventListener('DOMContentLoaded', run, { once: true }); }
  };

  /**
   * lcDoLogout(redirectUrl)
   * Standard logout helper — call this from inside your onConfirm callback.
   *   1. Clears ff_token / ff_user from localStorage and sessionStorage.
   *   2. Transitions the still-open modal to a success state.
   *   3. Redirects to redirectUrl after ~700 ms.
   */
  window.lcDoLogout = function (redirectUrl) {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    sessionStorage.removeItem('ff_user');

    /* Transition modal to success state */
    var icon    = document.getElementById('lc--icon');
    var title   = document.getElementById('lc--title');
    var desc    = document.getElementById('lc--desc');
    var actions = document.getElementById('lc--actions');
    var error   = document.getElementById('lc--error');

    if (icon)    { icon.className = 'lc-icon lc-icon--ok'; icon.innerHTML = ICON_OK; }
    if (title)   { title.className = 'lc-title lc-title--ok'; title.textContent = 'Logged Out'; }
    if (desc)    { desc.textContent = 'You have been logged out successfully.'; }
    if (actions) actions.style.display = 'none';
    if (error)   error.style.display = 'none';

    setTimeout(function () {
      window.location.href = redirectUrl || '/index.html';
    }, 700);
  };

})();
