/* =====================================================================
   page-chrome.js — shared header/footer bootstrap
   Each "static" page (About, Contact, T&C, Privacy, etc.) sets
   window.__PAGE_KEY__ before loading this file. We swap any inline topbar /
   header / drawer / footer for the canonical versions rendered by
   common.js (renderHeader / renderFooter), then wire them up. This keeps
   the footer + login/logout button identical on every page without
   forcing a 200-line HTML rewrite on each one.
   ===================================================================== */
(function () {
  function injectHeader() {
    var pageKey = window.__PAGE_KEY__ || '';

    // Remove the inline chrome — any combination of these may be present
    // depending on which copy-paste of the home page each file started from.
    var doomed = [
      document.querySelector('.topbar'),
      document.querySelector('header.header'),
      document.querySelector('header.navbar'),
      document.querySelector('.drawer-overlay'),
      document.querySelector('aside.drawer'),
    ];
    doomed.forEach(function (n) { if (n) n.parentNode.removeChild(n); });

    // Inject the shared header at the very top of <body>
    var headerWrap = document.createElement('div');
    headerWrap.id = 'site-header';
    document.body.insertBefore(headerWrap, document.body.firstChild);
    headerWrap.innerHTML = renderHeader(pageKey);

    // Replace inline footer (whatever flavour) with the shared one
    var oldFooter = document.querySelector('footer.footer') ||
                    document.querySelector('footer[role="contentinfo"]') ||
                    document.querySelector('footer');
    var footerWrap = document.createElement('div');
    footerWrap.id = 'site-footer';
    if (oldFooter && oldFooter.parentNode) {
      oldFooter.parentNode.replaceChild(footerWrap, oldFooter);
    } else {
      document.body.appendChild(footerWrap);
    }
    footerWrap.innerHTML = renderFooter();

    if (typeof initHeader === 'function') initHeader();
    if (typeof initFooter === 'function') initFooter();
    if (typeof initPanels === 'function') initPanels();
    if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();
  }

  // Load a script once (skip if already present) then call cb.
  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) { cb(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = cb; // continue even if load fails
    document.head.appendChild(s);
  }

  // Inject a stylesheet once (skip if already present).
  function loadCSS(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function go() {
    // Inject panel CSS so cart/wishlist panels are styled on non-product pages.
    loadCSS('/frontend/css/panels.css');
    // Ensure product-data scripts are available so cart/wishlist panels can
    // show product names + prices on non-product pages (About, Contact, etc.)
    loadScript('/frontend/js/api.js', function () {
      loadScript('/frontend/js/data.js', function () {
        injectHeader();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
})();
