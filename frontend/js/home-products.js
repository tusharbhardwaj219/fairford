/* =====================================================================
   home-products.js — Fair Ford Pharmaceuticals · Home "Top Selling" showcase
   Lazily fetches REAL products from the public /api/products endpoint and
   renders a premium featured + grid layout with live category filters and
   search. Content integrity: only real product data is shown; the only
   badges are "New" (real isNewArrival flag) and an editorial "Featured"
   on the two emphasised cards. No prices, no invented claims. Degrades to
   the static catalogue CTA (always present in the markup) if data can't load.
   ===================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('fhpProducts');
  if (!section) return;

  var grid = document.getElementById('fhpGrid');
  var featured = document.getElementById('fhpFeatured');
  var chipsBox = document.getElementById('fhpChips');
  var searchEl = document.getElementById('fhpSearch');
  var emptyEl = document.getElementById('fhpEmpty');
  var clearBtn = document.getElementById('fhpClear');
  var viewAll = document.getElementById('fhpViewAll');

  var POOL = 200;         // pull the full catalogue so pinned products are present + chip counts are real
  // Products to ALWAYS feature, in this order — matched by name substring
  // (case-insensitive). Matched by NAME, not _id, so it holds across the
  // local and production databases (which use different ids).
  var PINNED = ['dermazest 6', 'pegra raj'];
  var GRID_ALL = 8;       // grid cards shown in the "All" view (+2 featured)
  var GRID_FILTERED = 10; // grid cards shown when a filter/search is active
  var MAX_CHIPS = 7;      // category chips beyond "All"

  var ALL = [];           // quality-filtered products
  var FEATURED = [];      // the 2 emphasised products (excluded from grid in All view)
  var state = { cat: '__all', q: '' };
  var searchTimer;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function imgOf(p) { return (p.image && p.image.url) || (p.images && p.images[0] && p.images[0].url) || ''; }
  function catOf(p) { return p.categoryName || (p.category && p.category.categoryName) || 'Products'; }
  function idOf(p) { return String(p._id || p.id || ''); }
  function href(p) {
    if (p && p.slug) return '/product/' + encodeURIComponent(p.slug);
    return 'productdetail.html?id=' + encodeURIComponent(idOf(p));
  }
  // Real product descriptions can carry a structured "Product introduction"
  // header + newlines. Strip that for the short card teaser only — the data
  // itself is unchanged (the detail page still renders it in full).
  function cleanDesc(s) {
    if (!s) return '';
    return String(s)
      .replace(/^\s*(product\s+introduction|introduction|description|overview)\s*[:\-–—]?\s*/i, '')
      .replace(/\s*\n+\s*/g, ' ')
      .trim();
  }

  /* ---- SVG snippets ---- */
  var ICON = {
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 22V12"/></svg>',
    flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 5.5L19 9l-5.1 1.5L12 16l-1.9-5.5L5 9l5.1-1.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>'
  };

  /* ---- Card templates ---- */
  function media(p, badgeHtml) {
    var url = imgOf(p);
    var inner = url
      ? '<img src="' + esc(url) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'fhp-card__media--ph\');this.parentNode.textContent=' + JSON.stringify((p.name || '?').charAt(0).toUpperCase()) + ';">'
      : esc((p.name || '?').charAt(0).toUpperCase());
    return '<div class="fhp-card__media' + (url ? '' : ' fhp-card__media--ph') + '">' + (badgeHtml || '') + inner + '</div>';
  }
  function tags(p, withComposition) {
    var t = [];
    if (p.packSize) t.push('<span class="fhp-tag">' + ICON.pack + esc(p.packSize) + '</span>');
    if (p.strength) t.push('<span class="fhp-tag">' + ICON.flask + esc(p.strength) + '</span>');
    if (withComposition && p.composition && p.composition.length) {
      t.push('<span class="fhp-tag">' + ICON.flask + esc(p.composition.slice(0, 2).join(' + ')) + '</span>');
    }
    return t.length ? '<div class="fhp-card__meta">' + t.join('') + '</div>' : '<div class="fhp-card__meta"></div>';
  }
  function badge(kind) {
    if (kind === 'featured') return '<span class="fhp-badge fhp-badge--featured">' + ICON.star + 'Featured</span>';
    if (kind === 'new') return '<span class="fhp-badge fhp-badge--new">' + ICON.spark + 'New</span>';
    return '';
  }
  function gridCard(p) {
    var b = p.isNewArrival ? badge('new') : '';
    var dtext = cleanDesc(p.description);
    var desc = dtext ? '<p class="fhp-card__desc">' + esc(dtext) + '</p>' : '';
    return '<a class="fhp-card" href="' + href(p) + '">' +
      media(p, b) +
      '<div class="fhp-card__body">' +
        '<span class="fhp-card__cat">' + ICON.box + esc(catOf(p)) + '</span>' +
        '<h3 class="fhp-card__name">' + esc(p.name) + '</h3>' +
        desc +
        tags(p, false) +
        '<span class="fhp-card__cta">View product ' + ICON.arrow + '</span>' +
      '</div></a>';
  }
  function featuredCard(p) {
    var dtext = cleanDesc(p.description);
    var desc = dtext ? '<p class="fhp-card__desc">' + esc(dtext) + '</p>' : '';
    return '<a class="fhp-card fhp-card--featured" href="' + href(p) + '">' +
      media(p, badge('featured')) +
      '<div class="fhp-card__body">' +
        '<span class="fhp-card__cat">' + ICON.box + esc(catOf(p)) + '</span>' +
        '<h3 class="fhp-card__name">' + esc(p.name) + '</h3>' +
        desc +
        tags(p, true) +
        '<span class="fhp-card__cta">View product ' + ICON.arrow + '</span>' +
      '</div></a>';
  }

  /* ---- Entrance animation (WAAPI — safe in transition-freezing previews) ---- */
  function animateIn(container) {
    var cards = container.querySelectorAll('.fhp-card');
    cards.forEach(function (el, i) {
      if (!el.animate) return;
      el.animate(
        [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: Math.min(i * 55, 400), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
      );
    });
  }

  /* ---- Filtering ---- */
  function matches(p) {
    if (state.cat !== '__all' && catOf(p) !== state.cat) return false;
    if (state.q) {
      var hay = (p.name + ' ' + catOf(p) + ' ' + (p.composition || []).join(' ') + ' ' + (p.description || '')).toLowerCase();
      if (hay.indexOf(state.q) < 0) return false;
    }
    return true;
  }

  function render() {
    var isAll = state.cat === '__all' && !state.q;
    var featuredIds = {};
    FEATURED.forEach(function (p) { featuredIds[idOf(p)] = 1; });

    // Featured only in the unfiltered "All" view
    if (isAll && FEATURED.length) {
      featured.innerHTML = FEATURED.map(featuredCard).join('');
      animateIn(featured);
    } else {
      featured.innerHTML = '';
    }

    var pool = ALL.filter(function (p) { return isAll ? !featuredIds[idOf(p)] : true; }).filter(matches);
    var cap = isAll ? GRID_ALL : GRID_FILTERED;
    var shown = pool.slice(0, cap);

    grid.setAttribute('aria-busy', 'false');
    if (!shown.length && !(isAll && FEATURED.length)) {
      grid.innerHTML = '';
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      grid.innerHTML = shown.map(gridCard).join('');
      animateIn(grid);
    }

    // Deep-link the "View all" CTA to the active category
    if (viewAll) {
      if (state.cat !== '__all') {
        viewAll.href = 'product.html?category=' + encodeURIComponent(state.cat);
        viewAll.querySelector && setViewAllLabel('View all ' + state.cat);
      } else {
        viewAll.href = 'product.html';
        setViewAllLabel('View all products');
      }
    }
  }
  function setViewAllLabel(text) {
    // keep the trailing arrow svg, replace only the leading text node
    var svg = viewAll.querySelector('svg');
    viewAll.textContent = text + ' ';
    if (svg) viewAll.appendChild(svg);
  }

  /* ---- Chips ---- */
  function buildChips() {
    var counts = {};
    ALL.forEach(function (p) { var c = catOf(p); counts[c] = (counts[c] || 0) + 1; });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, MAX_CHIPS);
    var html = '<button class="fhp-chip is-on" type="button" role="tab" aria-selected="true" data-cat="__all">All</button>';
    html += cats.map(function (c) {
      return '<button class="fhp-chip" type="button" role="tab" aria-selected="false" data-cat="' + esc(c) + '">' + esc(c) + ' <small>' + counts[c] + '</small></button>';
    }).join('');
    chipsBox.innerHTML = html;
  }

  chipsBox.addEventListener('click', function (e) {
    var chip = e.target.closest('.fhp-chip'); if (!chip) return;
    state.cat = chip.getAttribute('data-cat');
    chipsBox.querySelectorAll('.fhp-chip').forEach(function (c) {
      var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  });

  searchEl.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var v = this.value.trim().toLowerCase();
    searchTimer = setTimeout(function () { state.q = v; render(); }, 180);
  });

  if (clearBtn) clearBtn.addEventListener('click', function () {
    state.q = ''; state.cat = '__all'; searchEl.value = '';
    chipsBox.querySelectorAll('.fhp-chip').forEach(function (c) {
      var on = c.getAttribute('data-cat') === '__all'; c.classList.toggle('is-on', on); c.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  });

  /* ---- Pick 2 featured products (distinct categories, with image + description) ---- */
  function pickFeatured(list) {
    var good = list.filter(function (p) { return imgOf(p) && (p.description || '').length > 20; });
    var out = [], used = {};
    // 1) Pinned products first, in configured order (matched by name).
    PINNED.forEach(function (needle) {
      if (out.length >= 2) return;
      for (var k = 0; k < good.length; k++) {
        if (!used[idOf(good[k])] && (good[k].name || '').toLowerCase().indexOf(needle) >= 0) {
          out.push(good[k]); used[idOf(good[k])] = 1; break;
        }
      }
    });
    // 2) Top up to two with distinct-category auto-picks if a pin was missing.
    var usedCat = {}; out.forEach(function (p) { usedCat[catOf(p)] = 1; });
    for (var i = 0; i < good.length && out.length < 2; i++) {
      if (!used[idOf(good[i])] && !usedCat[catOf(good[i])]) { out.push(good[i]); used[idOf(good[i])] = 1; usedCat[catOf(good[i])] = 1; }
    }
    for (var j = 0; j < good.length && out.length < 2; j++) {
      if (!used[idOf(good[j])]) { out.push(good[j]); used[idOf(good[j])] = 1; }
    }
    return out;
  }

  /* ---- Fallback when data can't load: keep section useful, not broken ---- */
  function fail() {
    grid.setAttribute('aria-busy', 'false');
    featured.innerHTML = '';
    chipsBox.style.display = 'none';
    if (searchEl) searchEl.closest('.fhp-search').style.display = 'none';
    grid.innerHTML = '<div class="fhp-empty" style="grid-column:1/-1">' +
      '<p>Browse our complete range on the catalogue.</p>' +
      '<a class="fhp-btn fhp-btn--solid" style="color:#fff;background:linear-gradient(135deg,#0F4C81,#1E6FA8)" href="product.html">View all products ' + ICON.arrow + '</a></div>';
  }

  /* ---- Load ---- */
  var loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    fetch('/api/products?limit=' + POOL, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) {
        var list = (j && (j.products || (j.data && j.data.products))) || [];
        ALL = list.filter(function (p) { return imgOf(p) && idOf(p) && (p.status ? p.status === 'active' : true); });
        if (!ALL.length) { fail(); return; }
        FEATURED = pickFeatured(ALL);
        buildChips();
        render();
      })
      .catch(function () { fail(); });
  }

  // Lazy: load as the section approaches the viewport; fall back to immediate.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); load(); } });
    }, { rootMargin: '400px 0px' });
    io.observe(section);
    // safety net in case the observer never fires
    setTimeout(load, 2500);
  } else {
    load();
  }
})();
