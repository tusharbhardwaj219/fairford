/* =====================================================================
   b2b-landing.js — shared chrome bootstrap for the B2B landing pages
   (become-a-distributor.html, hospital-procurement.html).
   Injects the canonical shared header/footer (renderHeader/renderFooter
   from common.js) into the #site-header / #site-footer placeholders and
   wires them up — identical to how the About/Contact redesigns bootstrap.
   The page content itself is static, crawlable HTML; this only adds the
   shared nav/footer + cart/login state. The FAQ uses native <details>,
   so it needs no JavaScript.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var key = window.__PAGE_KEY__ || '';

  if (typeof renderHeader === 'function') {
    var h = document.getElementById('site-header');
    if (h) h.innerHTML = renderHeader(key);
    if (typeof initHeader === 'function') initHeader();
  }
  if (typeof renderFooter === 'function') {
    var f = document.getElementById('site-footer');
    if (f) f.innerHTML = renderFooter();
    if (typeof initFooter === 'function') initFooter();
  }
  if (typeof initPanels === 'function') initPanels();
  if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();
});
