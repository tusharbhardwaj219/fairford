/* =====================================================================
   products.js — MediBridge Products Listing Page
   Handles: filter UI build-out, live filtering, sorting, skeleton
   loading state, product card rendering, and navigation to details.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', function () {

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

    const ALL = getAllProducts();
    const PRICE_FLOOR = Math.floor(Math.min.apply(null, ALL.map(p => userPrice(p))));
    const PRICE_CEIL = Math.ceil(Math.max.apply(null, ALL.map(p => userPrice(p))));

    /* Active filter state */
    const state = {
        search: "",
        categories: [],
        brands: [],
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

    // Brands (dynamic, multi-select)
    document.getElementById('filter-brand').innerHTML =
        getAllBrands().map(b => checkboxRow('brand', b, ALL.filter(p => p.brand === b).length)).join('');

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
        state.brands = getChecked('brand');
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
            if (state.brands.length && state.brands.indexOf(p.brand) < 0) return false;
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
        const wished = store.wishlist.indexOf(p.id) >= 0;

        // Role-aware pricing block
        let pricingHTML;
        if (IS_DIST) {
            // Distributor: price + MRP + discount % + margin
            const save   = (p.mrp && p.mrp > 0) ? Math.round(((p.mrp - price) / p.mrp) * 100) : 0;
            const margin = save; // same formula for this layout
            pricingHTML = `
              <div class="price-block">
                <span class="retail" title="Distributor Price">${inr(price).replace('.00', '')}</span>
                <span class="mrp">MRP ${inr(p.mrp).replace('.00', '')}</span>
                ${save > 0 ? `<span class="save">${save}% OFF</span>` : ''}
              </div>
              ${margin > 0 ? `<div class="margin-note">Margin: ${margin}%</div>` : ''}`;
        } else {
            // Retailer: price ONLY — never show MRP or discount
            pricingHTML = `
              <div class="price-block">
                <span class="retail" title="Retailer Price">${inr(price).replace('.00', '')}</span>
              </div>`;
        }

        return `<article class="card" data-id="${p.id}">
      <button class="wish ${wished ? 'active' : ''}" data-wish="${p.id}" aria-label="Add to wishlist">${ICONS.heart}</button>
      <div class="card-media" data-go="${p.id}">
        <div class="pv"><span class="cat-tag">${p.category}</span>${productImageSVG(p.category)}</div>
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="brandline">${p.brand}</span>
          <span class="badge ${badgeClass(p.stockStatus)}">${p.stockStatus}</span>
        </div>
        <h3 class="pname" data-go="${p.id}">${p.name}</h3>
        <div class="meta-row">
          <span>${p.packSize}</span><span class="dot"></span><span>${p.strength}</span>
        </div>
        <div class="rating-row">${renderStars(p.rating)} <b>${p.rating}</b> <span>(${p.reviewCount})</span></div>
        ${pricingHTML}
        <div class="card-actions">
          <button class="btn btn-primary" data-cart="${p.id}" ${out ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
            ${ICONS.cart} ${out ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button class="btn btn-ghost" data-go="${p.id}" aria-label="View details">${ICONS.eye}</button>
        </div>
      </div>
    </article>`;
    }

    function renderGrid(list) {
        document.getElementById('result-count').textContent = list.length;
        if (!list.length) {
            grid.innerHTML = `<div class="empty-state">
        ${ICONS.search}
        <h3>No products match your filters</h3>
        <p>Try widening your price range or clearing a few filters.</p>
      </div>`;
            return;
        }
        grid.innerHTML = list.map(cardHTML).join('');
        // stagger entrance
        Array.prototype.forEach.call(grid.querySelectorAll('.card'), function (c, i) {
            c.style.animationDelay = Math.min(i * 45, 400) + 'ms';
        });
    }

    /* Skeleton loaders */
    function showSkeletons(n) {
        let html = '';
        for (let i = 0; i < n; i++) {
            html += `<div class="skeleton-card">
        <div class="sk sk-media"></div>
        <div class="sk sk-line w40"></div>
        <div class="sk sk-line w80"></div>
        <div class="sk sk-line w60"></div>
        <div class="sk sk-btn"></div>
      </div>`;
        }
        grid.innerHTML = html;
    }

    /* =========  ACTIVE FILTER CHIPS  ========= */
    function renderChips() {
        const chips = [];
        if (state.search) chips.push({ t: '"' + state.search + '"', clear: () => { document.getElementById('search-input').value = ''; } });
        state.categories.forEach(c => chips.push({ t: c, clear: () => uncheck('category', c) }));
        state.brands.forEach(b => chips.push({ t: b, clear: () => uncheck('brand', b) }));
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

    ['filter-category', 'filter-brand', 'filter-stock', 'filter-rating'].forEach(function (id) {
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

    /* Grid click delegation: navigate / cart / wishlist */
    grid.addEventListener('click', function (e) {
        const go = e.target.closest('[data-go]');
        const cart = e.target.closest('[data-cart]');
        const wish = e.target.closest('[data-wish]');
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

    /* =========  INITIAL LOAD with skeletons  ========= */
    showSkeletons(8);
    setTimeout(function () {
        readState();
        renderChips();
        renderGrid(computeList());
        store.syncCounts();
    }, 650); // simulate network latency → swap for real fetch()
});
