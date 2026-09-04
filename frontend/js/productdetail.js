/* =====================================================================
   productdetail.js — Fair Ford Pharmaceuticals
   Premium B2B product-detail experience (.pdx-* markup)
   ---------------------------------------------------------------------
   DATA INTEGRITY — read before adding anything here.
   The single-product endpoint (GET /api/products/:id, optionalAuth)
   returns: name, brand, category{categoryName}, strength, packSize,
   dosageForm, composition[], description (long prose), mrp, stock,
   stockStatus, minimumOrderQuantity, image{url}, images[]{url}, tags
   (incl. "code:XXXX"), gst — and role trade prices ONLY when an approved
   account is signed in (the server strips retailerPrice/distributorPrice
   /gst for guests). It does NOT return reviews/ratings (all 0), MOQ tiers
   (all 1), expiry/benefits/uses/storage (empty on every product) or
   per-product documents/certifications. Nothing here may present those as
   if they exist — absent data yields an honest empty state, never invented
   values, prices, reviews, certifications or medical claims.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ================================================================
     0 · HELPERS
     ================================================================ */
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function real(v) { var s = String(v == null ? '' : v).trim(); return (!s || s === '-') ? '' : s; }

  function toastMsg(m) {
    if (typeof toast === 'function') { toast(m); return; }
    var e = document.createElement('div');
    e.textContent = m;
    e.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:#0F2B47;color:#fff;padding:11px 20px;border-radius:10px;font-size:.88rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    document.body.appendChild(e);
    setTimeout(function () { e.remove(); }, 2600);
  }

  /* ================================================================
     1 · ICONS
     ================================================================ */
  var I = {
    check:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.9 8.9 8.8-8.9a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    cart:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    share:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>',
    copy:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z"/></svg>',
    truck:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    doc:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h3"/></svg>',
    card:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    flask:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3L14 9V3"/><path d="M7.5 15h9"/></svg>',
    thermo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    factory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20V9l-6 4V9l-6 4V4H2z"/><path d="M6 20v-4M10 20v-4M14 20v-4M18 20v-4"/></svg>',
    star:   '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 2l2.9 6.26L21.6 9.27l-4.8 4.68 1.13 6.6L12 17.77 6.07 20.55l1.13-6.6-4.8-4.68 6.7-1.01L12 2z"/></svg>',
    chev:   '<svg class="pdx-acc-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    arrow:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    zoom:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>',
    image:  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    wa:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3A2.8 2.8 0 0 0 6.5 10a5 5 0 0 0 1 2.6 11 11 0 0 0 4.3 3.8c1.6.6 1.9.5 2.2.5s1.4-.6 1.6-1.1.2-1 .1-1.1z"/></svg>',
    mail:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    link:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
  };

  /* ================================================================
     2 · AUTH + PARAMS
     ================================================================ */
  var params      = new URLSearchParams(window.location.search);
  var productId   = params.get('id');
  var productSlug = params.get('slug');
  // Clean URL form: /product/<slug> (served with 200 by server.js). No query
  // string in that case, so read the slug off the path.
  if (!productId && !productSlug) {
    var pathMatch = window.location.pathname.match(/^\/product\/([^\/?#]+)\/?$/);
    if (pathMatch) productSlug = decodeURIComponent(pathMatch[1]);
  }
  var token       = localStorage.getItem('ff_token');
  var userRaw     = localStorage.getItem('ff_user');

  var currentUser = null;
  if (token && userRaw) {
    try { currentUser = JSON.parse(userRaw); }
    catch (e) { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); currentUser = null; }
  }
  var ROLE    = (currentUser && String(currentUser.role || '').toLowerCase()) || '';
  var IS_DIST = ROLE === 'dist';
  var IS_ANON = !currentUser;

  /* ================================================================
     3 · CHROME
     ================================================================ */
  if (typeof renderHeader === 'function') { $('site-header').innerHTML = renderHeader('products'); if (typeof initHeader === 'function') initHeader(); }
  if (typeof renderFooter === 'function') { $('site-footer').innerHTML = renderFooter(); if (typeof initFooter === 'function') initFooter(); }

  if (!productId && !productSlug) {
    showState('notfound');
    return;
  }

  showSkeleton();

  /* ================================================================
     4 · FETCH
     ================================================================ */
  var isMongoId = !!productSlug || /^[0-9a-fA-F]{24}$/.test(productId || '');

  if (!isMongoId) {
    // Legacy demo id → static catalogue via data.js.
    if (typeof getProductById !== 'function') { showState('error'); return; }
    Promise.resolve(getProductById(productId)).then(function (sp) {
      if (!sp) { showState('notfound'); return; }
      render(normaliseStatic(sp));
    });
    return;
  }

  var headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  var endpoint = productSlug
    ? API_BASE_URL + '/products/slug/' + encodeURIComponent(productSlug)
    : API_BASE_URL + '/products/' + productId;

  fetch(endpoint, { headers: headers })
    .then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user');
        showState('session'); return null;
      }
      if (res.status === 404) { showState('notfound'); return null; }
      if (res.status === 403) { showState('unavailable'); return null; }
      if (!res.ok) { showState('error'); return null; }
      return res.json();
    })
    .then(function (json) {
      if (!json) return;
      if (!json.success || !json.product) { showState(json && /not found/i.test(json.message || '') ? 'notfound' : 'error'); return; }
      // Inactive / archived products are not for public sale.
      if (json.product.status && json.product.status !== 'active') { showState('unavailable'); return; }
      render(json.product);
    })
    .catch(function () { showState('error'); });

  /* Map a static-catalogue product (data.js shape) to the API-ish shape. */
  function normaliseStatic(sp) {
    return {
      _id: sp.id, name: sp.name, brand: sp.brand, categoryName: sp.category,
      strength: sp.strength, packSize: sp.packSize, dosageForm: sp.dosageForm,
      composition: sp.composition || [], description: sp.description || sp.uses || '',
      mrp: sp.mrp, retailerPrice: sp.retailerPrice, distributorPrice: sp.distributorPrice,
      gst: sp.gst, stock: sp.stock, stockStatus: sp.stockStatus,
      minimumOrderQuantity: sp.moq || 1,
      image: sp.image ? { url: sp.image } : null,
      images: Array.isArray(sp.images) ? sp.images.map(function (u) { return typeof u === 'string' ? { url: u } : u; }) : [],
      tags: sp.code ? ['code:' + sp.code] : []
    };
  }

  /* ================================================================
     5 · DERIVE
     ================================================================ */
  function catNameOf(p) {
    return p.categoryName
      || (p.category && typeof p.category === 'object' ? p.category.categoryName : '')
      || (typeof p.category === 'string' ? p.category : '') || '';
  }
  function galleryImages(p) {
    var out = [];
    (Array.isArray(p.images) ? p.images : []).forEach(function (x) {
      var u = !x ? '' : (typeof x === 'string' ? x : (x.url || ''));
      if (u && out.indexOf(u) < 0) out.push(u);
    });
    var primary = p.image ? (typeof p.image === 'string' ? p.image : (p.image.url || '')) : '';
    if (primary && out.indexOf(primary) < 0) out.unshift(primary);
    // The gallery is capped at 3 images product-wide (matches the admin's 3-slot
    // manager). Legacy products that still carry a 4th image in the DB never
    // surface it here; it is dropped on the next admin save.
    return out.slice(0, 3);
  }
  function compositionArr(p) {
    var c = p.composition;
    if (Array.isArray(c)) return c.filter(Boolean).map(String);
    return c ? [String(c)] : [];
  }
  function compositionText(p) { return compositionArr(p).join(' + '); }
  function productCode(p) {
    var t = (p.tags || []).filter(function (x) { return /^code:/i.test(String(x)); })[0];
    return t ? String(t).slice(5).trim() : '';
  }
  /** "Paracetamol 500mg" → {name:'Paracetamol', strength:'500mg'} */
  function parseSalt(str) {
    var s = String(str || '').trim();
    var m = s.match(/^(.*?)\s*([\d.]+\s*(?:mg|mcg|g|gm|ml|iu|i\.u\.|%|w\/w|w\/v|billion|million|lac|spores?)\b.*)$/i);
    if (m && m[1].trim()) return { name: m[1].trim(), strength: m[2].trim() };
    return { name: s, strength: '' };
  }
  function stockInfo(p) {
    var st = p.stockStatus || (Number(p.stock || 0) === 0 ? 'Out of Stock' : Number(p.stock) <= 50 ? 'Low Stock' : 'In Stock');
    return { label: st, cls: st === 'Out of Stock' ? 'out' : st === 'Low Stock' ? 'low' : 'in', inStock: st !== 'Out of Stock' };
  }

  var CUR = null;   // current product, shared with rails/lightbox/events
  var GAL = [];     // gallery image URLs
  var MOQ = 1;

  /* ================================================================
     6 · RENDER
     ================================================================ */
  function render(p) {
    CUR = p;
    hideSkeleton();

    var cat   = catNameOf(p);
    var code  = productCode(p);
    var si    = stockInfo(p);
    MOQ       = Math.max(1, Number(p.minimumOrderQuantity || p.minOrderQty || 1));
    GAL       = galleryImages(p);

    var mrp   = Number(p.mrp || 0);
    var trade = IS_DIST ? p.distributorPrice : p.retailerPrice;   // undefined for guests
    var price = (!IS_ANON && trade) ? Number(trade) : mrp;
    var save  = (!IS_ANON && mrp > price && mrp > 0) ? Math.round(((mrp - price) / mrp) * 100) : 0;

    applyMeta(p, cat, code);

    var root = $('detail-root');
    root.innerHTML =
      breadcrumb(p, cat) +
      '<div class="pdx-wrap"><section class="pdx-hero">' +
        galleryCol(p, cat, si) +
        infoCol(p, cat, code, si, mrp, price, save) +
      '</section></div>' +
      trustStrip() +
      sectionsHTML(p, cat, code, si) +
      '<div id="pdx-rails"></div>';

    root.hidden = false;

    buildStickyBars(p, si, price, mrp);
    wire(p, si);
    recordRecent(p._id || p.id);
    loadRails(p, cat);

    if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();
    syncWishUI();
  }

  /* ---- breadcrumb ---- */
  function breadcrumb(p, cat) {
    return '<div class="pdx-wrap"><nav class="pdx-bread" aria-label="Breadcrumb">' +
      '<a href="index.html">Home</a><span class="pdx-bread-sep">›</span>' +
      '<a href="product.html">Products</a>' +
      (cat ? '<span class="pdx-bread-sep">›</span><a href="product.html?category=' + encodeURIComponent(cat) + '">' + esc(cat) + '</a>' : '') +
      '<span class="pdx-bread-sep">›</span>' +
      '<span class="pdx-bread-cur">' + esc(p.name || 'Product') + '</span>' +
      '</nav></div>';
  }

  /* ---- gallery ---- */
  function galleryCol(p, cat, si) {
    var badges =
      (si.inStock
        ? '<span class="pdx-badge ' + (si.cls === 'low' ? 'pdx-badge--low' : 'pdx-badge--in') + '">' + I.check + (si.cls === 'low' ? 'Limited stock' : 'In stock') + '</span>'
        : '<span class="pdx-badge pdx-badge--out">Out of stock</span>');

    var mainInner = GAL.length
      ? '<img id="pdx-main-img" src="' + esc(GAL[0]) + '" alt="' + esc(p.name) + '" ' +
        'data-cat="' + esc(cat) + '" data-fallback-class="pdx-gal-ph" onerror="productImgFallback(this)">'
      : '<div class="pdx-gal-ph">' + (typeof productImageSVG === 'function' ? productImageSVG(cat) : I.image) +
        '<span>Product image coming soon</span></div>';

    // Three thumbnail slots. Real images are clickable; the rest are labelled
    // placeholders for photos the team will add via the admin panel.
    var thumbs = '';
    for (var i = 0; i < 3; i++) {
      if (GAL[i]) {
        thumbs += '<button type="button" class="pdx-thumb' + (i === 0 ? ' is-on' : '') + '" data-idx="' + i + '" aria-label="View image ' + (i + 1) + '">' +
          '<span class="pdx-thumb-n">' + (i + 1) + '</span>' +
          '<img src="' + esc(GAL[i]) + '" alt="" loading="lazy" data-cat="' + esc(cat) + '" data-fallback-class="pdx-thumb" onerror="productImgFallback(this)">' +
        '</button>';
      } else {
        thumbs += '<div class="pdx-thumb pdx-thumb-empty" aria-hidden="true" title="Additional view — coming soon">' +
          '<span class="pdx-thumb-n">' + (i + 1) + '</span>' + I.image + '</div>';
      }
    }

    return '<div class="pdx-gal">' +
      '<div class="pdx-gal-stage">' +
        '<div class="pdx-gal-badges">' + badges + '</div>' +
        '<button type="button" class="pdx-gal-main" id="pdx-gal-main" ' + (GAL.length ? '' : 'disabled ') + 'aria-label="Zoom product image">' + mainInner + '</button>' +
        (GAL.length ? '<span class="pdx-gal-zoom">' + I.zoom + ' Click to zoom</span>' : '') +
      '</div>' +
      '<div class="pdx-thumbs" id="pdx-thumbs">' + thumbs + '</div>' +
      '<div class="pdx-gal-acts">' +
        '<button type="button" class="pdx-gal-act" id="pdx-wish" aria-pressed="false">' + I.heart + '<span id="pdx-wish-lbl">Save</span></button>' +
        '<div class="pdx-share-wrap">' +
          '<button type="button" class="pdx-gal-act" id="pdx-share" aria-haspopup="true" aria-expanded="false">' + I.share + 'Share</button>' +
          '<div class="pdx-share-menu" id="pdx-share-menu" hidden>' +
            '<button type="button" class="pdx-share-item" data-share="copy">' + I.link + 'Copy link</button>' +
            '<a class="pdx-share-item" id="pdx-share-wa" target="_blank" rel="noopener">' + I.wa + 'WhatsApp</a>' +
            '<a class="pdx-share-item" id="pdx-share-mail">' + I.mail + 'Email</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- info + purchase ---- */
  function infoCol(p, cat, code, si, mrp, price, save) {
    var comp = compositionText(p);
    var badges = [];
    badges.push('<span class="pdx-badge pdx-badge--verified">' + I.shield + 'Verified product</span>');
    if (cat) badges.push('<span class="pdx-badge pdx-badge--cat">' + esc(cat) + '</span>');
    if (real(p.dosageForm)) badges.push('<span class="pdx-badge pdx-badge--form">' + esc(p.dosageForm) + '</span>');

    var facts = [];
    if (real(p.packSize)) facts.push(['Packing', p.packSize]);
    if (real(p.strength)) facts.push(['Strength', p.strength]);
    if (cat) facts.push(['Category', cat]);
    if (real(p.dosageForm)) facts.push(['Form', p.dosageForm]);

    return '<div class="pdx-info">' +
      '<div class="pdx-badges">' + badges.join('') + '</div>' +
      '<h1 class="pdx-title">' + esc(p.name) + '</h1>' +
      '<div class="pdx-brandrow"><span class="pdx-brand">Marketed by <b>' + esc(p.brand || 'Fair Ford Pharma') + '</b></span></div>' +
      (comp
        ? '<div class="pdx-comp-line"><b>Composition:</b> ' + esc(comp) + '</div>'
        : '<div class="pdx-comp-line pdx-comp-line--none">Composition not listed for this product</div>') +
      (facts.length ? '<div class="pdx-facts">' + facts.map(function (f) {
        return '<dl class="pdx-fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></dl>';
      }).join('') + '</div>' : '') +
      metaRow(p, code) +
      buyPanel(p, si, mrp, price, save) +
      dispatchNote() +
    '</div>';
  }

  function metaRow(p, code) {
    var reviewed = Number(p.reviewCount || 0) > 0 && Number(p.rating || 0) > 0;
    var ratingHTML = reviewed
      ? '<span class="pdx-rate"><span class="pdx-rate-stars">' + starGlyphs(Number(p.rating)) + '</span> <b>' + Number(p.rating).toFixed(1) + '</b> · ' + p.reviewCount + ' review' + (p.reviewCount === 1 ? '' : 's') + '</span>'
      : '<span class="pdx-rate"><span class="pdx-rate-stars">☆☆☆☆☆</span> <span class="pdx-rate-none">No reviews yet</span></span>';
    return '<div class="pdx-metarow">' +
      (code ? '<span class="pdx-sku">SKU <b id="pdx-code">' + esc(code) + '</b>' +
        '<button type="button" class="pdx-copy" id="pdx-copy" data-code="' + esc(code) + '" aria-label="Copy product code">' + I.copy + '</button></span>' : '') +
      ratingHTML +
    '</div>';
  }

  function buyPanel(p, si, mrp, price, save) {
    var priceBlock;
    if (IS_ANON) {
      priceBlock = '<div class="pdx-price-locked">' +
        '<div class="pdx-price-mrp-wrap">' +
          '<div class="pdx-price-mrp-label">MRP</div>' +
          '<div class="pdx-price-mrp-val">' + money(mrp) + '</div>' +
          '<div class="pdx-price-lock-note">' + I.lock + 'Log in to view your trade price</div>' +
        '</div>' +
      '</div>';
    } else {
      priceBlock = '<div class="pdx-price-live">' +
        '<div class="pdx-price-main-wrap">' +
          '<div class="pdx-price-role">' + (IS_DIST ? 'Distributor price' : 'Your trade price') + '</div>' +
          '<div class="pdx-price-main">' + money(price) + '</div>' +
        '</div>' +
        (mrp > price ? '<span class="pdx-price-strike">MRP ' + money(mrp) + '</span>' : '') +
        (save > 0 ? '<span class="pdx-price-save">' + save + '% off MRP</span>' : '') +
      '</div>' +
      '<div class="pdx-price-tax">' + (p.gst != null ? 'Exclusive of <b>' + p.gst + '% GST</b> · ' : '') + 'Cash on delivery &amp; online payment</div>';
    }

    var stockV = si.inStock
      ? '<span class="pdx-meta-v pdx-v-' + si.cls + '"><span class="pdx-stock-dot pdx-stock-dot--' + si.cls + '"></span>' + esc(si.label) + '</span>'
      : '<span class="pdx-meta-v pdx-v-out"><span class="pdx-stock-dot pdx-stock-dot--out"></span>Out of stock</span>';

    var actions;
    if (IS_ANON) {
      actions =
        '<div class="pdx-cta-primary-row">' +
          '<a class="pdx-btn pdx-btn-primary pdx-btn-lg" href="login&signup.html">' + I.lock + 'Log in to order</a>' +
        '</div>' +
        '<div class="pdx-cta-secondary-row">' +
          '<a class="pdx-btn pdx-btn-ghost" href="registration.html">Register your business</a>' +
          '<a class="pdx-btn pdx-btn-ghost" href="' + quoteHref(p) + '">Request wholesale price</a>' +
        '</div>';
    } else if (!si.inStock) {
      actions =
        '<div class="pdx-cta-primary-row">' +
          '<button type="button" class="pdx-btn pdx-btn-lg" disabled>Out of stock</button>' +
        '</div>' +
        '<div class="pdx-cta-secondary-row">' +
          '<button type="button" class="pdx-btn pdx-btn-ghost" id="pdx-wish2">' + I.heart + 'Save to wishlist</button>' +
          '<a class="pdx-btn pdx-btn-ghost" href="' + quoteHref(p) + '">Request bulk quote</a>' +
        '</div>';
    } else {
      actions =
        '<div class="pdx-qtyrow">' +
          '<span class="pdx-qty-label">Quantity</span>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            qtyHTML('pdx-qty', MOQ) +
            (MOQ > 1 ? '<span class="pdx-qty-multiple">Multiples of ' + MOQ + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="pdx-cta-primary-row">' +
          '<button type="button" class="pdx-btn pdx-btn-primary pdx-btn-lg" id="pdx-add">' + I.cart + 'Add to cart</button>' +
          '<a class="pdx-btn pdx-btn-dark pdx-btn-lg" href="' + quoteHref(p) + '">Request bulk quote</a>' +
        '</div>' +
        '<div class="pdx-cta-secondary-row">' +
          '<button type="button" class="pdx-btn pdx-btn-ghost" id="pdx-wish2">' + I.heart + 'Save to wishlist</button>' +
          '<button type="button" class="pdx-btn pdx-btn-ghost" id="pdx-share2">' + I.share + 'Share</button>' +
        '</div>';
    }

    return '<div class="pdx-buy">' +
      '<div class="pdx-buy-price">' + priceBlock + '</div>' +
      '<div class="pdx-buy-meta">' +
        '<div><span class="pdx-meta-k">Min. order</span><span class="pdx-meta-v">' + MOQ + ' unit' + (MOQ > 1 ? 's' : '') + '</span></div>' +
        '<div><span class="pdx-meta-k">Availability</span>' + stockV + '</div>' +
        (Number(p.stock) > 0 ? '<div><span class="pdx-meta-k">In stock</span><span class="pdx-meta-v">' + Number(p.stock).toLocaleString('en-IN') + ' units</span></div>' : '') +
      '</div>' +
      '<div class="pdx-buy-actions">' + actions + '</div>' +
      '<div class="pdx-buy-trust">' +
        '<span>' + I.check + 'WHO-GMP certified</span>' +
        '<span>' + I.check + 'GST invoice</span>' +
        '<span>' + I.check + 'Secure B2B ordering</span>' +
        '<span>' + I.check + 'Nearest-stockist dispatch</span>' +
      '</div>' +
    '</div>';
  }

  function qtyHTML(id, moq) {
    return '<div class="pdx-qty" data-qty="' + id + '">' +
      '<button type="button" data-step="-1" aria-label="Decrease quantity">−</button>' +
      '<input type="number" id="' + id + '" value="' + moq + '" min="' + moq + '" step="' + moq + '" inputmode="numeric" aria-label="Quantity">' +
      '<button type="button" data-step="1" aria-label="Increase quantity">+</button>' +
    '</div>';
  }

  function dispatchNote() {
    return '<div class="pdx-dispatch">' + I.truck +
      '<div><b>Routed to your nearest serviceable stockist.</b> Each order is matched by your shop\'s pincode and city, then fulfilled and dispatched from the closest distributor — shorter transit, fewer handovers.</div>' +
    '</div>';
  }

  function quoteHref(p) {
    var q = new URLSearchParams();
    q.set('enquiry', 'bulk-quote');
    q.set('product', p.name || '');
    var code = productCode(p);
    if (code) q.set('code', code);
    return 'contactus.html?' + q.toString();
  }

  /* ---- trust strip ---- */
  function trustStrip() {
    var items = [
      [I.shield, 'WHO-GMP', 'Certified manufacturing'],
      [I.check,  'Verified supply', 'Genuine Fair Ford stock'],
      [I.doc,    'GST invoice', 'Correct rate per item'],
      [I.card,   'Secure ordering', 'COD &amp; online payment'],
      [I.pin,    'Pan-India', 'Nationwide distribution']
    ];
    return '<div class="pdx-wrap"><div class="pdx-trustbar">' + items.map(function (it) {
      return '<div class="pdx-trust-cell">' + it[0] + '<div><b>' + it[1] + '</b><span>' + it[2] + '</span></div></div>';
    }).join('') + '</div></div>';
  }

  /* ---- stacked info sections (accordions on mobile) ---- */
  function accordion(title, bodyHTML, open) {
    return '<details class="pdx-acc"' + (open ? ' open' : '') + '>' +
      '<summary>' + esc(title) + I.chev + '</summary>' +
      '<div class="pdx-acc-body">' + bodyHTML + '</div>' +
    '</details>';
  }

  function sectionsHTML(p, cat, code, si) {
    var blocks = [];

    // Specifications — real fields only.
    var specRows = [
      ['Product name', p.name],
      ['Composition', compositionText(p)],
      ['Category', cat],
      ['Dosage form', real(p.dosageForm)],
      ['Pack size', real(p.packSize)],
      ['Strength', real(p.strength)],
      ['Product code', code],
      ['GST rate', p.gst != null ? p.gst + '%' : ''],
      ['Minimum order', MOQ + (MOQ > 1 ? ' units' : ' unit')],
      ['Availability', si.label]
    ].filter(function (r) { return r[1]; });
    blocks.push(accordion('Product specifications',
      '<div class="pdx-spec-grid">' + specRows.map(function (r) {
        return '<div class="pdx-spec-cell"><dt>' + esc(r[0]) + '</dt><dd>' + esc(String(r[1])) + '</dd></div>';
      }).join('') + '</div>', true));

    // Composition breakdown.
    var salts = compositionArr(p);
    if (salts.length) {
      blocks.push(accordion('Composition',
        '<div class="pdx-comp-grid">' + salts.map(function (s, i) {
          var ps = parseSalt(s);
          return '<div class="pdx-comp-card">' +
            '<span class="pdx-comp-idx">' + (i + 1) + '</span>' +
            '<div class="pdx-comp-body"><div class="pdx-comp-name">' + esc(ps.name) + '</div>' +
            (ps.strength ? '<div class="pdx-comp-strength">' + esc(ps.strength) + '</div>' : '') + '</div>' +
          '</div>';
        }).join('') + '</div>' +
        '<p class="pdx-comp-foot">' + I.flask + 'Active ingredients as declared on the product pack. Dispense per a registered practitioner\'s advice.</p>', true));
    }

    // Description — structured from the catalogue prose.
    if (real(p.description)) {
      blocks.push(accordion('Product description', renderDescription(p.description), true));
    }

    // Storage & handling — general guidance, clearly labelled (no per-product
    // storage data exists on the catalogue).
    blocks.push(accordion('Storage & handling',
      '<div class="pdx-mini-grid">' +
        miniCard(I.thermo, 'Temperature', 'Store below 25°C') +
        miniCard(I.flask, 'Environment', 'Cool, dry place') +
        miniCard(I.shield, 'Access', 'Keep away from children') +
      '</div>' +
      '<div class="pdx-note">' + warnIco() + '<div>General guidance only — always follow the storage instructions printed on the product pack and the enclosed insert. Improper storage can affect potency and safety.</div></div>', false));

    // Manufacturer & quality.
    blocks.push(accordion('Manufacturer & quality',
      '<div class="pdx-mfr">' +
        '<div class="pdx-mfr-card"><div class="pdx-mini-ico">' + I.factory + '</div><h4 class="pdx-mfr-h">Marketed by</h4><p class="pdx-mfr-p">' + esc(p.brand || 'Fair Ford Pharma') + '</p></div>' +
        '<div class="pdx-mfr-card"><div class="pdx-mini-ico">' + I.shield + '</div><h4 class="pdx-mfr-h">Quality standard</h4><p class="pdx-mfr-p">Manufactured under WHO-GMP certified standards with multi-stage quality control before dispatch.</p></div>' +
        '<div class="pdx-mfr-card"><div class="pdx-mini-ico">' + I.doc + '</div><h4 class="pdx-mfr-h">Compliance</h4><p class="pdx-mfr-p">GST-compliant invoicing with HSN details on every order.</p></div>' +
      '</div>', false));

    // Documentation — no per-product COA is stored, so offer a real request
    // route instead of empty document boxes.
    blocks.push(accordion('Documents',
      '<div class="pdx-doc">' +
        '<div class="pdx-doc-ico">' + I.doc + '</div>' +
        '<div class="pdx-doc-body"><b>Need a COA or product information sheet?</b><span>Certificates of Analysis and documentation are shared on request for verified B2B buyers.</span></div>' +
        '<a class="pdx-btn pdx-btn-ghost" href="' + esc(quoteHref(p).replace('bulk-quote', 'documentation')) + '">Request documents</a>' +
      '</div>', false));

    // Reviews — no review system exists.
    var reviewed = Number(p.reviewCount || 0) > 0;
    var reviewsBody = reviewed
      ? '<p class="pdx-desc-p">' + Number(p.rating || 0).toFixed(1) + ' out of 5 · ' + p.reviewCount + ' verified review' + (p.reviewCount === 1 ? '' : 's') + '</p>'
      : '<div class="pdx-reviews-empty"><div class="pdx-re-ico">' + I.star + '</div>' +
        '<h3>No reviews yet</h3>' +
        '<p>Verified reviews from Fair Ford\'s B2B buyers will appear here once this product has been ordered and rated.</p></div>';
    blocks.push(accordion('Reviews', reviewsBody, true));

    return '<div class="pdx-wrap"><div class="pdx-info-sections">' + blocks.join('') + '</div></div>';
  }

  function miniCard(ico, k, v) {
    return '<div class="pdx-mini-card"><div class="pdx-mini-ico">' + ico + '</div><div class="pdx-mini-k">' + esc(k) + '</div><div class="pdx-mini-v">' + esc(v) + '</div></div>';
  }
  function warnIco() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
  }

  /* Structured catalogue description → intro / uses list / directions. */
  function renderDescription(desc) {
    var lines = String(desc).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var structured = lines.some(function (l) { return /^(product introduction|uses of |how to use |directions)/i.test(l); });
    if (!structured) {
      return '<div class="pdx-desc-block">' + lines.map(function (l) { return '<p class="pdx-desc-p">' + esc(l) + '</p>'; }).join('') + '</div>';
    }
    var sections = [], cur = { type: 'intro', title: 'Overview', items: [] };
    function flush() { if (cur.items.length) sections.push(cur); }
    lines.forEach(function (line) {
      if (/^product introduction$/i.test(line)) { flush(); cur = { type: 'intro', title: 'Overview', items: [] }; }
      else if (/^uses of\b/i.test(line)) { flush(); cur = { type: 'uses', title: 'Uses & benefits', items: [] }; }
      else if (/^(how to use|directions for use|how to take|directions)\b/i.test(line)) { flush(); cur = { type: 'howto', title: 'Directions for use', items: [] }; }
      else cur.items.push(line);
    });
    flush();
    return sections.map(function (s) {
      if (s.type === 'uses') {
        return '<div class="pdx-desc-block"><h3 class="pdx-desc-h">' + s.title + '</h3><ul class="pdx-desc-list">' +
          s.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
      }
      return '<div class="pdx-desc-block"><h3 class="pdx-desc-h">' + s.title + '</h3>' +
        s.items.map(function (i) { return '<p class="pdx-desc-p">' + esc(i) + '</p>'; }).join('') + '</div>';
    }).join('');
  }

  function starGlyphs(r) {
    var full = Math.round(r);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  }

  /* ---- per-product <head> metadata ---- */
  function applyMeta(p, cat, code) {
    var name = p.name || 'Product';
    document.title = 'Fair Ford — ' + name;
    var comp = compositionText(p);
    var bits = [real(p.strength), real(p.packSize), real(p.dosageForm), comp].filter(Boolean);
    var desc = (name + (cat ? ' — ' + cat : '') + '. ' + (bits.length ? bits.join(' · ') + '. ' : '') +
      'Available for B2B order from Fair Ford Pharmaceuticals.').slice(0, 300);
    function set(sel, v) { var el = document.querySelector(sel); if (el && v) el.setAttribute('content', v); }
    set('#meta-desc', desc); set('#og-title', name + ' — Fair Ford Pharmaceuticals'); set('#og-desc', desc);
    if (GAL[0]) set('#og-image', GAL[0]);

    // Canonical: prefer the clean /product/<slug> URL (now served with 200 by
    // the backend). Fall back to the ?id= form only for records without a slug
    // (the legacy data.js demo products), which is the only URL they resolve at.
    var url = productCanonicalURL(p);
    var canon = $('canonical-link');
    if (canon && url) canon.setAttribute('href', url);
    set('#og-url', url);

    buildProductJsonLd(p, cat, code, desc, url);
  }

  /* Absolute canonical URL for a product. Clean path when a slug exists. */
  function productCanonicalURL(p) {
    var origin = 'https://www.fairfordpharma.com';
    if (p.slug) return origin + '/product/' + encodeURIComponent(p.slug);
    var pid = p.id || p._id;
    return pid ? origin + '/productdetail.html?id=' + encodeURIComponent(pid) : origin + '/product.html';
  }

  /* Product + BreadcrumbList structured data. Emits only verified, on-page
     facts — no price, offers, availability or aggregateRating (all products
     carry rating 0 / reviewCount 0, and B2B pricing is role-gated, so any of
     those would be fabricated in Google's eyes). */
  function buildProductJsonLd(p, cat, code, desc, url) {
    var el = $('pdx-jsonld');
    if (!el) return;
    var product = {
      '@type': 'Product',
      name: p.name || 'Product',
      description: desc,
      url: url
    };
    if (GAL.length) product.image = GAL.slice(0, 3);
    if (real(p.brand)) product.brand = { '@type': 'Brand', name: p.brand };
    if (code) product.sku = code;
    var comp = compositionText(p);
    if (comp) {
      product.additionalProperty = [{ '@type': 'PropertyValue', name: 'Composition', value: comp }];
    }
    if (cat) product.category = cat;
    product.manufacturer = { '@type': 'Organization', name: 'Fair Ford Pharmaceuticals Pvt. Ltd.' };

    var crumbs = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.fairfordpharma.com/' },
      { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://www.fairfordpharma.com/product.html' }
    ];
    var pos = 3;
    if (cat) {
      crumbs.push({ '@type': 'ListItem', position: pos++, name: cat,
        item: 'https://www.fairfordpharma.com/product.html?category=' + encodeURIComponent(cat) });
    }
    crumbs.push({ '@type': 'ListItem', position: pos, name: p.name || 'Product', item: url });

    var graph = {
      '@context': 'https://schema.org',
      '@graph': [product, { '@type': 'BreadcrumbList', itemListElement: crumbs }]
    };
    try { el.textContent = JSON.stringify(graph); } catch (e) { /* leave empty */ }
  }

  /* ================================================================
     7 · STICKY BARS  (reliable show/hide — no transition dependency)
     ================================================================ */
  function buildStickyBars(p, si, price, mrp) {
    ['pdx-topbar', 'pdx-mbar'].forEach(function (id) { var e = $(id); if (e) e.remove(); });
    // Append the fixed bars INSIDE the .pdx element (not <body>) so the
    // page's --sticky / --card / --line tokens cascade to them. .pdx has no
    // transform/filter, so position:fixed still anchors to the viewport.
    var host = document.querySelector('main.pdx') || document.body;

    var thumb = GAL[0]
      ? '<img src="' + esc(GAL[0]) + '" alt="" data-cat="' + esc(catNameOf(p)) + '" data-fallback-class="pdx-topbar-thumb" onerror="productImgFallback(this)">'
      : (typeof productImageSVG === 'function' ? productImageSVG(catNameOf(p)) : '');
    var shownPrice = IS_ANON ? mrp : price;
    var priceLbl = IS_ANON ? 'MRP' : (IS_DIST ? 'Distributor' : 'Trade price');

    // desktop top bar
    var top = document.createElement('div');
    top.className = 'pdx-topbar'; top.id = 'pdx-topbar';
    top.innerHTML = '<div class="pdx-topbar-inner">' +
      '<div class="pdx-topbar-thumb">' + thumb + '</div>' +
      '<div class="pdx-topbar-info">' +
        '<div class="pdx-topbar-name">' + esc(p.name) + '</div>' +
        '<div class="pdx-topbar-meta">' +
          (real(p.packSize) ? '<span>' + esc(p.packSize) + '</span>' : '') +
          '<span class="pdx-v-' + si.cls + '">' + esc(si.label) + '</span>' +
          '<span><b>' + money(shownPrice) + '</b> ' + priceLbl + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="pdx-topbar-actions">' +
        (IS_ANON
          ? '<a class="pdx-btn pdx-btn-primary" href="login&signup.html">' + I.lock + 'Log in to order</a>'
          : (si.inStock
            ? qtyHTML('pdx-tq', MOQ) + '<button type="button" class="pdx-btn pdx-btn-primary" id="pdx-top-add">' + I.cart + 'Add to cart</button>'
            : '<button type="button" class="pdx-btn" disabled>Out of stock</button>')) +
      '</div>' +
    '</div>';
    host.appendChild(top);

    // mobile bottom bar
    var mbar = document.createElement('div');
    mbar.className = 'pdx-mbar'; mbar.id = 'pdx-mbar';
    mbar.innerHTML =
      '<div class="pdx-mbar-price"><b>' + money(shownPrice) + '</b><span>' + priceLbl + (IS_ANON ? ' · sign in for trade price' : '') + '</span></div>' +
      '<button type="button" class="pdx-mbar-wish" id="pdx-mbar-wish" aria-label="Save to wishlist">' + I.heart + '</button>' +
      (IS_ANON
        ? '<a class="pdx-btn pdx-btn-primary pdx-mbar-cart" href="login&signup.html">' + I.lock + 'Log in</a>'
        : (si.inStock
          ? '<button type="button" class="pdx-btn pdx-btn-primary pdx-mbar-cart" id="pdx-mbar-add">' + I.cart + 'Add to cart</button>'
          : '<button type="button" class="pdx-btn pdx-mbar-cart" disabled>Out of stock</button>'));
    host.appendChild(mbar);
    document.body.classList.add('pdx-mbar-space');
  }

  function toggleBar(el, on, offTransform) {
    if (!el) return;
    if (on) { el.style.transform = 'translateY(0)'; el.classList.add('is-on'); }
    else { el.style.transform = ''; el.classList.remove('is-on'); }   // '' reverts to CSS off-position
  }

  /* ================================================================
     8 · WIRE EVENTS
     ================================================================ */
  function wire(p, si) {
    var pid = p._id || p.id;
    var moq = MOQ;

    // quantity steppers (delegated: main panel, sticky top, lightbox n/a)
    document.addEventListener('click', function (e) {
      var step = e.target.closest('.pdx-qty [data-step]');
      if (!step) return;
      var input = step.parentNode.querySelector('input');
      var min = Number(input.min) || moq;
      var cur = Number(input.value) || min;
      var next = cur + Number(step.getAttribute('data-step')) * moq;
      input.value = Math.max(min, next);
      syncQty(input.value, input.id);
    });
    ['pdx-qty', 'pdx-tq'].forEach(function (id) {
      var input = $(id);
      if (input) input.addEventListener('change', function () {
        var v = Number(input.value) || moq;
        if (v < moq) v = moq;
        // snap to a multiple of MOQ when MOQ enforces multiples
        if (moq > 1) v = Math.max(moq, Math.round(v / moq) * moq);
        input.value = v; syncQty(v, id);
      });
    });

    function currentQty() {
      var m = $('pdx-qty'); var t = $('pdx-tq');
      var v = Number((m && m.value) || (t && t.value) || moq) || moq;
      return Math.max(moq, v);
    }

    function addToCart() {
      if (!si.inStock) return;
      var qty = currentQty();
      if (typeof store !== 'undefined') {
        if (store.addToCart(pid, qty) === false) return;   // guest → redirected to login
        store.syncCounts();
      }
      toastMsg(qty + ' × ' + p.name + ' added to cart');
    }
    ['pdx-add', 'pdx-top-add', 'pdx-mbar-add'].forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', addToCart); });

    // wishlist (gallery button, panel button, mobile bar)
    function toggleWish() {
      if (typeof store === 'undefined') return;
      var on = store.toggleWish(pid);
      store.syncCounts();
      syncWishUI();
      toastMsg(on ? 'Saved to wishlist' : 'Removed from wishlist');
    }
    ['pdx-wish', 'pdx-wish2', 'pdx-mbar-wish'].forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', toggleWish); });

    // copy SKU
    var copyBtn = $('pdx-copy');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var code = copyBtn.getAttribute('data-code');
      copyText(code, function () {
        copyBtn.classList.add('is-done');
        copyBtn.innerHTML = I.check;
        toastMsg('Product code copied');
        setTimeout(function () { copyBtn.classList.remove('is-done'); copyBtn.innerHTML = I.copy; }, 1600);
      });
    });

    // share
    wireShare(p);
    var share2 = $('pdx-share2');
    if (share2) share2.addEventListener('click', function () { nativeOrCopyShare(p); });

    // gallery
    wireGallery(p);

    // sticky bar visibility — show once the hero leaves the viewport, hide
    // again over the footer so it never covers it.
    var hero = document.querySelector('.pdx-hero');
    var footer = $('site-footer');
    var top = $('pdx-topbar'), mbar = $('pdx-mbar');
    var heroGone = false, footerIn = false;
    function sync() {
      var show = heroGone && !footerIn;
      toggleBar(top, show);
      toggleBar(mbar, show);
    }
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting; sync(); }, { threshold: 0 }).observe(hero);
    }
    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { footerIn = en[0].isIntersecting; sync(); }, { threshold: 0 }).observe(footer);
    }
  }

  function syncQty(val, fromId) {
    ['pdx-qty', 'pdx-tq'].forEach(function (id) { if (id !== fromId) { var e = $(id); if (e) e.value = val; } });
  }

  function syncWishUI() {
    if (typeof store === 'undefined' || !CUR) return;
    var pid = CUR._id || CUR.id;
    var on = store.wishlist.indexOf(String(pid)) >= 0;
    ['pdx-wish', 'pdx-wish2', 'pdx-mbar-wish'].forEach(function (id) {
      var b = $(id); if (!b) return;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var lbl = $('pdx-wish-lbl'); if (lbl) lbl.textContent = on ? 'Saved' : 'Save';
    var lbl2 = $('pdx-wish2'); if (lbl2 && lbl2.lastChild) lbl2.lastChild.textContent = on ? 'Saved to wishlist' : 'Save to wishlist';
  }

  /* ---- share ---- */
  function productURL() { return productCanonicalURL(CUR); }

  /* Internal (relative) link to a product's page. Clean path when a slug
     exists, ?id= fallback otherwise. */
  function detailHref(o) {
    if (o && o.slug) return '/product/' + encodeURIComponent(o.slug);
    var id = o && (o.id || o._id);
    return 'productdetail.html?id=' + encodeURIComponent(id || '');
  }
  function copyText(t, ok) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok).catch(function () { window.prompt('Copy:', t); });
    } else { window.prompt('Copy:', t); }
  }
  function nativeOrCopyShare(p) {
    var url = productURL();
    if (navigator.share) { navigator.share({ title: p.name, url: url }).catch(function () {}); return; }
    copyText(url, function () { toastMsg('Product link copied'); });
  }
  function wireShare(p) {
    var btn = $('pdx-share'), menu = $('pdx-share-menu');
    if (!btn || !menu) return;
    var url = productURL();
    var wa = $('pdx-share-wa'); if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(p.name + ' — ' + url);
    var ml = $('pdx-share-mail'); if (ml) ml.href = 'mailto:?subject=' + encodeURIComponent(p.name + ' — Fair Ford Pharmaceuticals') + '&body=' + encodeURIComponent(url);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      var c = e.target.closest('[data-share="copy"]');
      if (c) { copyText(url, function () { toastMsg('Product link copied'); }); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.pdx-share-wrap')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  }

  /* ================================================================
     9 · GALLERY + LIGHTBOX
     ================================================================ */
  function wireGallery(p) {
    var thumbs = $('pdx-thumbs');
    var main = $('pdx-main-img');
    if (thumbs && main) {
      thumbs.addEventListener('click', function (e) {
        var t = e.target.closest('.pdx-thumb[data-idx]');
        if (!t) return;
        var idx = Number(t.getAttribute('data-idx'));
        if (!GAL[idx]) return;
        main.src = GAL[idx];
        thumbs.querySelectorAll('.pdx-thumb').forEach(function (x) { x.classList.toggle('is-on', x === t); });
        lbIndex = idx;
      });
    }
    var stage = $('pdx-gal-main');
    if (stage && GAL.length) stage.addEventListener('click', function () { openLightbox(currentGalIndex()); });
  }

  function currentGalIndex() {
    var on = document.querySelector('#pdx-thumbs .pdx-thumb.is-on');
    return on ? Number(on.getAttribute('data-idx')) || 0 : 0;
  }

  var lbIndex = 0, lbZoom = 1;

  function ensureLightbox() {
    var lb = $('pdx-lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'pdx-lb'; lb.id = 'pdx-lightbox';
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Product image viewer');
    lb.innerHTML =
      '<span class="pdx-lb-count" id="pdx-lb-count"></span>' +
      '<button type="button" class="pdx-lb-close" id="pdx-lb-close" aria-label="Close">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '<button type="button" class="pdx-lb-nav pdx-lb-prev" id="pdx-lb-prev" aria-label="Previous"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="pdx-lb-stage"><img class="pdx-lb-img" id="pdx-lb-img" alt=""></div>' +
      '<button type="button" class="pdx-lb-nav pdx-lb-next" id="pdx-lb-next" aria-label="Next"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="pdx-lb-zoom"><button type="button" id="pdx-lb-zout" aria-label="Zoom out">−</button><button type="button" id="pdx-lb-zin" aria-label="Zoom in">+</button></div>' +
      '<div class="pdx-lb-thumbs" id="pdx-lb-thumbs"></div>';
    document.body.appendChild(lb);

    $('pdx-lb-close').addEventListener('click', closeLightbox);
    $('pdx-lb-prev').addEventListener('click', function () { lbGo(-1); });
    $('pdx-lb-next').addEventListener('click', function () { lbGo(1); });
    $('pdx-lb-zin').addEventListener('click', function () { setZoom(lbZoom + 0.4); });
    $('pdx-lb-zout').addEventListener('click', function () { setZoom(lbZoom - 0.4); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    $('pdx-lb-thumbs').addEventListener('click', function (e) {
      var t = e.target.closest('[data-lb]'); if (!t) return; lbIndex = Number(t.getAttribute('data-lb')); paintLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if ($('pdx-lightbox') && $('pdx-lightbox').classList.contains('is-open')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbGo(-1);
        else if (e.key === 'ArrowRight') lbGo(1);
      }
    });
    return lb;
  }

  function openLightbox(idx) {
    if (!GAL.length) return;
    ensureLightbox();
    lbIndex = idx || 0; lbZoom = 1;
    var thumbs = GAL.map(function (u, i) {
      return '<div class="pdx-lb-thumb" data-lb="' + i + '"><img src="' + esc(u) + '" alt=""></div>';
    }).join('');
    $('pdx-lb-thumbs').innerHTML = thumbs;
    paintLightbox();
    $('pdx-lightbox').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    var lb = $('pdx-lightbox'); if (lb) lb.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function lbGo(d) { lbIndex = (lbIndex + d + GAL.length) % GAL.length; lbZoom = 1; paintLightbox(); }
  function setZoom(z) {
    lbZoom = Math.max(1, Math.min(3, z));
    var img = $('pdx-lb-img'); if (!img) return;
    img.style.transform = 'scale(' + lbZoom + ')';
    img.classList.toggle('is-zoomed', lbZoom > 1);
  }
  function paintLightbox() {
    var img = $('pdx-lb-img'); if (!img) return;
    lbZoom = 1; img.style.transform = ''; img.classList.remove('is-zoomed');
    img.src = GAL[lbIndex];
    $('pdx-lb-count').textContent = (lbIndex + 1) + ' / ' + GAL.length;
    var prev = $('pdx-lb-prev'), next = $('pdx-lb-next');
    if (prev) prev.style.display = GAL.length > 1 ? '' : 'none';
    if (next) next.style.display = GAL.length > 1 ? '' : 'none';
    document.querySelectorAll('#pdx-lb-thumbs [data-lb]').forEach(function (t) {
      t.classList.toggle('is-on', Number(t.getAttribute('data-lb')) === lbIndex);
    });
    // keep the main hero + active thumb in sync
    var main = $('pdx-main-img'); if (main) main.src = GAL[lbIndex];
    document.querySelectorAll('#pdx-thumbs .pdx-thumb[data-idx]').forEach(function (t) {
      t.classList.toggle('is-on', Number(t.getAttribute('data-idx')) === lbIndex);
    });
  }

  /* ================================================================
     10 · RAILS — related / also-like / recently viewed  (ffm cards)
     ================================================================ */
  function recordRecent(id) {
    if (!id) return;
    var list = readJSON('ff_recent', []).filter(function (x) { return x !== String(id); });
    list.unshift(String(id));
    writeJSON('ff_recent', list.slice(0, 12));
  }

  function priceCardHTML(pr) {
    var mrp = Number(pr.mrp || 0);
    var trade = IS_DIST ? pr.distributorPrice : pr.retailerPrice;
    var price = (!IS_ANON && trade) ? Number(trade) : mrp;
    if (IS_ANON) {
      return '<div class="ffm-price"><div class="ffm-price-row"><span class="ffm-price-main">' + money(price).replace('.00', '') + '</span><span class="ffm-price-tag">MRP</span></div>' +
        '<p class="ffm-price-note">Sign in for trade price</p></div>';
    }
    var save = (mrp > price) ? Math.round(((mrp - price) / mrp) * 100) : 0;
    return '<div class="ffm-price"><div class="ffm-price-row"><span class="ffm-price-main">' + money(price).replace('.00', '') + '</span>' +
      (mrp > price ? '<span class="ffm-price-mrp">' + money(mrp).replace('.00', '') + '</span>' : '') +
      (save > 0 ? '<span class="ffm-price-save">' + save + '% off</span>' : '') + '</div></div>';
  }

  function ffmCard(pr) {
    var href = detailHref(pr);
    var comp = Array.isArray(pr.composition) ? pr.composition.filter(Boolean).join(' + ') : (pr.composition || '');
    var si = { cls: pr.stockStatus === 'Out of Stock' ? 'out' : pr.stockStatus === 'Low Stock' ? 'low' : 'in', label: pr.stockStatus || 'In Stock' };
    var media = pr.image
      ? '<img src="' + esc(pr.image) + '" alt="' + esc(pr.name) + '" class="ffm-card-img" loading="lazy" data-cat="' + esc(pr.category) + '" data-fallback-class="ffm-card-svg" onerror="productImgFallback(this)">'
      : '<div class="ffm-card-svg">' + (typeof productImageSVG === 'function' ? productImageSVG(pr.category) : '') + '</div>';
    return '<article class="ffm-card">' +
      '<div class="ffm-card-media"><a class="ffm-card-imglink" href="' + href + '">' + media + '</a></div>' +
      '<div class="ffm-card-body">' +
        '<div class="ffm-card-top"><span class="ffm-cat">' + esc(pr.category) + '</span>' +
          '<span class="ffm-stock ffm-stock--' + si.cls + '"><i></i>' + esc(si.label) + '</span></div>' +
        '<h3 class="ffm-card-name"><a href="' + href + '">' + esc(pr.name) + '</a></h3>' +
        (comp ? '<p class="ffm-card-comp" title="' + esc(comp) + '">' + esc(comp) + '</p>' : '<p class="ffm-card-comp ffm-card-comp--none">Composition not listed</p>') +
        (real(pr.packSize) ? '<dl class="ffm-card-specs"><div class="ffm-spec"><dt>Pack</dt><dd>' + esc(pr.packSize) + '</dd></div></dl>' : '') +
        priceCardHTML(pr) +
        '<div class="ffm-card-actions"><a class="ffm-card-view" href="' + href + '" style="margin-top:4px">View details ' + I.arrow + '</a></div>' +
      '</div></article>';
  }

  function railSection(id, title, sub, items) {
    if (!items.length) return '';
    return '<section class="pdx-section ffm"><div class="pdx-wrap">' +
      '<div class="pdx-rail-head"><div>' +
        '<span class="pdx-eyebrow">' + esc(sub) + '</span>' +
        '<h2>' + esc(title) + '</h2></div>' +
        '<div class="pdx-rail-nav">' +
          '<button type="button" class="pdx-rail-btn" data-rail="' + id + '" data-dir="-1" aria-label="Scroll left"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<button type="button" class="pdx-rail-btn" data-rail="' + id + '" data-dir="1" aria-label="Scroll right"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="ffm-rail" id="' + id + '">' + items.map(ffmCard).join('') + '</div>' +
    '</div></section>';
  }

  function loadRails(p, cat) {
    if (typeof getAllProducts !== 'function') return;
    Promise.resolve(getAllProducts()).then(function (all) {
      if (!Array.isArray(all) || !all.length) return;
      var curId = String(p._id || p.id);
      var mySalts = compositionArr(p).map(function (s) { return parseSalt(s).name.toLowerCase(); }).filter(Boolean);

      var related = all.filter(function (x) { return x.id !== curId && x.category === cat; }).slice(0, 10);

      var relatedIds = {}; related.forEach(function (x) { relatedIds[x.id] = 1; });
      var alsoLike = all.filter(function (x) {
        if (x.id === curId || relatedIds[x.id]) return false;
        var xs = (Array.isArray(x.composition) ? x.composition : []).map(function (s) { return parseSalt(s).name.toLowerCase(); });
        return xs.some(function (s) { return mySalts.indexOf(s) >= 0; });
      }).slice(0, 10);
      if (alsoLike.length < 4) {
        // top up with other in-stock products so the strip is never sparse
        var extra = all.filter(function (x) { return x.id !== curId && !relatedIds[x.id] && alsoLike.indexOf(x) < 0; }).slice(0, 10 - alsoLike.length);
        alsoLike = alsoLike.concat(extra);
      }

      var byId = {}; all.forEach(function (x) { byId[x.id] = x; });
      var recent = readJSON('ff_recent', []).filter(function (id) { return id !== curId; })
        .map(function (id) { return byId[id]; }).filter(Boolean).slice(0, 8);

      $('pdx-rails').innerHTML =
        railSection('pdx-rail-related', 'Related products', 'More in ' + (cat || 'this category'), related) +
        railSection('pdx-rail-also', 'You may also like', 'Similar formulations', alsoLike) +
        railSection('pdx-rail-recent', 'Recently viewed', 'Pick up where you left off', recent);

      wireRails();
    }).catch(function () { /* rails are enhancement only */ });
  }

  function wireRails() {
    document.querySelectorAll('[data-rail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rail = $(btn.getAttribute('data-rail')); if (!rail) return;
        rail.scrollBy({ left: Number(btn.getAttribute('data-dir')) * rail.clientWidth * 0.8, behavior: 'smooth' });
      });
    });
    document.querySelectorAll('.ffm-rail').forEach(function (rail) {
      function upd() {
        document.querySelectorAll('[data-rail="' + rail.id + '"]').forEach(function (b) {
          var dir = Number(b.getAttribute('data-dir'));
          b.disabled = dir < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
        });
      }
      rail.addEventListener('scroll', debounce(upd, 90), { passive: true });
      upd();
    });
  }

  /* ================================================================
     11 · SKELETON + STATES
     ================================================================ */
  function showSkeleton() {
    var sk = $('detail-skeleton');
    if (sk) {
      sk.style.display = '';
      sk.innerHTML =
        '<div class="pdx-wrap"><div class="pdx-skeleton">' +
          '<div class="pdx-sk" style="height:14px;width:280px;margin:20px 0"></div>' +
          '<div class="pdx-sk-hero">' +
            '<div><div class="pdx-sk pdx-sk-gal"></div><div class="pdx-sk-thumbs">' +
              '<div class="pdx-sk pdx-sk-thumb"></div><div class="pdx-sk pdx-sk-thumb"></div><div class="pdx-sk pdx-sk-thumb"></div>' +
            '</div></div>' +
            '<div>' +
              '<div class="pdx-sk" style="height:20px;width:120px"></div>' +
              '<div class="pdx-sk" style="height:34px;width:80%;margin-top:14px"></div>' +
              '<div class="pdx-sk" style="height:46px;width:100%;margin-top:16px;border-radius:12px"></div>' +
              '<div class="pdx-sk" style="height:60px;width:60%;margin-top:16px"></div>' +
              '<div class="pdx-sk" style="height:200px;width:100%;margin-top:18px;border-radius:16px"></div>' +
            '</div>' +
          '</div>' +
        '</div></div>';
    }
    var root = $('detail-root'); if (root) root.hidden = true;
  }
  function hideSkeleton() { var sk = $('detail-skeleton'); if (sk) sk.style.display = 'none'; }

  function showState(kind) {
    hideSkeleton();
    var root = $('detail-root'); if (!root) return;
    var map = {
      error:       { ico: 'err',  glyph: warnIco2(), title: 'Unable to load product', body: 'We could not load this product right now. This is usually a temporary connection problem.',
                     actions: '<button type="button" class="pdx-btn pdx-btn-primary" onclick="location.reload()">Retry</button><a class="pdx-btn pdx-btn-ghost" href="product.html">Browse all products</a>' },
      notfound:    { ico: 'info', glyph: searchGlyph(), title: 'Product not found', body: 'The product you are looking for does not exist or may have been removed from the catalogue.',
                     actions: '<a class="pdx-btn pdx-btn-primary" href="product.html">Browse all products</a><a class="pdx-btn pdx-btn-ghost" href="index.html">Go home</a>' },
      unavailable: { ico: 'warn', glyph: boxGlyph(), title: 'Product temporarily unavailable', body: 'This product is currently unavailable for ordering. Our team can help you find an equivalent or tell you when it returns.',
                     actions: '<a class="pdx-btn pdx-btn-primary" href="contactus.html">Contact sales</a><a class="pdx-btn pdx-btn-ghost" href="product.html">Browse all products</a>' },
      session:     { ico: 'info', glyph: lockGlyph(), title: 'Session expired', body: 'Your session has expired. Please sign in again to see your trade pricing and continue.',
                     actions: '<a class="pdx-btn pdx-btn-primary" href="login&signup.html">Log in again</a><a class="pdx-btn pdx-btn-ghost" href="product.html">Browse products</a>' }
    };
    var s = map[kind] || map.error;
    root.innerHTML = '<div class="pdx-wrap"><div class="pdx-state">' +
      '<div class="pdx-state-ico pdx-state-ico--' + s.ico + '">' + s.glyph + '</div>' +
      '<h2>' + esc(s.title) + '</h2><p>' + esc(s.body) + '</p>' +
      '<div class="pdx-state-actions">' + s.actions + '</div></div></div>';
    root.hidden = false;
    document.body.classList.remove('pdx-mbar-space');
    ['pdx-topbar', 'pdx-mbar'].forEach(function (id) { var e = $(id); if (e) e.remove(); });
  }
  function warnIco2() { return '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'; }
  function searchGlyph() { return '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>'; }
  function boxGlyph() { return '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>'; }
  function lockGlyph() { return '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'; }
});
