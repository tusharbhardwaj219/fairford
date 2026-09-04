/* =====================================================================
   about-redesign.js — Fair Ford Pharmaceuticals · About page
   ---------------------------------------------------------------------
   - Injects the shared header/footer (renderHeader/renderFooter from
     common.js) so the About page matches every other page exactly.
   - Fills the "what we make" strip with REAL catalogue product photos.
   - Plays a subtle scroll-in entrance via the Web Animations API — purely
     additive, so content is always visible even if it never runs.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---- shared chrome (identical to the product pages) ---- */
  if (typeof renderHeader === 'function') {
    document.getElementById('site-header').innerHTML = renderHeader('about');
    if (typeof initHeader === 'function') initHeader();
  }
  if (typeof renderFooter === 'function') {
    document.getElementById('site-footer').innerHTML = renderFooter();
    if (typeof initFooter === 'function') initFooter();
  }
  if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();

  /* ---- "A look at what we make": real product photography ---- */
  (function fillProductStrip() {
    var host = document.getElementById('abx-prodstrip');
    if (!host || typeof getAllProducts !== 'function') { if (host) host.parentNode.parentNode.style.display = 'none'; return; }

    Promise.resolve(getAllProducts()).then(function (all) {
      if (!Array.isArray(all) || !all.length) { host.parentNode.parentNode.style.display = 'none'; return; }

      // One product per category (with a photo), up to 6 — an honest cross-section.
      var seen = {}, picks = [];
      all.forEach(function (p) {
        if (picks.length >= 6) return;
        if (p.image && !seen[p.category]) { seen[p.category] = 1; picks.push(p); }
      });
      // top up if fewer than 6 categories had photos
      if (picks.length < 6) {
        all.forEach(function (p) { if (picks.length < 6 && p.image && picks.indexOf(p) < 0) picks.push(p); });
      }
      if (!picks.length) { host.parentNode.parentNode.style.display = 'none'; return; }

      host.innerHTML = picks.map(function (p) {
        var href = p.slug ? '/product/' + encodeURIComponent(p.slug)
                          : 'productdetail.html?id=' + encodeURIComponent(p.id);
        // NB: data-fallback-class must NOT be `abx-prod-img` — the img already
        // lives inside that box, so reusing it would nest .abx-prod-img inside
        // itself for any product whose Cloudinary asset was removed, breaking
        // that card. `abx-prod-fallback` sits cleanly inside the same box.
        return '<a class="abx-prod" href="' + href + '" title="' + esc(p.name) + '">' +
          '<div class="abx-prod-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" ' +
            'data-cat="' + esc(p.category) + '" data-fallback-class="abx-prod-fallback" onerror="productImgFallback(this)"></div>' +
          '<span class="abx-prod-cat">' + esc(p.category) + '</span>' +
        '</a>';
      }).join('');
    }).catch(function () { host.parentNode.parentNode.style.display = 'none'; });
  })();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---- subtle scroll-in entrance (enhancement only) ---- */
  (function reveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.abx-reveal'));
    if (!els.length) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window) || typeof Element === 'undefined' || !Element.prototype.animate) {
      return; // content is already visible by default — nothing to do
    }

    function play(el) {
      try {
        el.animate(
          [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
          { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'none' }
        );
      } catch (e) { /* WAAPI hiccup — element stays visible, no harm */ }
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { play(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { io.observe(el); });
  })();
});
