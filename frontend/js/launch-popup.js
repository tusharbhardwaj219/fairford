/* =====================================================================
   launch-popup.js — Fair Ford Pharmaceuticals · NUEVA VIDA launch popup
   Self-contained: builds its own DOM so there is ZERO footprint (no markup,
   no 1.8MB image) when the visitor has already dismissed it. Shows once per
   dismissal window, after the loader, with a short delay. Full a11y: focus
   trap, Esc to close, scroll lock, restore on close. GA4 analytics.

   To retire the campaign: remove the <link>/<script> for launch-popup.* from
   index.html (nothing else references them).
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    storeKey: 'ff_nv_launch_v1',   // bump the suffix to re-run for everyone
    showAgainDays: 7,              // re-show this long after a dismissal
    delayMs: 2500,                 // pause after the loader before appearing
    productPage: 'nueva-vida.html',
    // Cloudinary transform: auto format + quality, width-capped → ~1.8MB PNG
    // becomes ~100KB WebP/AVIF, still sharp. Aspect ratio is preserved.
    image: 'https://res.cloudinary.com/dp4yririh/image/upload/f_auto,q_auto,w_1000/v1788166849/ChatGPT_Image_Aug_31_2026_02_28_01_PM_lpzhkb.png'
  };

  /* ---- dismissal window ---- */
  function dismissedRecently() {
    try {
      var ts = parseInt(localStorage.getItem(CONFIG.storeKey), 10);
      return ts && (Date.now() - ts) < CONFIG.showAgainDays * 86400000;
    } catch (e) { return false; }
  }
  function markDismissed() { try { localStorage.setItem(CONFIG.storeKey, String(Date.now())); } catch (e) {} }

  // A page REFRESH always re-shows the popup (like the site loader, which
  // replays on reload). The dismissal window only suppresses it on ordinary
  // navigation to the home page, so we don't nag while clicking around.
  function isReload() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'reload';
      return !!(performance.navigation && performance.navigation.type === 1);
    } catch (e) { return false; }
  }

  if (!isReload() && dismissedRecently()) return;   // nothing built, nothing loaded

  var overlay, card, lastFocus, scrollY = 0, opened = false;

  function track(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, Object.assign({ event_category: 'nueva_vida_launch' }, params || {})); } catch (e) {}
  }

  /* ---- build the DOM (only reached when it WILL show) ---- */
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'nvp-overlay';
    overlay.id = 'nvpOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'nvpTitle');
    overlay.setAttribute('aria-describedby', 'nvpDesc');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="nvp-card" role="document">' +
        '<button class="nvp-close" type="button" data-nvp-close aria-label="Close announcement">' + CLOSE + '</button>' +
        '<div class="nvp-grid">' +
          '<div class="nvp-left">' +
            '<span class="nvp-label">Introducing</span>' +
            '<h2 class="nvp-title" id="nvpTitle">NUEVA <span>VIDA</span></h2>' +
            '<p class="nvp-sub" id="nvpDesc">Discover Nueva Vida — our latest wellness range from Fair Ford Pharmaceuticals. Science backed, nature inspired.</p>' +
            '<div class="nvp-cta">' +
              '<a class="nvp-btn" href="' + CONFIG.productPage + '" data-nvp-cta>Explore product ' + ARROW + '</a>' +
              '<a class="nvp-link" href="' + CONFIG.productPage + '" data-nvp-learn>Learn more</a>' +
            '</div>' +
            '<span class="nvp-flag"><i aria-hidden="true"></i>New launch</span>' +
          '</div>' +
          '<div class="nvp-right">' +
            '<span class="nvp-ring nvp-ring--1" aria-hidden="true"></span>' +
            '<span class="nvp-ring nvp-ring--2" aria-hidden="true"></span>' +
            '<span class="nvp-glow" aria-hidden="true"></span>' +
            '<img class="nvp-product" alt="NUEVA VIDA product by Fair Ford Pharmaceuticals" decoding="async" width="1000" height="1000">' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    card = overlay.querySelector('.nvp-card');

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { close('backdrop'); return; }           // click outside card
      var c = e.target.closest('[data-nvp-close]'); if (c) { e.preventDefault(); close('button'); }
    });
    overlay.querySelectorAll('[data-nvp-cta],[data-nvp-learn]').forEach(function (a) {
      a.addEventListener('click', function () {
        var which = a.hasAttribute('data-nvp-cta') ? 'explore_product' : 'learn_more';
        track('nueva_vida_cta_click', { cta: which, destination: CONFIG.productPage });
        markDismissed();   // acted on it → don't nag again
        // default anchor navigation proceeds to the product page
      });
    });
  }

  /* ---- focus trap ---- */
  function focusables() {
    return overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }
  function onKey(e) {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); close('escape'); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---- scroll lock (restores exact position on close) ---- */
  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  function unlockScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  function open() {
    if (opened) return;
    build();
    lastFocus = document.activeElement;
    var img = overlay.querySelector('.nvp-product');
    img.src = CONFIG.image;
    img.onerror = function () { img.style.display = 'none'; };  // never show a broken product
    overlay.hidden = false;
    // Reveal on the next paint so the entrance animation runs from its start.
    // Triggered by BOTH rAF and a setTimeout fallback (guarded) — some
    // renderers withhold animation frames, and the popup must still open.
    var revealed = false;
    function reveal() {
      if (revealed) return; revealed = true;
      overlay.classList.add('is-open');   // visible resting state
      opened = true;
      // Subtle entrance via WAAPI. The element is already visible via .is-open,
      // so even a withheld animation leaves the correct final state.
      // Transform-only entrance (opacity stays 1 via .is-open) so the popup is
      // NEVER left invisible if a renderer withholds/freezes the animation.
      if (overlay.animate) {
        var EZ = 'cubic-bezier(.22,1,.36,1)';
        card.animate([{ transform: 'translateY(16px) scale(.99)' }, { transform: 'none' }], { duration: 500, delay: 30, easing: EZ, fill: 'backwards' });
        var prod = overlay.querySelector('.nvp-product');
        if (prod) prod.animate([{ transform: 'translateY(20px) scale(.965)' }, { transform: 'none' }], { duration: 680, delay: 120, easing: EZ, fill: 'backwards' });
      }
      lockScroll();
      document.addEventListener('keydown', onKey, true);
      var btn = overlay.querySelector('.nvp-close');
      if (btn) btn.focus();
      track('nueva_vida_impression', { product: 'NUEVA VIDA' });
    }
    requestAnimationFrame(reveal);
    setTimeout(reveal, 40);
  }

  function close(reason) {
    if (!opened) return;
    opened = false;
    document.removeEventListener('keydown', onKey, true);
    markDismissed();
    track('nueva_vida_close', { method: reason || 'dismiss' });
    var finished = false;
    var done = function () {
      if (finished) return; finished = true;
      unlockScroll();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    };
    if (overlay.animate) {
      var a = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease' });
      a.onfinish = done; a.oncancel = done;
    }
    setTimeout(done, 340);   // fallback if the animation is withheld/unsupported
  }

  /* ---- schedule: wait for the loader to finish, then a gentle delay ---- */
  function loaderGone() {
    return !document.getElementById('ff-loader') && !document.documentElement.classList.contains('ff-l-active');
  }
  function schedule() {
    var tries = 0;
    (function wait() {
      if (loaderGone() || tries++ > 60) { setTimeout(open, CONFIG.delayMs); return; }
      setTimeout(wait, 200);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
})();
