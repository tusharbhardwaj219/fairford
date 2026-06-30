/* =====================================================================
   search.js — Fair Ford search page
   Real-time auto-suggest dropdown backed by /api/products/search/auto-suggest,
   and a live product grid backed by /api/products. Cart/wishlist actions
   piggy-back on common.js's shared `store` so the count badges in the
   header stay in sync with the rest of the site.
   ===================================================================== */
(function () {
  'use strict';

  var inputEl, suggestEl, clearBtn, gridEl, countEl, emptyEl;
  var ALL_PRODUCTS = [];
  var SUGGEST_TIMER = null;
  var SUGGEST_ABORT = null;
  var ACTIVE_SUGGEST = -1; // index in current dropdown

  var inr = function (n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  };

  function isDistributor() {
    try {
      var u = JSON.parse(localStorage.getItem('ff_user') || '{}');
      return u.role === 'dist';
    } catch (_) { return false; }
  }
  function priceFor(p) {
    // The backend already strips fields based on role, so retailers won't
    // even see distributorPrice. Distributors fall back to MRP when needed.
    if (isDistributor()) return p.distributorPrice || p.mrp || 0;
    return p.retailerPrice || p.mrp || 0;
  }

  /* ─────────────────── PRODUCT GRID ─────────────────── */

  async function loadAllProducts() {
    countEl.textContent = 'Loading products…';
    var products = [];
    try {
      // getAllProducts() (data.js) is async and fetches from /api/products with
      // role-based pricing already applied. Sharing this cache with the rest
      // of the site means we don't pay an extra round-trip.
      if (typeof getAllProducts === 'function') {
        products = await getAllProducts();
      } else {
        var res = await fetch('/api/products?limit=200');
        var data = await res.json();
        products = (data && data.products) || [];
      }
    } catch (e) {
      console.error('[search] product fetch failed', e);
      products = [];
    }
    ALL_PRODUCTS = products;
    renderGrid(products);
  }

  function cardHTML(p) {
    var out = (p.stock || 0) <= 0 || p.stockStatus === 'Out of Stock';
    var img = (p.image && (p.image.url || p.image)) ||
              (p.images && p.images[0] && (p.images[0].url || p.images[0])) || '';
    var initial = (p.name || '?').charAt(0).toUpperCase();
    var thumb = img
      ? '<img src="' + esc(img) + '" alt="" loading="lazy">'
      : '<div class="ff-thumb-fallback">' + esc(initial) + '</div>';
    // Anonymous visitors get prices stripped by the API (B2B gate); show a
    // login prompt instead of a misleading ₹0.
    var price = priceFor(p);
    var priceHtml = price > 0
      ? inr(price)
      : '<span class="ff-card-price-login">Login to view price</span>';

    return '<article class="ff-card" data-id="' + esc(p.id) + '">' +
             '<div class="ff-card-media">' + thumb + '</div>' +
             '<div class="ff-card-body">' +
               '<p class="ff-card-brand">' + esc(p.brand || '') + '</p>' +
               '<h3 class="ff-card-name">' + esc(p.name || '') + '</h3>' +
               '<p class="ff-card-meta">' + esc(p.packSize || '') +
                 (p.strength ? ' · ' + esc(p.strength) : '') + '</p>' +
               '<div class="ff-card-foot">' +
                 '<span class="ff-card-price">' + priceHtml + '</span>' +
                 '<button class="ff-card-add" type="button" data-add="' + esc(p.id) + '"' +
                   (out ? ' disabled style="opacity:.5;cursor:not-allowed"' : '') + '>' +
                   (out ? 'Out of stock' : 'Add to cart') +
                 '</button>' +
               '</div>' +
             '</div>' +
           '</article>';
  }

  function renderGrid(list) {
    countEl.textContent = list.length
      ? list.length + (list.length === 1 ? ' product' : ' products')
      : '0 products';
    if (!list.length) {
      gridEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    gridEl.innerHTML = list.map(cardHTML).join('');
  }

  function filterGrid(keyword) {
    var q = (keyword || '').trim().toLowerCase();
    if (!q) { renderGrid(ALL_PRODUCTS); return; }
    var filtered = ALL_PRODUCTS.filter(function (p) {
      return (p.name && p.name.toLowerCase().indexOf(q) >= 0) ||
             (p.brand && p.brand.toLowerCase().indexOf(q) >= 0) ||
             (p.category && String(p.category).toLowerCase().indexOf(q) >= 0);
    });
    renderGrid(filtered);
  }

  /* ─────────────────── AUTO-SUGGEST DROPDOWN ─────────────────── */

  async function fetchSuggestions(keyword) {
    // Abort any in-flight request so the dropdown reflects the latest keystroke.
    if (SUGGEST_ABORT) { try { SUGGEST_ABORT.abort(); } catch (_) {} }
    SUGGEST_ABORT = new AbortController();
    try {
      var res = await fetch('/api/products/search/auto-suggest?keyword=' + encodeURIComponent(keyword), {
        signal: SUGGEST_ABORT.signal,
      });
      var data = await res.json();
      return (data && data.suggestions) || [];
    } catch (e) {
      if (e.name === 'AbortError') return null;
      console.warn('[search] suggest failed', e);
      return [];
    }
  }

  function renderSuggestions(items, keyword) {
    if (!items || !items.length) {
      // Fallback: derive suggestions from the already-loaded grid so users
      // typing on a flaky network still get help.
      var q = (keyword || '').toLowerCase();
      var seen = {};
      items = [];
      ALL_PRODUCTS.forEach(function (p) {
        if (!q) return;
        if (p.name && p.name.toLowerCase().indexOf(q) >= 0 && !seen[p.name]) {
          items.push({ type: 'product', text: p.name, value: p.name });
          seen[p.name] = true;
        }
        if (items.length < 8 && p.brand && p.brand.toLowerCase().indexOf(q) >= 0 && !seen[p.brand]) {
          items.push({ type: 'brand', text: p.brand, value: p.brand });
          seen[p.brand] = true;
        }
      });
      items = items.slice(0, 8);
    }
    if (!items.length) { suggestEl.hidden = true; suggestEl.innerHTML = ''; return; }
    suggestEl.innerHTML = items.map(function (s, i) {
      var tag = s.type === 'brand' ? 'Brand' : 'Product';
      return '<li role="option" data-i="' + i + '" data-value="' + esc(s.value) + '" tabindex="-1">' +
               '<span class="ff-suggest-tag ff-suggest-tag--' + (s.type || 'product') + '">' + tag + '</span>' +
               '<span class="ff-suggest-text">' + esc(s.text) + '</span>' +
             '</li>';
    }).join('');
    suggestEl.hidden = false;
    ACTIVE_SUGGEST = -1;
  }

  function hideSuggestions() {
    suggestEl.hidden = true;
    suggestEl.innerHTML = '';
    ACTIVE_SUGGEST = -1;
  }

  function moveActiveSuggest(delta) {
    var items = suggestEl.querySelectorAll('li');
    if (!items.length) return;
    ACTIVE_SUGGEST = (ACTIVE_SUGGEST + delta + items.length) % items.length;
    items.forEach(function (li, i) { li.classList.toggle('is-active', i === ACTIVE_SUGGEST); });
    items[ACTIVE_SUGGEST].scrollIntoView({ block: 'nearest' });
  }

  function pickSuggestion(value) {
    inputEl.value = value;
    hideSuggestions();
    filterGrid(value);
    clearBtn.style.display = value ? '' : 'none';
  }

  /* ─────────────────── EVENTS ─────────────────── */

  function onInput() {
    var q = inputEl.value.trim();
    clearBtn.style.display = q ? '' : 'none';
    filterGrid(q);

    clearTimeout(SUGGEST_TIMER);
    if (q.length < 2) { hideSuggestions(); return; }
    SUGGEST_TIMER = setTimeout(async function () {
      var items = await fetchSuggestions(q);
      if (items === null) return; // aborted
      renderSuggestions(items, q);
    }, 180);
  }

  function onKeyDown(e) {
    if (suggestEl.hidden) {
      if (e.key === 'Enter') { e.preventDefault(); filterGrid(inputEl.value); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActiveSuggest(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActiveSuggest(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var items = suggestEl.querySelectorAll('li');
      if (ACTIVE_SUGGEST >= 0 && items[ACTIVE_SUGGEST]) {
        pickSuggestion(items[ACTIVE_SUGGEST].dataset.value);
      } else {
        hideSuggestions();
        filterGrid(inputEl.value);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  }

  function onGridClick(e) {
    var addBtn = e.target.closest('[data-add]');
    if (addBtn && !addBtn.disabled) {
      var id = addBtn.getAttribute('data-add');
      if (typeof store !== 'undefined' && store.addToCart) {
        store.addToCart(id, 1);
        if (typeof toast === 'function') toast('Added to cart');
      }
      return;
    }
    var card = e.target.closest('.ff-card');
    if (card) {
      window.location.href = 'productdetail.html?id=' + encodeURIComponent(card.dataset.id);
    }
  }

  function wireUp() {
    inputEl = document.getElementById('ffSearchInput');
    suggestEl = document.getElementById('ffSuggest');
    clearBtn = document.getElementById('ffSearchClear');
    gridEl = document.getElementById('ffGrid');
    countEl = document.getElementById('ffCount');
    emptyEl = document.getElementById('ffEmpty');

    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKeyDown);
    inputEl.addEventListener('focus', function () {
      if (inputEl.value.trim().length >= 2 && suggestEl.children.length) suggestEl.hidden = false;
    });
    clearBtn.addEventListener('click', function () {
      inputEl.value = '';
      clearBtn.style.display = 'none';
      hideSuggestions();
      renderGrid(ALL_PRODUCTS);
      inputEl.focus();
    });
    suggestEl.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-value]');
      if (li) pickSuggestion(li.dataset.value);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ffSearchWrap')) hideSuggestions();
    });
    gridEl.addEventListener('click', onGridClick);

    // Pre-fill from ?q=… so links from other pages can deep-link a search
    var qParam = new URLSearchParams(window.location.search).get('q');
    if (qParam) {
      inputEl.value = qParam;
      clearBtn.style.display = '';
    }

    loadAllProducts().then(function () {
      if (qParam) filterGrid(qParam);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUp);
  } else {
    wireUp();
  }
})();
