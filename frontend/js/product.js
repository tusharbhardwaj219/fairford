/* =====================================================================
   products.js — MediBridge Products Listing Page
   Handles: filter UI build-out, live filtering, sorting, skeleton
   loading state, product card rendering, and navigation to details.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async function () {

    /* ---- Auth guard: redirect to login if not logged in ---- */
    const _rawToken = localStorage.getItem('ff_token');
    const _rawUser  = localStorage.getItem('ff_user');
    if (!_rawToken || !_rawUser) {
        // Clear any partial state before redirecting to avoid loops
        localStorage.removeItem('ff_token');
        localStorage.removeItem('ff_user');
        localStorage.setItem('ff_redirect', 'product.html');
        window.location.replace('login&signup.html');
        return;
    }

    /* ---- Determine user role for pricing ---- */
    let _user = {};
    try { _user = JSON.parse(_rawUser); } catch(e) {}
    const USER_ROLE = (_user.role || 'ret').toLowerCase();
    const IS_DIST = USER_ROLE === 'dist';

    /* price field to show based on role */
    function userPrice(p) {
        return IS_DIST ? p.distributorPrice : p.retailerPrice;
    }

    /* ---- Inject shared chrome ---- */
    document.getElementById('site-header').innerHTML = renderHeader('products');
    document.getElementById('site-footer').innerHTML = renderFooter();
    initHeader();
    initFooter();

    const CATEGORIES = ["Tablets", "Capsules", "Syrups", "Injections", "Ointments"];
    const STOCK_OPTS = ["In Stock", "Low Stock", "Out of Stock"];
    const RATING_OPTS = [{ v: 4, l: "4★ & Above" }, { v: 3, l: "3★ & Above" }, { v: 2, l: "2★ & Above" }];

    // Show inline skeletons up front while we fetch from /api/products. We
    // can't call showSkeletons() yet — it captures `grid` declared lower down.
    (function paintInitialSkeletons() {
        var box = document.getElementById('product-grid');
        if (!box) return;
        var html = '';
        for (var i = 0; i < 8; i++) {
            html += '<div class="pl-skel"><div class="pl-skel-media"></div>' +
                    '<div class="pl-skel-body">' +
                    '<div class="sk sk-line" style="width:64px;height:16px;border-radius:999px"></div>' +
                    '<div class="sk sk-line" style="width:92%;height:18px;margin-top:8px"></div>' +
                    '<div class="sk sk-line" style="width:64%;height:14px"></div>' +
                    '<div class="sk sk-line" style="width:52%;height:26px;margin-top:6px;border-radius:11px"></div>' +
                    '<div class="sk sk-btn" style="margin-top:12px;border-radius:10px"></div>' +
                    '</div></div>';
        }
        box.innerHTML = html;
    })();

    const ALL = await getAllProducts();
    if (!ALL.length) {
        document.getElementById('product-grid').innerHTML =
          '<div class="pl-empty-state">' +
            '<div class="pl-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>' +
            '<h3>No products yet</h3>' +
            '<p>Ask your administrator to add products via the Super Admin panel.</p>' +
          '</div>';
        document.getElementById('result-count').textContent = '0';
        return;
    }

    const PRICE_FLOOR = Math.floor(Math.min.apply(null, ALL.map(p => userPrice(p))));
    const PRICE_CEIL = Math.ceil(Math.max.apply(null, ALL.map(p => userPrice(p))));

    /* Active filter state */
    const state = {
        search: "",
        categories: [],
        stock: [],
        rating: 0,
        min: PRICE_FLOOR,
        max: PRICE_CEIL,
        sort: "featured"
    };

    /* =========  BUILD FILTER CONTROLS  ========= */

    // Search
    document.getElementById('search-wrap').innerHTML =
        ICONS.search + '<input type="text" id="search-input" placeholder="Search by product name…" />';

    // Category checkboxes (with live tallies)
    function checkboxRow(name, value, tally) {
        return `<label class="check">
      <input type="checkbox" name="${name}" value="${value}" />
      <span class="box">${ICONS.check}</span>
      <span>${value}</span>
      ${tally != null ? `<span class="tally">${tally}</span>` : ''}
    </label>`;
    }
    document.getElementById('filter-category').innerHTML =
        CATEGORIES.map(c => checkboxRow('category', c, ALL.filter(p => p.category === c).length)).join('');

    // Stock
    document.getElementById('filter-stock').innerHTML =
        STOCK_OPTS.map(s => checkboxRow('stock', s, ALL.filter(p => p.stockStatus === s).length)).join('');

    // Rating (single-select radio-style via buttons)
    document.getElementById('filter-rating').innerHTML = RATING_OPTS.map(function (o) {
        const stars = [1, 2, 3, 4, 5].map(i =>
            `<span class="${i <= o.v ? '' : 'dim'}">★</span>`).join('');
        return `<label class="check rate-row">
      <input type="radio" name="rating" value="${o.v}" />
      <span class="box">${ICONS.check}</span>
      <span class="star-line">${stars}</span>
      <span class="tally">&amp; above</span>
    </label>`;
    }).join('');

    /* Price inputs + dual range slider */
    const $min = document.getElementById('price-min');
    const $max = document.getElementById('price-max');
    const $lo = document.getElementById('range-lo');
    const $hi = document.getElementById('range-hi');
    const $fill = document.getElementById('range-fill');
    const $outLo = document.getElementById('out-lo');
    const $outHi = document.getElementById('out-hi');

    [$lo, $hi].forEach(function (r) { r.min = PRICE_FLOOR; r.max = PRICE_CEIL; });
    $lo.value = PRICE_FLOOR; $hi.value = PRICE_CEIL;
    $min.value = PRICE_FLOOR; $max.value = PRICE_CEIL;

    function paintRange() {
        const lo = Number($lo.value), hi = Number($hi.value);
        const span = PRICE_CEIL - PRICE_FLOOR || 1;
        const lPct = ((lo - PRICE_FLOOR) / span) * 100;
        const hPct = ((hi - PRICE_FLOOR) / span) * 100;
        $fill.style.left = lPct + '%';
        $fill.style.width = (hPct - lPct) + '%';
        $outLo.textContent = inr(lo).replace('.00', '');
        $outHi.textContent = inr(hi).replace('.00', '');
    }
    paintRange();

    function rangeChanged() {
        let lo = Number($lo.value), hi = Number($hi.value);
        if (lo > hi) { const t = lo; lo = hi; hi = t; } // keep ordered
        state.min = lo; state.max = hi;
        $min.value = lo; $max.value = hi;
        paintRange();
        applyLive();
    }
    $lo.addEventListener('input', function () { if (Number($lo.value) > Number($hi.value)) $lo.value = $hi.value; rangeChanged(); });
    $hi.addEventListener('input', function () { if (Number($hi.value) < Number($lo.value)) $hi.value = $lo.value; rangeChanged(); });

    $min.addEventListener('change', function () {
        let v = Math.max(PRICE_FLOOR, Math.min(Number($min.value) || PRICE_FLOOR, Number($max.value)));
        $min.value = v; $lo.value = v; state.min = v; paintRange(); applyLive();
    });
    $max.addEventListener('change', function () {
        let v = Math.min(PRICE_CEIL, Math.max(Number($max.value) || PRICE_CEIL, Number($min.value)));
        $max.value = v; $hi.value = v; state.max = v; paintRange(); applyLive();
    });

    /* =========  READ STATE FROM UI  ========= */
    function readState() {
        state.search = (document.getElementById('search-input').value || '').trim().toLowerCase();
        state.categories = getChecked('category');
        state.stock = getChecked('stock');
        const r = document.querySelector('input[name="rating"]:checked');
        state.rating = r ? Number(r.value) : 0;
        state.sort = document.getElementById('sort-select').value;
    }
    function getChecked(name) {
        return Array.prototype.slice
            .call(document.querySelectorAll('input[name="' + name + '"]:checked'))
            .map(el => el.value);
    }

    /* =========  FILTER + SORT PIPELINE  ========= */
    function computeList() {
        let list = ALL.filter(function (p) {
            if (state.search && p.name.toLowerCase().indexOf(state.search) < 0 &&
                p.brand.toLowerCase().indexOf(state.search) < 0) return false;
            if (state.categories.length && state.categories.indexOf(p.category) < 0) return false;
            if (state.stock.length && state.stock.indexOf(p.stockStatus) < 0) return false;
            if (state.rating && p.rating < state.rating) return false;
            if (userPrice(p) < state.min || userPrice(p) > state.max) return false;
            return true;
        });

        switch (state.sort) {
            case 'price-asc': list.sort((a, b) => userPrice(a) - userPrice(b)); break;
            case 'price-desc': list.sort((a, b) => userPrice(b) - userPrice(a)); break;
            case 'rating': list.sort((a, b) => b.rating - a.rating); break;
            case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
            default: break; // featured = source order
        }
        return list;
    }

    /* =========  RENDER PRODUCT CARDS  ========= */
    const grid = document.getElementById('product-grid');

    function cardHTML(p) {
        const price  = userPrice(p);
        const out    = p.stockStatus === "Out of Stock";
        const low    = p.stockStatus === "Low Stock";
        const wished = store.wishlist.indexOf(p.id) >= 0;

        // Stock chip CSS class
        const stockCls = out ? 'pl-stock-out' : low ? 'pl-stock-low' : 'pl-stock-in';

        // Role-aware pricing block
        let pricingHTML;
        if (IS_DIST) {
            const save = (p.mrp && p.mrp > 0) ? Math.round(((p.mrp - price) / p.mrp) * 100) : 0;
            pricingHTML = `<div class="pl-price-row">
              <span class="pl-price-main">${inr(price).replace('.00', '')}</span>
              ${p.mrp ? `<span class="pl-price-mrp">MRP ${inr(p.mrp).replace('.00', '')}</span>` : ''}
              ${save > 0 ? `<span class="pl-discount-badge">${save}% OFF</span>` : ''}
            </div>
            ${save > 0 ? `<div class="pl-margin-note">Trade Margin: ${save}%</div>` : ''}`;
        } else {
            // Retailer: price ONLY — never show MRP or discount
            pricingHTML = `<div class="pl-price-row">
              <span class="pl-price-main">${inr(price).replace('.00', '')}</span>
              <span class="pl-price-label">Retailer Price</span>
            </div>`;
        }

        // Product image: uploaded photo or category-themed SVG illustration
        const media = p.image
            ? `<img src="${p.image}" alt="${p.name}" class="pl-img" loading="lazy">`
            : `<div class="pl-img-svg">${productImageSVG(p.category)}</div>`;

        const cartLabel = out
            ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Out of Stock`
            : `${ICONS.cart} Add to Cart`;

        return `<article class="pl-card" data-id="${p.id}">
      <div class="pl-card-media" data-go="${p.id}">
        <div class="pl-stock-chip ${stockCls}"><span class="pl-stock-dot"></span>${p.stockStatus}</div>
        <button class="pl-wish ${wished ? 'active' : ''}" data-wish="${p.id}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}">${ICONS.heart}</button>
        <div class="pl-img-wrap">${media}</div>
        <div class="pl-hover-overlay" aria-hidden="true">
          <button class="pl-quick-view-btn" data-go="${p.id}">${ICONS.eye} Quick View</button>
        </div>
      </div>
      <div class="pl-card-body">
        <div class="pl-card-meta-row">
          <span class="pl-cat-chip">${p.category}</span>
          <span class="pl-brand-name">${p.brand || ''}</span>
        </div>
        <h3 class="pl-pname" data-go="${p.id}">${p.name}</h3>
        ${(p.packSize || p.strength) ? `<div class="pl-specs-row">${p.packSize ? `<span class="pl-spec-tag">${p.packSize}</span>` : ''}${p.strength ? `<span class="pl-spec-tag">${p.strength}</span>` : ''}</div>` : ''}
        <div class="pl-rating-row">${renderStars(p.rating)} <span class="pl-rating-val">${p.rating || '—'}</span> <span class="pl-rating-cnt">(${p.reviewCount || 0})</span></div>
        <div class="pl-pricing-box">${pricingHTML}</div>
        <div class="pl-card-actions">
          <button class="pl-btn-cart${out ? ' pl-btn-oos' : ''}" data-cart="${p.id}" ${out ? 'disabled' : ''}>${cartLabel}</button>
          <button class="pl-btn-view" data-go="${p.id}" aria-label="View details">${ICONS.eye}</button>
        </div>
      </div>
    </article>`;
    }

    function renderGrid(list) {
        document.getElementById('result-count').textContent = list.length;
        if (!list.length) {
            grid.innerHTML = `<div class="pl-empty-state">
        <div class="pl-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg></div>
        <h3>No products match your filters</h3>
        <p>Try widening your price range or clearing a few filters.</p>
        <button class="pl-empty-btn" data-action="clear-filters"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg> Clear All Filters</button>
      </div>`;
            return;
        }
        grid.innerHTML = list.map(cardHTML).join('');
        // stagger entrance
        Array.prototype.forEach.call(grid.querySelectorAll('.pl-card'), function (c, i) {
            c.style.animationDelay = Math.min(i * 45, 400) + 'ms';
        });
    }

    /* Skeleton loaders */
    function showSkeletons(n) {
        let html = '';
        for (let i = 0; i < n; i++) {
            html += `<div class="pl-skel">
        <div class="pl-skel-media"></div>
        <div class="pl-skel-body">
          <div class="sk sk-line" style="width:64px;height:16px;border-radius:999px"></div>
          <div class="sk sk-line" style="width:92%;height:18px;margin-top:8px"></div>
          <div class="sk sk-line" style="width:64%;height:14px"></div>
          <div class="sk sk-line" style="width:52%;height:26px;margin-top:6px;border-radius:11px"></div>
          <div class="sk sk-btn" style="margin-top:12px;border-radius:10px"></div>
        </div>
      </div>`;
        }
        grid.innerHTML = html;
    }

    /* =========  ACTIVE FILTER CHIPS  ========= */
    function renderChips() {
        const chips = [];
        if (state.search) chips.push({ t: '"' + state.search + '"', clear: () => { document.getElementById('search-input').value = ''; } });
        state.categories.forEach(c => chips.push({ t: c, clear: () => uncheck('category', c) }));
        state.stock.forEach(s => chips.push({ t: s, clear: () => uncheck('stock', s) }));
        if (state.rating) chips.push({ t: state.rating + '★ & above', clear: () => { const r = document.querySelector('input[name="rating"]:checked'); if (r) r.checked = false; } });
        if (state.min > PRICE_FLOOR || state.max < PRICE_CEIL) chips.push({ t: inr(state.min).replace('.00', '') + ' – ' + inr(state.max).replace('.00', ''), clear: resetPrice });

        const box = document.getElementById('active-chips');
        if (!chips.length) { box.innerHTML = ''; return; }
        box.innerHTML = '';
        chips.forEach(function (c) {
            const el = document.createElement('span');
            el.className = 'chip';
            el.innerHTML = c.t + '<button aria-label="Remove">' + ICONS.x + '</button>';
            el.querySelector('button').addEventListener('click', function () { c.clear(); applyLive(); });
            box.appendChild(el);
        });
    }
    function uncheck(name, value) {
        const el = document.querySelector('input[name="' + name + '"][value="' + CSS.escape(value) + '"]');
        if (el) el.checked = false;
    }
    function resetPrice() {
        $min.value = PRICE_FLOOR; $max.value = PRICE_CEIL;
        $lo.value = PRICE_FLOOR; $hi.value = PRICE_CEIL;
        state.min = PRICE_FLOOR; state.max = PRICE_CEIL; paintRange();
    }

    /* =========  LIVE APPLY (debounced)  ========= */
    let liveTimer;
    function applyLive() {
        readState();
        renderChips();
        renderGrid(computeList());
    }
    function debouncedLive() { clearTimeout(liveTimer); liveTimer = setTimeout(applyLive, 120); }

    /* =========  EVENT WIRING  ========= */
    document.getElementById('search-input').addEventListener('input', debouncedLive);
    document.getElementById('sort-select').addEventListener('change', applyLive);

    ['filter-category', 'filter-stock', 'filter-rating'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', applyLive);
    });

    // Apply / Clear buttons
    document.getElementById('apply-filters').addEventListener('click', function () {
        applyLive();
        toast('Filters applied');
        closeSidebar();
    });
    function clearAll() {
        document.getElementById('search-input').value = '';
        Array.prototype.forEach.call(document.querySelectorAll('.filter-scroll input'), function (el) {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        });
        resetPrice();
        document.getElementById('sort-select').value = 'featured';
        applyLive();
    }
    document.getElementById('clear-filters').addEventListener('click', function () { clearAll(); toast('Filters cleared'); });
    document.getElementById('reset-top').addEventListener('click', function (e) { e.preventDefault(); clearAll(); });

    /* Grid click delegation: navigate / cart / wishlist / clear-filters */
    grid.addEventListener('click', function (e) {
        const go = e.target.closest('[data-go]');
        const cart = e.target.closest('[data-cart]');
        const wish = e.target.closest('[data-wish]');
        const clearBtn = e.target.closest('[data-action="clear-filters"]');
        if (clearBtn) { clearAll(); return; }
        if (wish) {
            const on = store.toggleWish(wish.getAttribute('data-wish'));
            wish.classList.toggle('active', on);
            store.syncCounts();
            toast(on ? 'Added to wishlist' : 'Removed from wishlist');
            return;
        }
        if (cart && !cart.disabled) {
            store.addToCart(cart.getAttribute('data-cart'), 1);
            toast('Added to cart');
            return;
        }
        if (go) {
            const id = go.getAttribute('data-go');
            // Pass the product id via query string; details page reads it.
            window.location.href = 'productdetail.html?id=' + encodeURIComponent(id);
        }
    });

    /* Mobile sidebar toggle */
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('filter-backdrop');
    function openSidebar() { sidebar.classList.add('open'); backdrop.classList.add('open'); }
    function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }
    const openBtn = document.getElementById('open-filters');
    if (openBtn) openBtn.addEventListener('click', openSidebar);
    backdrop.addEventListener('click', closeSidebar);

    /* =========  INITIAL RENDER (data already fetched)  ========= */
    readState();
    renderChips();
    renderGrid(computeList());
    store.syncCounts();
});
