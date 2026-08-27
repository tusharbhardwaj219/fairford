/* =====================================================================
   product.js — Fair Ford Pharmaceuticals · B2B product marketplace
   ---------------------------------------------------------------------
   Owns everything inside product.html's `.ffm-*` markup: hero figures,
   category navigation, the curated Top Selling rail, Buy Again, the
   filter/search/sort engine, the product grid, quick view, compare,
   wishlist, share and recently-viewed.

   DATA INTEGRITY — read before adding a feature here.
   The live catalogue exposes: name, brand, category, strength, packSize,
   dosageForm, composition, description, mrp, stock/stockStatus,
   minimumOrderQuantity, catalogue code (tags), image, createdAt, plus
   role-specific trade prices that the SERVER releases only to an
   authenticated account. It does NOT expose ratings or reviews (every
   product is 0/0), bestseller or featured flags (false on all 164),
   per-product certifications (empty on all), MOQ tiers or bulk price
   slabs (every MOQ is 1), or any sales/order volume. Nothing in this
   file may display those as if they existed — if the data is absent the
   UI omits the element rather than inventing a placeholder value.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ==================================================================
     0 · SMALL HELPERS
     ================================================================== */
  var $  = function (id) { return document.getElementById(id); };
  var esc = typeof escHtml === 'function'
    ? escHtml
    : function (s) { return String(s == null ? '' : s); };

  /** ₹ with no trailing ".00" — prices are quoted in whole rupees or paise. */
  function money(n) { return inr(n).replace('.00', ''); }

  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }

  /** Case/spacing-insensitive key used to match names across sources. */
  function nkey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
  }

  /* ==================================================================
     1 · AUTH + ROLE-AWARE PRICING
     ------------------------------------------------------------------
     Trade prices are stripped server-side for anonymous visitors (see
     filterProductPricing in productController.js), so a guest's payload
     simply has no retailerPrice/distributorPrice to leak. Everything
     below is presentation only — it never becomes the access control.
     ================================================================== */
  var rawToken = localStorage.getItem('ff_token');
  var rawUser  = localStorage.getItem('ff_user');
  var IS_AUTHED = !!(rawToken && rawUser);

  var USER = {};
  // JSON.parse(null) returns null rather than throwing, so guard before
  // reading .role — a guest used to crash here.
  try { if (rawUser) USER = JSON.parse(rawUser) || {}; } catch (e) { USER = {}; }
  var ROLE     = String(USER.role || '').toLowerCase();
  var IS_DIST  = ROLE === 'dist';
  var IS_RET   = ROLE === 'ret';

  /** The price this visitor is entitled to see, falling back to public MRP. */
  function priceOf(p) {
    if (IS_AUTHED) {
      var trade = IS_DIST ? p.distributorPrice : p.retailerPrice;
      if (trade) return trade;
    }
    return p.mrp || 0;
  }
  function priceLabel() {
    if (!IS_AUTHED) return 'MRP';
    if (IS_DIST) return 'Distributor price';
    if (IS_RET)  return 'Your trade price';
    return 'Trade price';
  }

  function sendToLogin() {
    try { localStorage.setItem('ff_redirect', 'product.html'); } catch (e) {}
    window.location.href = 'login&signup.html';
  }

  /* ==================================================================
     2 · SHARED CHROME
     ================================================================== */
  $('site-header').innerHTML = renderHeader('products');
  $('site-footer').innerHTML = renderFooter();
  initHeader();   // also boots the cart / wishlist slide-over panels
  initFooter();

  /* ==================================================================
     3 · MODULE STATE
     ================================================================== */
  var ALL   = [];        // every catalogue product
  var CATS  = [];        // [{ name, count }] — real categories only
  var PRICE_FLOOR = 0, PRICE_CEIL = 0;

  var state = {
    q:      '',
    cats:   [],
    forms:  [],
    packs:  [],
    avail:  [],
    min:    0,
    max:    0,
    sort:   'name',
    view:   'grid'
  };

  var PAGE = 24;
  var pageList = [], shown = 0;

  var RECENT_KEY  = 'ff_recent';
  var COMPARE_KEY = 'ff_compare';
  var VIEW_KEY    = 'ff_view';
  var compare = readJSON(COMPARE_KEY, []).slice(0, 4);

  var grid = $('ffm-grid');

  /* ==================================================================
     4 · ICONS (inline SVG — no icon font, nothing to block or FOUT)
     ================================================================== */
  var I = {
    heart:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.9 8.9 8.8-8.9a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    scale:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 7H4l-2 6a4 4 0 0 0 8 0L8 7H7zM17 7h3l2 6a4 4 0 0 1-8 0l2-6h1zM6 21h12"/></svg>',
    share:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>',
    cart:   '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    arrow:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    chev:   '<svg class="ffm-fgroup-chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    x:      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    close:  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    flask:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3L14 9V3"/><path d="M7.5 15h9"/></svg>',
    layers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>'
  };

  /* Category icons, keyed by the real category names in the catalogue. */
  function catIcon(name) {
    var k = String(name || '').toLowerCase();
    var A = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
    if (k.indexOf('tablet') === 0)   return '<svg ' + A + '><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><circle cx="15.5" cy="9.5" r="1.6"/><circle cx="8.5" cy="15" r="1.6"/><circle cx="15.5" cy="15" r="1.6"/></svg>';
    if (k.indexOf('capsule') === 0)  return '<svg ' + A + '><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="m7 10 7 7"/></svg>';
    if (k.indexOf('syrup') === 0)    return '<svg ' + A + '><path d="M9 2h6v3H9z"/><path d="M8 5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M6 14h12"/></svg>';
    if (k.indexOf('drop') === 0)     return '<svg ' + A + '><path d="M12 2.7 6.9 9.4a6.5 6.5 0 1 0 10.2 0z"/></svg>';
    if (k.indexOf('sachet') === 0 || k.indexOf('powder') >= 0)
      return '<svg ' + A + '><path d="M5 4h14v16H5z"/><path d="M5 8h14M9 4v16"/></svg>';
    if (k.indexOf('gel') === 0 || k.indexOf('ointment') === 0 || k.indexOf('cream') >= 0)
      return '<svg ' + A + '><path d="M10 2h4v3h-4z"/><path d="M8 5h8l-1 15a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/><path d="M9 10h6"/></svg>';
    if (k.indexOf('injection') === 0) return '<svg ' + A + '><path d="m18 2 4 4M17 7l-1-1M21 3l-9 9-4 1 1-4 9-9z"/><path d="m8 12 4 4-6 6-4-4z"/></svg>';
    if (k.indexOf('personal') === 0)  return '<svg ' + A + '><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>';
    if (k.indexOf('analgesic') === 0) return '<svg ' + A + '><path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/></svg>';
    if (k.indexOf('antifungal') === 0 || k.indexOf('antibiotic') === 0 || k.indexOf('antiallergic') === 0)
      return '<svg ' + A + '><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>';
    if (k.indexOf('vitamin') === 0 || k.indexOf('supplement') === 0)
      return '<svg ' + A + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    if (k.indexOf('cardiac') === 0)   return '<svg ' + A + '><path d="M20.8 5.6a5.5 5.5 0 0 0-8.8 1.4 5.5 5.5 0 0 0-8.8-1.4c-2.1 2.1-2.1 5.6 0 7.8l8.8 8.4 8.8-8.4c2.1-2.2 2.1-5.7 0-7.8z"/><path d="M3.5 13h4l1.5-2.5 2 4 1.5-3 1 1.5h4"/></svg>';
    if (k.indexOf('gastro') === 0)    return '<svg ' + A + '><path d="M8 3v5a4 4 0 0 0 4 4 5 5 0 0 1 5 5 4 4 0 0 1-8 0"/></svg>';
    return '<svg ' + A + '><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V4h8v3"/></svg>';
  }

  /* ==================================================================
     5 · DERIVED PRODUCT FIELDS
     ================================================================== */
  function compositionOf(p) {
    var c = p.composition;
    // [] is truthy, so a plain falsy test rendered an empty line on the 51
    // catalogue items that carry no salt data.
    if (Array.isArray(c)) return c.filter(Boolean).join(' + ');
    return c ? String(c) : '';
  }
  /** '-' is the catalogue's own "not recorded" marker. Treat it as absent. */
  function real(v) {
    var s = String(v == null ? '' : v).trim();
    return (!s || s === '-') ? '' : s;
  }
  function stockClass(p) {
    return p.stockStatus === 'Out of Stock' ? 'out'
         : p.stockStatus === 'Low Stock'    ? 'low' : 'in';
  }

  /* Searchable haystack — brand, salt, category, form, pack and code all
     count, because a pharmacy buyer looks up whichever one is on the order
     slip in front of them. */
  function haystack(p) {
    if (p.__hay) return p.__hay;
    p.__hay = [p.name, p.brand, compositionOf(p), p.category, real(p.dosageForm),
               real(p.packSize), real(p.strength), p.code]
      .filter(Boolean).join(' ').toLowerCase();
    return p.__hay;
  }

  /* ==================================================================
     6 · SKELETONS + LOAD STATES
     ================================================================== */
  function skeletonCard() {
    return '<div class="ffm-skel">' +
      '<div class="ffm-skel-media ffm-sk"></div>' +
      '<div class="ffm-skel-body">' +
        '<span class="ffm-sk" style="width:58px;height:11px"></span>' +
        '<span class="ffm-sk" style="width:92%;height:15px"></span>' +
        '<span class="ffm-sk" style="width:70%;height:12px"></span>' +
        '<span class="ffm-sk" style="width:46%;height:22px;margin-top:6px"></span>' +
        '<span class="ffm-sk" style="width:100%;height:38px;border-radius:9px;margin-top:8px"></span>' +
      '</div></div>';
  }
  function paintSkeletons(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += skeletonCard();
    grid.innerHTML = out;
  }

  function stateBlock(opts) {
    return '<div class="ffm-state' + (opts.variant ? ' ffm-state--' + opts.variant : '') + '">' +
      '<div class="ffm-state-art">' + opts.art + '</div>' +
      '<h3>' + esc(opts.title) + '</h3>' +
      '<p>' + opts.body + '</p>' +
      (opts.actions ? '<div class="ffm-state-actions">' + opts.actions + '</div>' : '') +
      (opts.hint ? '<p class="ffm-state-hint">' + opts.hint + '</p>' : '') +
    '</div>';
  }

  var ART_SEARCH = '<svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#0F4C81" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="18" width="38" height="30" rx="4" opacity=".28"/><path d="M10 27h38" opacity=".28"/><path d="M22 18v-4h14v4" opacity=".28"/><circle cx="46" cy="42" r="14" fill="#F7F9FC"/><circle cx="46" cy="42" r="11"/><path d="m55 51 7 7"/><path d="M41 42h10" /></svg>';
  var ART_ERROR  = '<svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M36 12 8 60h56L36 12z" opacity=".3"/><path d="M36 30v14M36 51h.04"/></svg>';
  var ART_BOX    = '<svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#0F4C81" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 22 36 10l26 12v28L36 62 10 50z" opacity=".3"/><path d="M10 22l26 12 26-12M36 34v28"/></svg>';

  function showLoadError() {
    $('ffm-result-count').textContent = 'Catalogue unavailable';
    grid.innerHTML = stateBlock({
      variant: 'error',
      art: ART_ERROR,
      title: 'Unable to load products',
      body: 'We could not reach the product catalogue. This is usually a connection problem and clears on a retry.',
      actions: '<button type="button" class="ffm-btn ffm-btn-primary" data-act="retry">Retry</button>' +
               '<a class="ffm-btn ffm-btn-ghost" href="contactus.html">Contact support</a>'
    });
    $('ffm-loadmore').innerHTML = '';
  }

  function showEmptyCatalogue() {
    $('ffm-result-count').textContent = 'No products published';
    grid.innerHTML = stateBlock({
      art: ART_BOX,
      title: 'No products published yet',
      body: 'The catalogue is currently empty. Products appear here as soon as they are published from the admin panel.',
      actions: '<a class="ffm-btn ffm-btn-primary" href="contactus.html">Enquire about our range</a>'
    });
    $('ffm-loadmore').innerHTML = '';
  }

  /* ==================================================================
     7 · BOOT
     ------------------------------------------------------------------
     The entry point lives at the very bottom of this file, after every
     `var` above has been assigned. Calling wireStaticUI() from here
     instead would run it while `sugBox` (declared in section 16) was
     still hoisted-but-undefined.
     ================================================================== */
  async function boot() {
    var products;
    try {
      products = await getAllProducts();
    } catch (e) {
      products = [];
    }

    // "Request failed" and "catalogue is empty" are different states and must
    // never show the same message (see productsLoadFailed in data.js).
    if (typeof productsLoadFailed === 'function' && productsLoadFailed()) {
      showLoadError();
      return;
    }
    if (!products.length) {
      showEmptyCatalogue();
      return;
    }

    ALL = products;
    CATS = await loadCategories(ALL);

    var prices = ALL.map(priceOf);
    PRICE_FLOOR = Math.max(0, Math.floor(Math.min.apply(null, prices)));
    PRICE_CEIL  = Math.ceil(Math.max.apply(null, prices));
    state.min = PRICE_FLOOR;
    state.max = PRICE_CEIL;

    buildFilters();
    readURL();
    paintHeroStats();
    paintHeroVisual();
    paintCategories();
    paintTopSelling();
    paintRecentlyViewed();
    paintBuyAgain();      // async, signed-in retailers only
    renderCompareBar();

    applyView(readJSON(VIEW_KEY, 'grid'));
    apply();
    store.syncCounts();
  }

  /* Real categories, from the API where possible. The old page hardcoded nine
     names, which silently hid the 13 products filed under Analgesics,
     Antifungals, Vitamins and Cardiac — they existed but could not be
     filtered to. Counts always come from the products actually loaded. */
  async function loadCategories(list) {
    var counts = {};
    list.forEach(function (p) {
      var c = p.category || 'Other';
      counts[c] = (counts[c] || 0) + 1;
    });

    var ordered = null;
    try {
      var res = await fetch('/api/categories');
      if (res.ok) {
        var data = await res.json();
        var api = (data && (data.categories || data.data)) || [];
        if (api.length) {
          ordered = api
            .map(function (c) { return String(c.categoryName || '').trim(); })
            .filter(function (n) { return n && counts[n]; });
        }
      }
    } catch (e) { /* fall through to catalogue-derived order */ }

    var names = Object.keys(counts);
    if (ordered && ordered.length) {
      // Keep the admin's category order, then append anything the endpoint
      // did not list so no product is ever unreachable.
      ordered.forEach(function (n) {
        var i = names.indexOf(n);
        if (i >= 0) names.splice(i, 1);
      });
      names = ordered.concat(names.sort());
    } else {
      names.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    }

    return names.map(function (n) { return { name: n, count: counts[n] }; });
  }

  /* ==================================================================
     8 · HERO
     ================================================================== */
  function paintHeroStats() {
    var box = $('ffm-hero-stats');
    if (!box) return;
    var p = box.querySelector('[data-stat="products"]');
    var c = box.querySelector('[data-stat="categories"]');
    if (p) countUp(p, ALL.length, '');
    if (c) countUp(c, CATS.length, '');
  }

  function countUp(el, target, suffix) {
    var final = target + suffix;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A background tab throttles requestAnimationFrame to a standstill, which
    // used to leave the figure frozen at its first frame — "0 products".
    if (reduced || document.hidden) { el.textContent = final; return; }

    var start = performance.now(), dur = 900;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
    // Belt and braces: whatever happens to the frame loop, the real number
    // is on screen by the time the animation should have finished.
    setTimeout(function () { el.textContent = final; }, dur + 150);
  }

  /* The hero visual is built from three real catalogue photographs — never
     stock imagery and never invented packaging. Products with an image and a
     short name read best at this size. */
  function paintHeroVisual() {
    var host = $('ffm-hero-visual');
    if (!host) return;

    var picks = pickCurated().filter(function (p) { return p.image; }).slice(0, 3);
    if (picks.length < 3) {
      var extra = ALL.filter(function (p) {
        return p.image && picks.indexOf(p) < 0 && p.name.length < 34;
      });
      picks = picks.concat(extra.slice(0, 3 - picks.length));
    }
    if (picks.length < 3) { host.remove(); return; }

    host.innerHTML =
      '<div class="ffm-hv-stack">' +
        picks.map(function (p) {
          return '<article class="ffm-hv-card">' +
            '<div class="ffm-hv-img"><img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async" ' +
              'data-cat="' + esc(p.category) + '" data-fallback-class="ffm-hv-img" onerror="productImgFallback(this)"></div>' +
            '<span class="ffm-hv-cat">' + esc(p.category) + '</span>' +
            '<span class="ffm-hv-name">' + esc(p.name) + '</span>' +
          '</article>';
        }).join('') +
        '<span class="ffm-hv-seal"><i></i>' + ALL.length + ' products in stock list</span>' +
      '</div>';
  }

  /* ==================================================================
     9 · CATEGORY NAVIGATION
     ================================================================== */
  function paintCategories() {
    var host = $('ffm-cats');
    if (!host) return;
    host.innerHTML = CATS.map(function (c) {
      return '<button type="button" class="ffm-cat-card" role="listitem" data-cat="' + esc(c.name) + '">' +
        '<span class="ffm-cat-ico">' + catIcon(c.name) + '</span>' +
        '<span><span class="ffm-cat-name">' + esc(c.name) + '</span>' +
        '<span class="ffm-cat-count">' + c.count + (c.count === 1 ? ' product' : ' products') + '</span></span>' +
        '<span class="ffm-cat-go">Explore products ' + I.arrow + '</span>' +
      '</button>';
    }).join('');

    host.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) return;
      var name = btn.getAttribute('data-cat');
      state.cats = [name];
      state.q = '';
      $('ffm-search-input').value = '';
      syncFilterInputs();
      apply();
      scrollToCatalogue();
      toast('Showing ' + name);
    });
  }

  function scrollToCatalogue() {
    var el = $('catalogue');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ==================================================================
     10 · PRODUCT CARD
     ================================================================== */
  function detailHref(p) { return 'productdetail.html?id=' + encodeURIComponent(p.id); }

  function mediaHTML(p, cls) {
    cls = cls || 'ffm-card-img';
    if (p.image) {
      return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" class="' + cls + '"' +
             ' loading="lazy" decoding="async" width="320" height="240"' +
             ' data-cat="' + esc(p.category) + '" data-fallback-class="ffm-card-svg"' +
             ' onerror="productImgFallback(this)">';
    }
    return '<div class="ffm-card-svg">' +
           (typeof productImageSVG === 'function' ? productImageSVG(p.category) : '') + '</div>';
  }

  function pricingHTML(p) {
    var price = priceOf(p);
    if (!IS_AUTHED) {
      return '<div class="ffm-price">' +
        '<div class="ffm-price-row">' +
          '<span class="ffm-price-main">' + money(price) + '</span>' +
          '<span class="ffm-price-tag">MRP</span>' +
        '</div>' +
        '<button type="button" class="ffm-price-lock" data-login="1">' + I.lock +
          'Sign in to view trade pricing</button>' +
      '</div>';
    }
    var save = (p.mrp && p.mrp > price) ? Math.round(((p.mrp - price) / p.mrp) * 100) : 0;
    return '<div class="ffm-price">' +
      '<div class="ffm-price-row">' +
        '<span class="ffm-price-main">' + money(price) + '</span>' +
        (p.mrp && p.mrp > price ? '<span class="ffm-price-mrp">' + money(p.mrp) + '</span>' : '') +
        (save > 0 ? '<span class="ffm-price-save">' + save + '% off MRP</span>' : '') +
      '</div>' +
      '<p class="ffm-price-note">' + priceLabel() +
        (p.gstRate ? ' · excl. ' + p.gstRate + '% GST' : '') + '</p>' +
    '</div>';
  }

  function specsHTML(p) {
    var rows = [];
    if (real(p.packSize))   rows.push(['Pack', p.packSize]);
    if (real(p.strength))   rows.push(['Strength', p.strength]);
    if (real(p.dosageForm)) rows.push(['Form', p.dosageForm]);
    if (p.code)             rows.push(['Code', p.code]);
    if (!rows.length) return '';
    return '<dl class="ffm-card-specs">' + rows.map(function (r) {
      return '<div class="ffm-spec"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function actionsHTML(p) {
    var out = p.stockStatus === 'Out of Stock';
    if (!IS_AUTHED) {
      return '<div class="ffm-card-actions">' +
        '<div class="ffm-card-buyrow">' +
          '<button type="button" class="ffm-btn ffm-btn-primary ffm-card-cta" data-login="1">' +
            I.lock + 'Sign in to order</button>' +
        '</div>' +
        '<a class="ffm-card-view" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">View details ' + I.arrow + '</a>' +
      '</div>';
    }
    if (out) {
      return '<div class="ffm-card-actions">' +
        '<div class="ffm-card-buyrow">' +
          '<button type="button" class="ffm-btn ffm-card-cta" disabled>Out of stock</button>' +
        '</div>' +
        '<a class="ffm-card-view" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">View details ' + I.arrow + '</a>' +
      '</div>';
    }
    var moq = Math.max(1, Number(p.minimumOrderQuantity || p.moq || 1));
    return '<div class="ffm-card-actions">' +
      '<div class="ffm-card-buyrow">' +
        qtyHTML(p.id, moq, moq) +
        '<button type="button" class="ffm-btn ffm-btn-primary ffm-card-cta" data-cart="' + esc(p.id) + '">' +
          I.cart + 'Add to cart</button>' +
      '</div>' +
      '<a class="ffm-card-view" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">View details ' + I.arrow + '</a>' +
    '</div>';
  }

  function qtyHTML(id, value, min) {
    return '<div class="ffm-qty" data-qty-for="' + esc(id) + '">' +
      '<button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<input type="number" value="' + value + '" min="' + min + '" step="1" inputmode="numeric"' +
        ' aria-label="Quantity" data-min="' + min + '">' +
      '<button type="button" data-step="1" aria-label="Increase quantity">+</button>' +
    '</div>';
  }

  function cardHTML(p) {
    var wished  = store.wishlist.indexOf(p.id) >= 0;
    var inCmp   = compare.indexOf(p.id) >= 0;
    var comp    = compositionOf(p);
    var sc      = stockClass(p);
    var moq     = Math.max(1, Number(p.minimumOrderQuantity || p.moq || 1));

    // Badges reflect stock reality only. There is no bestseller/featured or
    // launch-date data in the catalogue to badge against — see the header note.
    var badge = '';
    if (p.stockStatus === 'Out of Stock')   badge = '<span class="ffm-badge ffm-badge--out">Out of stock</span>';
    else if (p.stockStatus === 'Low Stock') badge = '<span class="ffm-badge ffm-badge--low">Limited stock</span>';
    else if (moq > 1)                       badge = '<span class="ffm-badge ffm-badge--moq">MOQ ' + moq + '</span>';

    return '<article class="ffm-card' + (inCmp ? ' is-compared' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="ffm-card-media">' +
        badge +
        '<div class="ffm-card-tools">' +
          '<button type="button" class="ffm-tool' + (wished ? ' is-on' : '') + '" data-wish="' + esc(p.id) + '"' +
            ' aria-pressed="' + (wished ? 'true' : 'false') + '" title="' + (wished ? 'Remove from wishlist' : 'Save to wishlist') + '"' +
            ' aria-label="' + (wished ? 'Remove from wishlist' : 'Save to wishlist') + '">' + I.heart + '</button>' +
          '<button type="button" class="ffm-tool" data-qv="' + esc(p.id) + '" title="Quick view" aria-label="Quick view: ' + esc(p.name) + '">' + I.eye + '</button>' +
          '<button type="button" class="ffm-tool' + (inCmp ? ' is-on' : '') + '" data-cmp="' + esc(p.id) + '"' +
            ' aria-pressed="' + (inCmp ? 'true' : 'false') + '" title="Compare" aria-label="Add to comparison">' + I.scale + '</button>' +
          '<button type="button" class="ffm-tool" data-share="' + esc(p.id) + '" title="Share" aria-label="Share this product">' + I.share + '</button>' +
        '</div>' +
        '<a class="ffm-card-imglink" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '" tabindex="-1" aria-hidden="true">' +
          mediaHTML(p) +
        '</a>' +
      '</div>' +
      '<div class="ffm-card-body">' +
        '<div class="ffm-card-top">' +
          '<span class="ffm-cat">' + esc(p.category) + '</span>' +
          '<span class="ffm-stock ffm-stock--' + sc + '"><i></i>' + esc(p.stockStatus) + '</span>' +
        '</div>' +
        '<h3 class="ffm-card-name"><a href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">' + esc(p.name) + '</a></h3>' +
        (comp
          ? '<p class="ffm-card-comp" title="' + esc(comp) + '">' + esc(comp) + '</p>'
          : '<p class="ffm-card-comp ffm-card-comp--none">Composition not listed</p>') +
        specsHTML(p) +
        pricingHTML(p) +
        actionsHTML(p) +
      '</div>' +
    '</article>';
  }

  /* ==================================================================
     11 · FILTER PANEL — every facet is built from real catalogue values
     ================================================================== */
  function tallyBy(list, keyFn) {
    var out = {};
    list.forEach(function (p) {
      var k = keyFn(p);
      if (!k) return;
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  /* Product types come from `dosageForm`. 46 of the 164 products record it as
     "-" (not captured); those are simply absent from the facet rather than
     being bucketed into an invented "Other" type. */
  function formOptions() {
    var t = tallyBy(ALL, function (p) { return real(p.dosageForm); });
    return Object.keys(t).sort(function (a, b) { return t[b] - t[a] || a.localeCompare(b); });
  }

  /* Pack sizes are free text ("1X10", "20*10", "200mL", "60ml"), so group
     case-insensitively and show the spelling the catalogue uses most. */
  var packLabels = {};
  function packKey(p) {
    var s = real(p.packSize);
    if (!s) return '';
    var k = s.toLowerCase().replace(/\s+/g, '');
    if (!packLabels[k]) packLabels[k] = s;
    return k;
  }
  function packOptions() {
    var t = tallyBy(ALL, packKey);
    return Object.keys(t).sort(function (a, b) { return t[b] - t[a] || a.localeCompare(b); });
  }

  var AVAIL = ['In Stock', 'Low Stock', 'Out of Stock'];

  /* Faceted counts: each facet is tallied against the list filtered by every
     OTHER active facet, so the numbers shown are the results you would
     actually get — and a buyer can never click into a dead end. */
  function countsFor(facet) {
    var list = filterList(ALL, facet);
    if (facet === 'cats')  return tallyBy(list, function (p) { return p.category; });
    if (facet === 'forms') return tallyBy(list, function (p) { return real(p.dosageForm); });
    if (facet === 'packs') return tallyBy(list, packKey);
    if (facet === 'avail') return tallyBy(list, function (p) { return p.stockStatus; });
    return {};
  }

  function checkRow(group, value, label, count, checked) {
    var dis = count === 0 && !checked;
    return '<label class="ffm-check"' + (dis ? ' style="opacity:.45"' : '') + '>' +
      '<input type="checkbox" data-group="' + group + '" value="' + esc(value) + '"' +
        (checked ? ' checked' : '') + (dis ? ' disabled' : '') + '>' +
      '<span class="ffm-check-box">' + I.check + '</span>' +
      '<span class="ffm-check-txt" title="' + esc(label) + '">' + esc(label) + '</span>' +
      '<span class="ffm-check-tally">' + count + '</span>' +
    '</label>';
  }

  function fgroup(title, key, bodyHTML, open, activeCount) {
    return '<details class="ffm-fgroup"' + (open ? ' open' : '') + ' data-fgroup="' + key + '">' +
      '<summary>' + esc(title) +
        (activeCount ? ' <span class="ffm-fgroup-tag">' + activeCount + '</span>' : '') +
        I.chev +
      '</summary>' +
      '<div class="ffm-fbody">' + bodyHTML + '</div>' +
    '</details>';
  }

  function buildFilters() { renderFilters(); }

  function renderFilters() {
    var host = $('ffm-filters-scroll');
    if (!host) return;

    // Preserve which accordions the buyer had open across re-renders.
    var openSet = {};
    Array.prototype.forEach.call(host.querySelectorAll('[data-fgroup]'), function (d) {
      openSet[d.getAttribute('data-fgroup')] = d.open;
    });
    var first = !host.children.length;

    var cCat   = countsFor('cats');
    var cForm  = countsFor('forms');
    var cPack  = countsFor('packs');
    var cAvail = countsFor('avail');

    var html = '';

    html += fgroup('Category', 'cats',
      '<div class="ffm-fbody-scroll">' + CATS.map(function (c) {
        return checkRow('cats', c.name, c.name, cCat[c.name] || 0, state.cats.indexOf(c.name) >= 0);
      }).join('') + '</div>',
      first ? true : openSet.cats !== false, state.cats.length);

    var forms = formOptions();
    if (forms.length > 1) {
      html += fgroup('Product type', 'forms',
        '<div class="ffm-fbody-scroll">' + forms.map(function (f) {
          return checkRow('forms', f, f, cForm[f] || 0, state.forms.indexOf(f) >= 0);
        }).join('') + '</div>',
        first ? true : !!openSet.forms, state.forms.length);
    }

    html += fgroup('Availability', 'avail',
      AVAIL.map(function (a) {
        return checkRow('avail', a, a, cAvail[a] || 0, state.avail.indexOf(a) >= 0);
      }).join(''),
      first ? true : openSet.avail !== false, state.avail.length);

    html += fgroup(IS_AUTHED ? 'Trade price' : 'Price (MRP)', 'price', priceBodyHTML(),
      first ? true : openSet.price !== false,
      (state.min > PRICE_FLOOR || state.max < PRICE_CEIL) ? 1 : 0);

    var packs = packOptions();
    if (packs.length > 1) {
      html += fgroup('Pack size', 'packs',
        '<div class="ffm-fbody-scroll">' + packs.map(function (k) {
          return checkRow('packs', k, packLabels[k], cPack[k] || 0, state.packs.indexOf(k) >= 0);
        }).join('') + '</div>',
        !!openSet.packs, state.packs.length);
    }

    host.innerHTML = html;
    wirePriceControls();
  }

  function priceBodyHTML() {
    return '<div class="ffm-price-inputs">' +
      '<div class="ffm-price-field"><span>₹</span>' +
        '<input type="number" id="ffm-min" min="' + PRICE_FLOOR + '" max="' + PRICE_CEIL + '" value="' + state.min + '" aria-label="Minimum price"></div>' +
      '<span class="ffm-price-dash">—</span>' +
      '<div class="ffm-price-field"><span>₹</span>' +
        '<input type="number" id="ffm-max" min="' + PRICE_FLOOR + '" max="' + PRICE_CEIL + '" value="' + state.max + '" aria-label="Maximum price"></div>' +
    '</div>' +
    '<div class="ffm-range">' +
      '<span class="ffm-range-track"></span>' +
      '<span class="ffm-range-fill" id="ffm-range-fill"></span>' +
      '<input type="range" id="ffm-lo" min="' + PRICE_FLOOR + '" max="' + PRICE_CEIL + '" value="' + state.min + '" aria-label="Minimum price slider">' +
      '<input type="range" id="ffm-hi" min="' + PRICE_FLOOR + '" max="' + PRICE_CEIL + '" value="' + state.max + '" aria-label="Maximum price slider">' +
    '</div>' +
    '<div class="ffm-range-out"><span id="ffm-out-lo">' + money(state.min) + '</span>' +
      '<span id="ffm-out-hi">' + money(state.max) + '</span></div>';
  }

  function wirePriceControls() {
    var lo = $('ffm-lo'), hi = $('ffm-hi'), mn = $('ffm-min'), mx = $('ffm-max');
    if (!lo || !hi) return;

    function paint() {
      var span = (PRICE_CEIL - PRICE_FLOOR) || 1;
      var a = ((Number(lo.value) - PRICE_FLOOR) / span) * 100;
      var b = ((Number(hi.value) - PRICE_FLOOR) / span) * 100;
      var fill = $('ffm-range-fill');
      if (fill) { fill.style.left = a + '%'; fill.style.width = Math.max(0, b - a) + '%'; }
      $('ffm-out-lo').textContent = money(lo.value);
      $('ffm-out-hi').textContent = money(hi.value);
    }
    paint();

    function commit() {
      var a = Number(lo.value), b = Number(hi.value);
      if (a > b) { var t = a; a = b; b = t; }
      state.min = a; state.max = b;
      mn.value = a; mx.value = b;
      paint();
      apply({ keepFilters: true });
    }
    lo.addEventListener('input', function () {
      if (Number(lo.value) > Number(hi.value)) lo.value = hi.value;
      paint();
    });
    hi.addEventListener('input', function () {
      if (Number(hi.value) < Number(lo.value)) hi.value = lo.value;
      paint();
    });
    lo.addEventListener('change', commit);
    hi.addEventListener('change', commit);

    mn.addEventListener('change', function () {
      var v = Math.max(PRICE_FLOOR, Math.min(Number(mn.value) || PRICE_FLOOR, Number(mx.value)));
      mn.value = v; lo.value = v; commit();
    });
    mx.addEventListener('change', function () {
      var v = Math.min(PRICE_CEIL, Math.max(Number(mx.value) || PRICE_CEIL, Number(mn.value)));
      mx.value = v; hi.value = v; commit();
    });
  }

  function syncFilterInputs() { renderFilters(); }

  /* ==================================================================
     12 · FILTER + SORT PIPELINE
     ================================================================== */
  /** `except` names a facet to ignore, so facet counts stay self-consistent. */
  function filterList(list, except) {
    var terms = state.q ? state.q.split(/\s+/).filter(Boolean) : [];

    return list.filter(function (p) {
      if (terms.length) {
        var hay = haystack(p);
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i]) < 0) return false;
        }
      }
      if (except !== 'cats'  && state.cats.length  && state.cats.indexOf(p.category) < 0) return false;
      if (except !== 'forms' && state.forms.length && state.forms.indexOf(real(p.dosageForm)) < 0) return false;
      if (except !== 'packs' && state.packs.length && state.packs.indexOf(packKey(p)) < 0) return false;
      if (except !== 'avail' && state.avail.length && state.avail.indexOf(p.stockStatus) < 0) return false;
      if (except !== 'price') {
        var v = priceOf(p);
        if (v < state.min || v > state.max) return false;
      }
      return true;
    });
  }

  function sortList(list) {
    var out = list.slice();
    switch (state.sort) {
      case 'name-desc':  out.sort(function (a, b) { return b.name.localeCompare(a.name); }); break;
      case 'price-asc':  out.sort(function (a, b) { return priceOf(a) - priceOf(b); }); break;
      case 'price-desc': out.sort(function (a, b) { return priceOf(b) - priceOf(a); }); break;
      case 'stock':      out.sort(function (a, b) { return (b.stock || 0) - (a.stock || 0); }); break;
      case 'recent':
        // createdAt is the only genuine recency signal in the catalogue.
        out.sort(function (a, b) {
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        break;
      default:           out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }
    return out;
  }

  /* ==================================================================
     13 · RENDER
     ================================================================== */
  function apply(opts) {
    opts = opts || {};
    var list = sortList(filterList(ALL));
    renderResults(list);
    renderChips();
    if (!opts.keepFilters) renderFilters();
    updateFilterCount();
    writeURL();
  }

  function renderResults(list) {
    var countEl = $('ffm-result-count');
    var applyCount = $('ffm-apply-count');
    if (applyCount) applyCount.textContent = list.length;

    if (!list.length) {
      countEl.innerHTML = '<b>0</b> products found';
      grid.innerHTML = stateBlock({
        art: ART_SEARCH,
        title: 'No products match your filters',
        body: state.q
          ? 'Nothing in the catalogue matches <b>' + esc(state.q) + '</b> with the filters you have applied.'
          : 'No products match the combination of filters you have applied.',
        actions: '<button type="button" class="ffm-btn ffm-btn-primary" data-act="clear">Clear filters</button>' +
                 '<button type="button" class="ffm-btn ffm-btn-ghost" data-act="browse-all">Browse all ' + ALL.length + ' products</button>',
        hint: 'Tip: you can search by salt or composition — try <b>paracetamol</b>, <b>calcium</b> or a catalogue code.'
      });
      $('ffm-loadmore').innerHTML = '';
      return;
    }

    countEl.innerHTML = 'Showing <b>' + list.length + '</b> of ' + ALL.length + ' products';
    pageList = list;
    shown = 0;
    grid.innerHTML = '';
    appendPage();
  }

  function appendPage() {
    var slice = pageList.slice(shown, shown + PAGE);
    var start = shown;
    shown += slice.length;

    grid.insertAdjacentHTML('beforeend', slice.map(cardHTML).join(''));

    // Stagger only the cards just added, relative to their own batch —
    // otherwise page 4 would animate in with a one-second delay.
    var cards = grid.querySelectorAll('.ffm-card');
    for (var i = start; i < cards.length; i++) {
      cards[i].style.animationDelay = Math.min((i - start) * 28, 280) + 'ms';
    }
    renderLoadMore();
  }

  function renderLoadMore() {
    var host = $('ffm-loadmore');
    var left = pageList.length - shown;
    if (left <= 0) {
      host.innerHTML = pageList.length > PAGE
        ? '<p class="ffm-loadmore-meta">All ' + pageList.length + ' products shown</p>' : '';
      return;
    }
    host.innerHTML =
      '<button type="button" class="ffm-btn ffm-btn-ghost ffm-btn-lg" data-act="more">Load ' +
        Math.min(PAGE, left) + ' more products</button>' +
      '<p class="ffm-loadmore-meta">' + shown + ' of ' + pageList.length + ' shown</p>';
  }

  /* ==================================================================
     14 · ACTIVE FILTER CHIPS
     ================================================================== */
  function renderChips() {
    var box = $('ffm-chips');
    var chips = [];

    if (state.q) chips.push({ label: '“' + state.q + '”', kind: 'q' });
    state.cats.forEach(function (v)  { chips.push({ label: v, kind: 'cats',  value: v }); });
    state.forms.forEach(function (v) { chips.push({ label: v, kind: 'forms', value: v }); });
    state.packs.forEach(function (v) { chips.push({ label: 'Pack ' + (packLabels[v] || v), kind: 'packs', value: v }); });
    state.avail.forEach(function (v) { chips.push({ label: v, kind: 'avail', value: v }); });
    if (state.min > PRICE_FLOOR || state.max < PRICE_CEIL) {
      chips.push({ label: money(state.min) + ' – ' + money(state.max), kind: 'price' });
    }

    if (!chips.length) { box.innerHTML = ''; return; }
    box.innerHTML = chips.map(function (c) {
      return '<span class="ffm-chip"><span>' + esc(c.label) + '</span>' +
        '<button type="button" data-chip="' + c.kind + '" data-val="' + esc(c.value || '') + '"' +
        ' aria-label="Remove filter ' + esc(c.label) + '">' + I.x + '</button></span>';
    }).join('') +
    (chips.length > 1 ? '<button type="button" class="ffm-chip-clear" data-act="clear">Clear all</button>' : '');
  }

  function updateFilterCount() {
    var n = state.cats.length + state.forms.length + state.packs.length + state.avail.length +
            ((state.min > PRICE_FLOOR || state.max < PRICE_CEIL) ? 1 : 0);
    var el = $('ffm-filters-count');
    el.textContent = n;
    el.hidden = n === 0;
  }

  function clearAll() {
    state.q = '';
    state.cats = []; state.forms = []; state.packs = []; state.avail = [];
    state.min = PRICE_FLOOR; state.max = PRICE_CEIL;
    $('ffm-search-input').value = '';
    $('ffm-search-clear').hidden = true;
    apply();
  }

  /* ==================================================================
     15 · URL STATE — filtered views are shareable and survive reload
     ================================================================== */
  function writeURL() {
    var q = new URLSearchParams();
    if (state.q) q.set('search', state.q);
    if (state.cats.length)  q.set('category', state.cats.join(','));
    if (state.forms.length) q.set('type', state.forms.join(','));
    if (state.avail.length) q.set('stock', state.avail.join(','));
    if (state.sort !== 'name') q.set('sort', state.sort);
    var s = q.toString();
    history.replaceState(null, '', s ? '?' + s + '#catalogue' : window.location.pathname);
  }

  function readURL() {
    var q = new URLSearchParams(window.location.search);

    var search = q.get('search');
    if (search) {
      state.q = search.trim().toLowerCase();
      $('ffm-search-input').value = search;
      $('ffm-search-clear').hidden = false;
    }
    // Matched case-insensitively against the real category names, so a link
    // like ?category=syrups from the homepage still resolves.
    var cat = q.get('category');
    if (cat) {
      var want = cat.split(',').map(function (s) { return s.trim().toLowerCase(); });
      state.cats = CATS.map(function (c) { return c.name; })
        .filter(function (n) { return want.indexOf(n.toLowerCase()) >= 0; });
    }
    var type = q.get('type');
    if (type) {
      var forms = formOptions();
      var wantF = type.split(',').map(function (s) { return s.trim().toLowerCase(); });
      state.forms = forms.filter(function (f) { return wantF.indexOf(f.toLowerCase()) >= 0; });
    }
    var stock = q.get('stock');
    if (stock) {
      var wantS = stock.split(',').map(function (s) { return s.trim().toLowerCase(); });
      state.avail = AVAIL.filter(function (a) { return wantS.indexOf(a.toLowerCase()) >= 0; });
    }
    var sort = q.get('sort');
    if (sort && $('ffm-sort').querySelector('option[value="' + sort + '"]')) {
      state.sort = sort;
      $('ffm-sort').value = sort;
    }
  }

  /* ==================================================================
     16 · SMART SEARCH + AUTOCOMPLETE
     ------------------------------------------------------------------
     Built entirely from the catalogue already in memory: no extra request,
     no spinner, and it works offline once the page has loaded. (The server's
     /search/auto-suggest endpoint returns nothing for real queries.)
     ================================================================== */
  var sugBox = $('ffm-suggest'), sugItems = [], sugIndex = -1;

  function highlight(text, q) {
    var i = text.toLowerCase().indexOf(q);
    if (i < 0 || !q) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  function buildSuggestions(q) {
    var out = [];

    // 1 · Categories whose name contains the query.
    CATS.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; })
      .slice(0, 2)
      .forEach(function (c) {
        out.push({ group: 'Category', type: 'cat', label: c.name,
                   meta: c.count + ' products', icon: I.layers });
      });

    // 2 · Distinct salts / compositions that match.
    var salts = {}, saltCount = {};
    ALL.forEach(function (p) {
      (Array.isArray(p.composition) ? p.composition : []).forEach(function (s) {
        var clean = String(s || '').trim();
        if (!clean) return;
        // Strip the strength so "Paracetamol 325mg" and "Paracetamol 500mg"
        // collapse into one suggestion.
        var base = clean.replace(/\s*\d+(\.\d+)?\s*(mg|mcg|g|gm|ml|iu|i\.u\.|%|w\/w|w\/v)?\b.*$/i, '').trim();
        if (base.length < 3 || base.toLowerCase().indexOf(q) < 0) return;
        var k = base.toLowerCase();
        salts[k] = base;
        saltCount[k] = (saltCount[k] || 0) + 1;
      });
    });
    Object.keys(salts)
      .sort(function (a, b) { return saltCount[b] - saltCount[a]; })
      .slice(0, 3)
      .forEach(function (k) {
        out.push({ group: 'Composition', type: 'salt', label: salts[k],
                   meta: saltCount[k] + ' products contain this salt', icon: I.flask });
      });

    // 3 · Products. Name matches rank above composition/code matches.
    var scored = [];
    ALL.forEach(function (p) {
      var n = p.name.toLowerCase();
      var score = -1;
      if (n.indexOf(q) === 0)          score = 0;
      else if (n.indexOf(q) > 0)       score = 1;
      else if (p.code && p.code.toLowerCase().indexOf(q) >= 0) score = 2;
      else if (haystack(p).indexOf(q) >= 0) score = 3;
      if (score >= 0) scored.push({ p: p, score: score });
    });
    scored.sort(function (a, b) { return a.score - b.score || a.p.name.localeCompare(b.p.name); });
    scored.slice(0, 6).forEach(function (s) {
      var bits = [s.p.category];
      if (real(s.p.packSize)) bits.push(s.p.packSize);
      if (s.p.code) bits.push('Code ' + s.p.code);
      out.push({ group: 'Products', type: 'product', id: s.p.id, label: s.p.name,
                 meta: bits.join(' · '), image: s.p.image, cat: s.p.category });
    });

    return { items: out, total: scored.length };
  }

  function renderSuggestions(q) {
    if (!q || q.length < 2) { closeSuggest(); return; }
    var res = buildSuggestions(q);
    sugItems = res.items;

    if (!sugItems.length) {
      sugBox.innerHTML = '<p class="ffm-sug-empty">No match for “' + esc(q) + '”.<br>Try a brand, salt or catalogue code.</p>';
      openSuggest();
      return;
    }

    var html = '', lastGroup = '';
    sugItems.forEach(function (s, i) {
      if (s.group !== lastGroup) {
        html += '<div class="ffm-sug-group">' + esc(s.group) + '</div>';
        lastGroup = s.group;
      }
      var thumb = s.type === 'product' && s.image
        ? '<span class="ffm-sug-thumb"><img src="' + esc(s.image) + '" alt="" loading="lazy" ' +
          'data-cat="' + esc(s.cat || '') + '" data-fallback-class="ffm-sug-thumb" onerror="productImgFallback(this)"></span>'
        : '<span class="ffm-sug-ico">' + (s.icon || I.search) + '</span>';
      html += '<button type="button" class="ffm-sug" role="option" aria-selected="false" data-sug="' + i + '">' +
        thumb +
        '<span class="ffm-sug-txt">' +
          '<span class="ffm-sug-title">' + highlight(s.label, q) + '</span>' +
          '<span class="ffm-sug-meta">' + esc(s.meta) + '</span>' +
        '</span></button>';
    });
    if (res.total > 6) {
      html += '<button type="button" class="ffm-sug" role="option" aria-selected="false" data-sug="all">' +
        '<span class="ffm-sug-ico">' + I.search + '</span>' +
        '<span class="ffm-sug-txt"><span class="ffm-sug-title">See all ' + res.total + ' results for “' + esc(q) + '”</span></span>' +
      '</button>';
    }

    sugBox.innerHTML = html;
    sugIndex = -1;
    openSuggest();
  }

  function openSuggest() {
    sugBox.hidden = false;
    $('ffm-search-input').setAttribute('aria-expanded', 'true');
  }
  function closeSuggest() {
    sugBox.hidden = true;
    sugIndex = -1;
    $('ffm-search-input').setAttribute('aria-expanded', 'false');
  }
  function moveSuggest(dir) {
    var btns = sugBox.querySelectorAll('.ffm-sug');
    if (!btns.length) return;
    if (sugIndex >= 0) {
      btns[sugIndex].classList.remove('is-active');
      btns[sugIndex].setAttribute('aria-selected', 'false');
    }
    sugIndex = (sugIndex + dir + btns.length) % btns.length;
    btns[sugIndex].classList.add('is-active');
    btns[sugIndex].setAttribute('aria-selected', 'true');
    btns[sugIndex].scrollIntoView({ block: 'nearest' });
  }

  function chooseSuggestion(key) {
    if (key === 'all') { commitSearch($('ffm-search-input').value); closeSuggest(); return; }
    var s = sugItems[Number(key)];
    if (!s) return;
    closeSuggest();
    if (s.type === 'product') { goToDetail(s.id); return; }
    if (s.type === 'cat') {
      state.cats = [s.label];
      state.q = '';
      $('ffm-search-input').value = '';
      $('ffm-search-clear').hidden = true;
      apply();
      scrollToCatalogue();
      return;
    }
    // Composition: search on the salt name.
    $('ffm-search-input').value = s.label;
    commitSearch(s.label);
  }

  function commitSearch(value) {
    state.q = String(value || '').trim().toLowerCase();
    $('ffm-search-clear').hidden = !state.q;
    apply();
    scrollToCatalogue();
  }

  /* ==================================================================
     17 · RECENTLY VIEWED / BUY AGAIN / TOP SELLING RAILS
     ================================================================== */
  function railCard(p) {
    var comp = compositionOf(p);
    var sc = stockClass(p);
    return '<article class="ffm-card" data-id="' + esc(p.id) + '">' +
      '<div class="ffm-card-media">' +
        '<a class="ffm-card-imglink" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '" tabindex="-1" aria-hidden="true">' +
          mediaHTML(p) + '</a>' +
      '</div>' +
      '<div class="ffm-card-body">' +
        '<div class="ffm-card-top">' +
          '<span class="ffm-cat">' + esc(p.category) + '</span>' +
          '<span class="ffm-stock ffm-stock--' + sc + '"><i></i>' + esc(p.stockStatus) + '</span>' +
        '</div>' +
        '<h3 class="ffm-card-name"><a href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">' + esc(p.name) + '</a></h3>' +
        (comp ? '<p class="ffm-card-comp" title="' + esc(comp) + '">' + esc(comp) + '</p>' : '') +
        (real(p.packSize) ? '<dl class="ffm-card-specs"><div class="ffm-spec"><dt>Pack</dt><dd>' + esc(p.packSize) + '</dd></div></dl>' : '') +
        pricingHTML(p) +
        actionsHTML(p) +
      '</div></article>';
  }

  function fillRail(railId, sectionId, list) {
    var rail = $(railId), section = $(sectionId);
    if (!rail || !section) return;
    if (!list.length) { section.hidden = true; return; }
    rail.innerHTML = list.map(railCard).join('');
    section.hidden = false;
    updateRailButtons(railId);
  }

  /* -- Top selling ------------------------------------------------------
     This is the same curated range Fair Ford already publishes in the home
     page carousel — the business's own merchandising list, resolved here
     against live catalogue records so the price, stock and pack size shown
     are real. It is NOT derived from sales figures: no order-volume data is
     exposed to the storefront, and none is invented here.
     ------------------------------------------------------------------ */
  var CURATED_TOP = [
    'Prega Raj', 'Dermazest 6', 'Mucofair 15 DMR Syrup', 'Aclofair-SP', 'Aclofair-p',
    'Diclofair Pain relief Gel', 'Itoford Plus', 'Valentine Gold', 'Benfozest - CD3 Tablet',
    'EVEC- 400 Capsule', 'Quneed tablet', 'Calcifair - K27 Forte Calpsule soft gel',
    'Tendofair Forte Tablet'
  ];

  function pickCurated() {
    var byKey = {};
    ALL.forEach(function (p) { byKey[nkey(p.name)] = p; });
    var out = [];
    CURATED_TOP.forEach(function (name) {
      var hit = byKey[nkey(name)];
      // Tolerate small catalogue renames by falling back to a prefix match.
      if (!hit) {
        var k = nkey(name).slice(0, 9);
        hit = ALL.filter(function (p) { return nkey(p.name).indexOf(k) === 0; })[0];
      }
      if (hit && out.indexOf(hit) < 0) out.push(hit);
    });
    return out;
  }

  function paintTopSelling() {
    var picks = pickCurated();
    // Only run the section if most of the curated list still resolves —
    // a half-empty rail would misrepresent the range.
    if (picks.length < 6) { $('ffm-topselling-section').hidden = true; return; }
    fillRail('ffm-topselling', 'ffm-topselling-section', picks);
  }

  /* -- Recently viewed -- */
  function pushRecent(id) {
    var list = readJSON(RECENT_KEY, []).filter(function (x) { return x !== id; });
    list.unshift(id);
    writeJSON(RECENT_KEY, list.slice(0, 12));
  }

  function paintRecentlyViewed() {
    var ids = readJSON(RECENT_KEY, []);
    var byId = {};
    ALL.forEach(function (p) { byId[p.id] = p; });
    var list = ids.map(function (id) { return byId[id]; })
                  .filter(Boolean)
                  .slice(0, 6);
    fillRail('ffm-recent', 'ffm-recent-section', list);
  }

  /* -- Buy again — real order history, signed-in retailers only -------- */
  async function paintBuyAgain() {
    if (!IS_AUTHED || !IS_RET) return;
    try {
      var res = await fetch('/api/orders?limit=50', {
        headers: { Authorization: 'Bearer ' + rawToken }
      });
      if (!res.ok) return;                       // not approved yet, or expired token
      var data = await res.json();
      var orders = (data && data.orders) || [];
      if (!orders.length) return;

      var tally = {};
      orders.forEach(function (o) {
        (o.items || []).forEach(function (it) {
          var pid = it.product && (it.product._id || it.product);
          if (!pid) return;
          tally[String(pid)] = (tally[String(pid)] || 0) + (Number(it.quantity) || 1);
        });
      });

      var byId = {};
      ALL.forEach(function (p) { byId[p.id] = p; });
      var list = Object.keys(tally)
        .sort(function (a, b) { return tally[b] - tally[a]; })
        .map(function (id) { return byId[id]; })
        .filter(Boolean)
        .slice(0, 8);

      fillRail('ffm-buyagain', 'ffm-buyagain-section', list);
    } catch (e) {
      // A failed history lookup simply leaves the section hidden — it is an
      // enhancement, never a blocker for browsing.
    }
  }

  function updateRailButtons(railId) {
    var rail = $(railId);
    if (!rail) return;
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-rail="' + railId + '"]'),
      function (btn) {
        var dir = Number(btn.getAttribute('data-dir'));
        var atStart = rail.scrollLeft <= 2;
        var atEnd   = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
        btn.disabled = dir < 0 ? atStart : atEnd;
      }
    );
  }

  /* ==================================================================
     18 · QUICK VIEW
     ================================================================== */
  function byId(id) {
    for (var i = 0; i < ALL.length; i++) if (ALL[i].id === String(id)) return ALL[i];
    return null;
  }

  var lastFocus = null;

  function openModal(el) {
    lastFocus = document.activeElement;
    $('ffm-backdrop').hidden = false;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    var focusable = el.querySelector('button, a, input, select');
    if (focusable) focusable.focus();
  }
  function closeModals() {
    $('ffm-quickview').hidden = true;
    $('ffm-compare').hidden = true;
    $('ffm-backdrop').hidden = true;
    closeSheet();
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function openQuickView(id) {
    var p = byId(id);
    if (!p) return;
    var comp = compositionOf(p);
    var moq  = Math.max(1, Number(p.minimumOrderQuantity || p.moq || 1));
    var sc   = stockClass(p);

    var specs = [];
    if (comp)                 specs.push(['Composition', comp]);
    if (real(p.packSize))     specs.push(['Pack size', p.packSize]);
    if (real(p.dosageForm))   specs.push(['Dosage form', p.dosageForm]);
    if (real(p.strength))     specs.push(['Strength', p.strength]);
    specs.push(['Category', p.category]);
    if (p.code)               specs.push(['Catalogue code', p.code]);
    specs.push(['Minimum order', moq + (moq === 1 ? ' unit' : ' units')]);
    if (real(p.brand))        specs.push(['Marketed by', p.brand]);

    // Descriptions are long-form prose in the catalogue; show the opening
    // paragraph only and send the buyer to the detail page for the rest.
    var intro = String(p.description || '').split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 40; })[0] || '';

    $('ffm-quickview-card').innerHTML =
      '<div class="ffm-qv">' +
        '<button type="button" class="ffm-modal-close" data-act="close" aria-label="Close quick view">' + I.close + '</button>' +
        '<div class="ffm-qv-media">' + mediaHTML(p, 'ffm-qv-img') + '</div>' +
        '<div class="ffm-qv-body">' +
          '<div class="ffm-qv-head">' +
            '<span class="ffm-cat">' + esc(p.category) + '</span>' +
            '<span class="ffm-stock ffm-stock--' + sc + '"><i></i>' + esc(p.stockStatus) + '</span>' +
          '</div>' +
          '<h2 id="ffm-qv-title">' + esc(p.name) + '</h2>' +
          (intro ? '<p class="ffm-qv-desc">' + esc(intro) + '</p>' : '') +
          '<dl class="ffm-qv-specs">' + specs.map(function (s) {
            return '<div class="ffm-qv-spec"><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
          }).join('') + '</dl>' +
          pricingHTML(p) +
          '<div class="ffm-qv-actions">' +
            (IS_AUTHED && p.stockStatus !== 'Out of Stock'
              ? qtyHTML('qv-' + p.id, moq, moq) +
                '<button type="button" class="ffm-btn ffm-btn-primary" data-cart="' + esc(p.id) + '" data-qty-src="qv-' + esc(p.id) + '">' + I.cart + 'Add to cart</button>'
              : IS_AUTHED
                ? '<button type="button" class="ffm-btn" disabled>Out of stock</button>'
                : '<button type="button" class="ffm-btn ffm-btn-primary" data-login="1">' + I.lock + 'Sign in to order</button>') +
            '<a class="ffm-btn ffm-btn-ghost" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">View full details ' + I.arrow + '</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    openModal($('ffm-quickview'));
  }

  /* ==================================================================
     19 · COMPARE
     ================================================================== */
  function toggleCompare(id) {
    var i = compare.indexOf(id);
    if (i >= 0) {
      compare.splice(i, 1);
    } else {
      if (compare.length >= 4) { toast('You can compare up to 4 products'); return; }
      compare.push(id);
    }
    writeJSON(COMPARE_KEY, compare);
    // Repaint just the affected cards rather than the whole grid.
    Array.prototype.forEach.call(document.querySelectorAll('[data-cmp="' + id + '"]'), function (btn) {
      var on = compare.indexOf(id) >= 0;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var card = btn.closest('.ffm-card');
      if (card) card.classList.toggle('is-compared', on);
    });
    renderCompareBar();
  }

  function renderCompareBar() {
    var bar = $('ffm-comparebar');
    // Drop ids that are no longer in the catalogue before painting.
    compare = compare.filter(function (id) { return !!byId(id); });
    if (!compare.length) { bar.hidden = true; return; }

    bar.innerHTML =
      '<span class="ffm-comparebar-txt">' + compare.length + ' selected</span>' +
      '<div class="ffm-comparebar-thumbs">' + compare.map(function (id) {
        var p = byId(id);
        return '<span class="ffm-comparebar-thumb">' +
          (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') +
          '</span>';
      }).join('') + '</div>' +
      '<button type="button" class="ffm-btn ffm-btn-primary" data-act="open-compare"' +
        (compare.length < 2 ? ' disabled' : '') + '>Compare</button>' +
      '<button type="button" class="ffm-comparebar-clear" data-act="clear-compare" aria-label="Clear comparison">' + I.close + '</button>';
    bar.hidden = false;
  }

  function openCompare() {
    if (compare.length < 2) return;
    var items = compare.map(byId).filter(Boolean);

    var rows = [
      ['Category',      function (p) { return p.category; }],
      ['Composition',   function (p) { return compositionOf(p) || '—'; }],
      ['Pack size',     function (p) { return real(p.packSize) || '—'; }],
      ['Dosage form',   function (p) { return real(p.dosageForm) || '—'; }],
      ['Strength',      function (p) { return real(p.strength) || '—'; }],
      ['Minimum order', function (p) {
        var m = Math.max(1, Number(p.minimumOrderQuantity || p.moq || 1));
        return m + (m === 1 ? ' unit' : ' units');
      }],
      ['Availability',  function (p) {
        return '<span class="ffm-stock ffm-stock--' + stockClass(p) + '"><i></i>' + esc(p.stockStatus) + '</span>';
      }, true],
      [IS_AUTHED ? priceLabel() : 'Price (MRP)', function (p) {
        return IS_AUTHED
          ? '<b>' + money(priceOf(p)) + '</b>'
          : '<b>' + money(p.mrp) + '</b><br><span style="font-size:.76rem;color:#667085">Sign in for trade price</span>';
      }, true],
      ['Catalogue code', function (p) { return p.code || '—'; }]
    ];

    $('ffm-compare-card').innerHTML =
      '<div class="ffm-cmp">' +
        '<button type="button" class="ffm-modal-close" data-act="close" aria-label="Close comparison">' + I.close + '</button>' +
        '<h2 id="ffm-cmp-title">Compare products</h2>' +
        '<div class="ffm-cmp-scroll"><table class="ffm-cmp-table">' +
          '<thead><tr><th><span class="ffm-sr">Attribute</span></th>' +
            items.map(function (p) {
              return '<th scope="col"><div class="ffm-cmp-prod">' +
                '<span class="ffm-cmp-thumb">' + mediaHTML(p, 'ffm-cmp-img') + '</span>' +
                '<a class="ffm-cmp-name" href="' + detailHref(p) + '" data-detail="' + esc(p.id) + '">' + esc(p.name) + '</a>' +
                '<button type="button" class="ffm-cmp-drop" data-cmp="' + esc(p.id) + '">Remove</button>' +
              '</div></th>';
            }).join('') +
          '</tr></thead><tbody>' +
            rows.map(function (r) {
              return '<tr><th scope="row">' + esc(r[0]) + '</th>' +
                items.map(function (p) {
                  var v = r[1](p);
                  return '<td>' + (r[2] ? v : esc(v)) + '</td>';
                }).join('') + '</tr>';
            }).join('') +
          '</tbody></table></div>' +
      '</div>';

    openModal($('ffm-compare'));
  }

  /* ==================================================================
     20 · SHARE
     ================================================================== */
  function shareProduct(id) {
    var p = byId(id);
    if (!p) return;
    var url = window.location.origin + '/productdetail.html?id=' + encodeURIComponent(p.id);
    var text = p.name + ' — Fair Ford Pharmaceuticals';

    if (navigator.share) {
      navigator.share({ title: p.name, text: text, url: url })
        .catch(function () { /* the user dismissed the sheet */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(function () { toast('Product link copied'); })
        .catch(function () { window.prompt('Copy this product link:', url); });
      return;
    }
    window.prompt('Copy this product link:', url);
  }

  /* ==================================================================
     21 · MOBILE FILTER SHEET
     ================================================================== */
  /* Slide the sheet by writing inline `transform` each frame. This is the one
     animation path that behaves across engines (a plain inline transform, with
     no CSS transition on the property). If rAF is throttled — e.g. a background
     tab — the final value is committed immediately so the sheet is still
     correctly open/closed; motion is a progressive enhancement, never load
     bearing. Honours reduced-motion by snapping. */
  var _sheetAnim = null;
  function slideSheet(from, to, onDone) {
    var s = $('ffm-filters');
    if (_sheetAnim) cancelAnimationFrame(_sheetAnim);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.requestAnimationFrame) {
      s.style.transform = 'translateY(' + to + '%)';
      if (onDone) onDone();
      return;
    }
    var t0 = null, dur = 260;
    s.style.transform = 'translateY(' + from + '%)';
    function frame(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);              // easeOutCubic
      s.style.transform = 'translateY(' + (from + (to - from) * e) + '%)';
      if (p < 1) { _sheetAnim = requestAnimationFrame(frame); }
      else { _sheetAnim = null; if (onDone) onDone(); }
    }
    _sheetAnim = requestAnimationFrame(frame);
    // Safety net: if rAF never advances (throttled), land the sheet anyway.
    clearTimeout(_sheetHideTimer);
    _sheetHideTimer = setTimeout(function () {
      if (_sheetAnim) { cancelAnimationFrame(_sheetAnim); _sheetAnim = null; }
      s.style.transform = 'translateY(' + to + '%)';
      if (onDone) onDone();
    }, dur + 120);
  }

  var _sheetHideTimer = null;
  function openSheet() {
    var s = $('ffm-filters');
    s.classList.add('is-open');                    // visibility: visible
    $('ffm-backdrop').hidden = false;
    $('ffm-open-filters').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    slideSheet(100, 0);
    var first = s.querySelector('.ffm-sheet-close');
    if (first) first.focus();                      // keyboard / screen-reader entry
  }
  function closeSheet() {
    var s = $('ffm-filters');
    // Slide down, then drop is-open so visibility returns to hidden (kept
    // visible during the slide so the motion is seen). A reopen mid-slide
    // cancels this animation and its callback, so no guard is needed here.
    slideSheet(0, 100, function () { s.classList.remove('is-open'); });
    $('ffm-open-filters').setAttribute('aria-expanded', 'false');
    if ($('ffm-quickview').hidden && $('ffm-compare').hidden) {
      $('ffm-backdrop').hidden = true;
      document.body.style.overflow = '';
    }
  }

  /* ==================================================================
     22 · VIEW TOGGLE
     ================================================================== */
  function applyView(view) {
    state.view = (view === 'list') ? 'list' : 'grid';
    grid.setAttribute('data-view', state.view);
    Array.prototype.forEach.call(document.querySelectorAll('.ffm-viewtoggle button'), function (b) {
      var on = b.getAttribute('data-view') === state.view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    writeJSON(VIEW_KEY, state.view);
  }

  /* ==================================================================
     23 · NAVIGATION
     ================================================================== */
  function goToDetail(id) {
    pushRecent(String(id));
    window.location.href = 'productdetail.html?id=' + encodeURIComponent(id);
  }

  /* ==================================================================
     24 · EVENT WIRING
     ================================================================== */
  function wireStaticUI() {
    // -- search --
    var input = $('ffm-search-input');
    var runSuggest = debounce(function () { renderSuggestions(input.value.trim().toLowerCase()); }, 130);
    var runSearch  = debounce(function () {
      state.q = input.value.trim().toLowerCase();
      $('ffm-search-clear').hidden = !state.q;
      if (ALL.length) apply();
    }, 260);

    input.addEventListener('input', function () { runSuggest(); runSearch(); });
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2) renderSuggestions(input.value.trim().toLowerCase());
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (sugBox.hidden) renderSuggestions(input.value.trim().toLowerCase()); else moveSuggest(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var active = sugBox.querySelector('.ffm-sug.is-active');
        if (!sugBox.hidden && active) chooseSuggestion(active.getAttribute('data-sug'));
        else { closeSuggest(); commitSearch(input.value); }
      } else if (e.key === 'Escape') { closeSuggest(); }
    });
    sugBox.addEventListener('mousedown', function (e) {
      var b = e.target.closest('[data-sug]');
      if (!b) return;
      e.preventDefault();                    // keep focus off the blur handler
      chooseSuggestion(b.getAttribute('data-sug'));
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ffm-search')) closeSuggest();
    });
    $('ffm-search-clear').addEventListener('click', function () {
      input.value = '';
      $('ffm-search-clear').hidden = true;
      closeSuggest();
      state.q = '';
      if (ALL.length) apply();
      input.focus();
    });

    // -- sort + view --
    $('ffm-sort').addEventListener('change', function () {
      state.sort = this.value;
      if (ALL.length) apply({ keepFilters: true });
    });
    document.querySelector('.ffm-viewtoggle').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (b) applyView(b.getAttribute('data-view'));
    });

    // -- filter checkboxes (delegated: the panel re-renders on every change) --
    $('ffm-filters-scroll').addEventListener('change', function (e) {
      var box = e.target.closest('input[data-group]');
      if (!box) return;
      var group = box.getAttribute('data-group');
      var value = box.value;
      var arr = state[group];
      var i = arr.indexOf(value);
      if (box.checked) { if (i < 0) arr.push(value); }
      else if (i >= 0) { arr.splice(i, 1); }
      apply();
    });

    // -- filter sheet --
    $('ffm-open-filters').addEventListener('click', openSheet);
    $('ffm-close-filters').addEventListener('click', closeSheet);
    $('ffm-apply-filters').addEventListener('click', function () { closeSheet(); scrollToCatalogue(); });
    $('ffm-clear-filters').addEventListener('click', function () { clearAll(); toast('Filters cleared'); });
    $('ffm-reset-top').addEventListener('click', function () { clearAll(); });
    $('ffm-backdrop').addEventListener('click', closeModals);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('ffm-quickview').hidden || !$('ffm-compare').hidden) { closeModals(); return; }
      if ($('ffm-filters').classList.contains('is-open')) closeSheet();
    });

    // -- rails --
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rail]');
      if (!b) return;
      var rail = $(b.getAttribute('data-rail'));
      if (!rail) return;
      rail.scrollBy({ left: Number(b.getAttribute('data-dir')) * (rail.clientWidth * 0.8), behavior: 'smooth' });
    });
    ['ffm-topselling', 'ffm-buyagain', 'ffm-recent'].forEach(function (id) {
      var rail = $(id);
      if (rail) rail.addEventListener('scroll', debounce(function () { updateRailButtons(id); }, 90), { passive: true });
    });
    window.addEventListener('resize', debounce(function () {
      ['ffm-topselling', 'ffm-buyagain', 'ffm-recent'].forEach(updateRailButtons);
    }, 150));

    var recentClear = $('ffm-recent-clear');
    if (recentClear) {
      recentClear.addEventListener('click', function () {
        writeJSON(RECENT_KEY, []);
        $('ffm-recent-section').hidden = true;
        toast('Recently viewed cleared');
      });
    }

    // -- sticky toolbar shadow --
    var toolbar = $('ffm-toolbar');
    if (toolbar && 'IntersectionObserver' in window) {
      var sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:absolute;height:1px;width:1px;';
      toolbar.parentNode.insertBefore(sentinel, toolbar);
      new IntersectionObserver(function (entries) {
        toolbar.classList.toggle('is-stuck', !entries[0].isIntersecting);
      }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 }).observe(sentinel);
    }

    // -- one delegated handler for every card action on the page --
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('click', onQtyClick);
  }

  function onDocumentClick(e) {
    var t = e.target;

    var act = t.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'retry')        { location.reload(); return; }
      if (a === 'clear')        { clearAll(); return; }
      if (a === 'browse-all')   { clearAll(); return; }
      if (a === 'more')         { appendPage(); return; }
      if (a === 'close')        { closeModals(); return; }
      if (a === 'open-compare') { openCompare(); return; }
      if (a === 'clear-compare'){ compare = []; writeJSON(COMPARE_KEY, compare); renderCompareBar(); apply({ keepFilters: true }); return; }
    }

    var chip = t.closest('[data-chip]');
    if (chip) {
      var kind = chip.getAttribute('data-chip');
      var val  = chip.getAttribute('data-val');
      if (kind === 'q') { state.q = ''; $('ffm-search-input').value = ''; $('ffm-search-clear').hidden = true; }
      else if (kind === 'price') { state.min = PRICE_FLOOR; state.max = PRICE_CEIL; }
      else {
        var i = state[kind].indexOf(val);
        if (i >= 0) state[kind].splice(i, 1);
      }
      apply();
      return;
    }

    if (t.closest('[data-login]')) { sendToLogin(); return; }

    var wish = t.closest('[data-wish]');
    if (wish) {
      var wid = wish.getAttribute('data-wish');
      var on = store.toggleWish(wid);
      wish.classList.toggle('is-on', on);
      wish.setAttribute('aria-pressed', on ? 'true' : 'false');
      wish.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
      store.syncCounts();
      toast(on ? 'Saved to wishlist' : 'Removed from wishlist');
      return;
    }

    var qv = t.closest('[data-qv]');
    if (qv) { openQuickView(qv.getAttribute('data-qv')); return; }

    var cmp = t.closest('[data-cmp]');
    if (cmp) {
      var cid = cmp.getAttribute('data-cmp');
      toggleCompare(cid);
      if (!$('ffm-compare').hidden) { compare.length >= 2 ? openCompare() : closeModals(); }
      return;
    }

    var sh = t.closest('[data-share]');
    if (sh) { shareProduct(sh.getAttribute('data-share')); return; }

    var cart = t.closest('[data-cart]');
    if (cart && !cart.disabled) {
      var pid = cart.getAttribute('data-cart');
      var qty = 1;
      var src = cart.getAttribute('data-qty-src') || pid;
      var qtyBox = document.querySelector('[data-qty-for="' + CSS.escape(src) + '"] input');
      if (qtyBox) qty = Math.max(1, Number(qtyBox.value) || 1);
      // addToCart returns false for guests — it redirects them to sign in.
      if (store.addToCart(pid, qty) !== false) {
        var prod = byId(pid);
        toast(qty + ' × ' + (prod ? prod.name : 'item') + ' added to cart');
      }
      return;
    }

    // Product links: record the visit for "Recently viewed", then follow.
    var det = t.closest('[data-detail]');
    if (det) { pushRecent(det.getAttribute('data-detail')); return; }
  }

  function onQtyClick(e) {
    var btn = e.target.closest('.ffm-qty [data-step]');
    if (!btn) return;
    var input = btn.parentNode.querySelector('input');
    var min = Number(input.getAttribute('data-min')) || 1;
    var next = (Number(input.value) || min) + Number(btn.getAttribute('data-step'));
    input.value = Math.max(min, next);
  }

  /* ==================================================================
     25 · ENTRY POINT
     ================================================================== */
  paintSkeletons(8);
  wireStaticUI();
  boot();
});
