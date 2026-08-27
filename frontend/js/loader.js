/* ==============================================================
   FAIR FORD PHARMACEUTICALS — page loader
   loader.js  ·  pairs with css/loader.css
   --------------------------------------------------------------
   Sequence:
     mark fades up inside a ring -> wordmark settles -> the ring and
     a hair rail track real load progress -> two panels split apart
     and the page is revealed behind them.

   Loaded in <head> (no defer) so the overlay exists before the page
   paints; it is appended to <html> because <body> does not exist yet.

   WHEN IT RUNS
   This is a multi-page app, so every internal link is a full document
   load. Playing the sequence on each one would be punishing, so it
   plays on the first view of a session and on an explicit reload, and
   is skipped for in-session navigation.

   IT MUST NEVER TRAP THE USER
   Three independent exits: the progress timeline, window 'load', and a
   hard failsafe timeout. Each calls the same idempotent finish().
   ============================================================== */

(function () {
  'use strict';

  var LOGO = 'https://res.cloudinary.com/dp4yririh/image/upload/v1782967649/fairford/site/m5d8pmtzdjr4dcgctvuc.png';
  var SEEN_KEY = 'ff_loader_seen';
  var FAILSAFE_MS = 5000;   // absolute ceiling — the overlay is gone by now, always
  var RING_LEN = 302;       // 2·π·48, matches the circle in the markup below

  // ── Should it play at all? ───────────────────────────────────────
  function navType() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type;
      if (performance.navigation) {
        return performance.navigation.type === 1 ? 'reload' : 'navigate';
      }
    } catch (_) { /* ignore */ }
    return 'navigate';
  }

  function shouldPlay() {
    // Honour an explicit opt-out, e.g. for automated testing.
    try {
      if (window.location.search.indexOf('noloader') > -1) return false;
    } catch (_) { /* ignore */ }

    var type = navType();
    if (type === 'reload') return true;          // refresh always replays
    if (type === 'back_forward') return false;   // bfcache restore — never

    try {
      return !sessionStorage.getItem(SEEN_KEY);  // first view of the session
    } catch (_) {
      return true;                               // storage blocked: play it
    }
  }

  if (!shouldPlay()) return;

  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* ignore */ }

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) { /* ignore */ }

  // ── Build the overlay ────────────────────────────────────────────
  var root = document.documentElement;
  root.classList.add('ff-l-active');

  var overlay = document.createElement('div');
  overlay.id = 'ff-loader';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Loading Fair Ford Pharmaceuticals');

  overlay.innerHTML =
    '<span class="ff-l-panel ff-l-panel--top" aria-hidden="true"></span>' +
    '<span class="ff-l-panel ff-l-panel--bottom" aria-hidden="true"></span>' +
    '<span class="ff-l-wash" aria-hidden="true"></span>' +
    '<div class="ff-l-stage">' +
      '<div class="ff-l-mark">' +
        '<svg class="ff-l-ring" viewBox="0 0 104 104" aria-hidden="true">' +
          '<defs><linearGradient id="ffLGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#0F4C81"/>' +
            '<stop offset="0.55" stop-color="#1E6FA8"/>' +
            '<stop offset="1" stop-color="#36B7A5"/>' +
          '</linearGradient></defs>' +
          '<circle class="trk" cx="52" cy="52" r="48"/>' +
          '<circle class="arc" cx="52" cy="52" r="48"/>' +
        '</svg>' +
        '<img class="ff-l-logo" src="' + LOGO + '" alt="" aria-hidden="true" ' +
             'width="62" height="62" decoding="async">' +
      '</div>' +
      '<p class="ff-l-text">FAIR FORD</p>' +
      '<p class="ff-l-sub">Pharmaceuticals</p>' +
      '<div class="ff-l-rail"><span class="ff-l-bar"></span></div>' +
    '</div>';

  root.appendChild(overlay);

  var bar = overlay.querySelector('.ff-l-bar');
  var arc = overlay.querySelector('.ff-l-ring .arc');

  // ── Exit (idempotent) ────────────────────────────────────────────
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(failsafe);
    paint(100);
    overlay.classList.add('is-out');
    root.classList.remove('ff-l-active');
    // Remove after the panels have cleared so it cannot intercept clicks.
    var kill = function () {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    overlay.addEventListener('transitionend', kill, { once: true });
    setTimeout(kill, 1100);
  }

  var failsafe = setTimeout(finish, FAILSAFE_MS);

  // ── Progress ─────────────────────────────────────────────────────
  var shown = 0;
  function paint(v) {
    v = Math.max(0, Math.min(100, v));
    if (v <= shown) return;
    shown = v;
    if (bar) bar.style.width = v + '%';
    if (arc) arc.style.strokeDashoffset = String(RING_LEN * (1 - v / 100));
  }

  var RAMP_MS = reduced ? 280 : 1250;   // 0 -> 92%
  var HOLD_MS = reduced ? 60 : 200;     // beat at 100% before the panels part
  var start = (window.performance && performance.now) ? performance.now() : Date.now();
  var now = function () {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  };

  var settled = false;
  function tick() {
    if (done) return;
    var t = Math.min(1, (now() - start) / RAMP_MS);
    paint(92 * (1 - Math.pow(1 - t, 3)));      // ease-out ramp
    if (t < 1) { requestAnimationFrame(tick); return; }
    settled = true;
    if (document.readyState === 'complete') complete();
  }

  function complete() {
    if (done) return;
    paint(100);
    setTimeout(finish, HOLD_MS);
  }

  requestAnimationFrame(tick);

  if (document.readyState === 'complete') {
    // Warm cache: let the ramp play out rather than snapping away.
    setTimeout(complete, RAMP_MS);
  } else {
    window.addEventListener('load', function () {
      if (settled) complete();
    }, { once: true });
  }
})();
